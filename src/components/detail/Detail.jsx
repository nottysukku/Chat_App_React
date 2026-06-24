import { arrayRemove, arrayUnion, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useChatStore } from "../../lib/chatStore";
import { auth, db } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import { saveAs } from 'file-saver';
import "./detail.css";
import { toast } from "react-toastify";
import { localDb } from "../../lib/localDb";
import { encrypt, decrypt, getChatKey } from "../../lib/encryption";
import SqlConsole from "../SqlConsole/SqlConsole";

const Detail = () => {
  const { chat, receiverId, chatId, user, isGroup, groupInfo, isCurrentUserBlocked, isReceiverBlocked, changeBlock, resetChat } = useChatStore();
  const { currentUser, isLocalMode } = useUserStore();
 
  const [showPhotos, setShowPhotos] = useState(true);
  const [sharedPhotos, setSharedPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [error, setError] = useState(null);
  const [showChatDropdown, setShowChatDropdown] = useState(false);
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  const [showGroupMembersDropdown, setShowGroupMembersDropdown] = useState(true);
  
  // Group members states
  const [membersList, setMembersList] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);  // For delete chat
  const [showLogoutModal, setShowLogoutModal] = useState(false);  // For logout
  const [showBlockModal, setShowBlockModal] = useState(false);  // For block user
  const [showExitGroupModal, setShowExitGroupModal] = useState(false); // For exit group
  const [showSqlConsole, setShowSqlConsole] = useState(false);
  const [showDeveloperDropdown, setShowDeveloperDropdown] = useState(false);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!chatId) return;

      setLoadingPhotos(true);
      setError(null);

      try {
        if (isLocalMode) {
          const chats = localDb.query("SELECT * FROM chats WHERE id = ?", [chatId]);
          const chatData = chats[0];
          if (chatData) {
            const photos = chatData.messages
              ?.filter((message) => message.img)
              .map((message, index) => ({
                id: index,
                url: decrypt(message.img, getChatKey(chatId)),
                name: message.fileName || `photo_${index + 1}.png`,
              }));
            setSharedPhotos(photos || []);
          } else {
            setSharedPhotos([]);
          }
          return;
        }

        const chatDocRef = doc(db, "chats", chatId);
        const chatDocSnap = await getDoc(chatDocRef);

        if (chatDocSnap.exists()) {
          const chatData = chatDocSnap.data();
          const photos = chatData.messages
            ?.filter((message) => message.img)
            .map((message, index) => ({
              id: index,
              url: decrypt(message.img, getChatKey(chatId)),
              name: message.fileName || `photo_${index + 1}.png`,
            }));
          setSharedPhotos(photos || []);
        } else {
          console.warn("No chat found with the given chatId");
          setSharedPhotos([]);
        }
      } catch (err) {
        console.error("Error fetching photos:", err);
        setError("Failed to load shared photos. Please try again later.");
      } finally {
        setLoadingPhotos(false);
      }
    };

    fetchPhotos();
  }, [chatId, isLocalMode]);

  useEffect(() => {
    if (!isGroup || !groupInfo) {
      setMembersList([]);
      return;
    }

    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        if (isLocalMode) {
          const allUsers = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
          const members = allUsers.filter(u => groupInfo.members.includes(u.id));
          setMembersList(members);
        } else {
          const members = [];
          for (const memberId of groupInfo.members) {
            const userDocSnap = await getDoc(doc(db, "users", memberId));
            if (userDocSnap.exists()) {
              members.push(userDocSnap.data());
            }
          }
          setMembersList(members);
        }
      } catch (err) {
        console.error("Error fetching group members in Detail panel:", err);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
    if (isLocalMode) {
      window.addEventListener("local-db-update", fetchMembers);
      return () => window.removeEventListener("local-db-update", fetchMembers);
    }
  }, [chatId, isGroup, groupInfo, isLocalMode]);

  const handleExitGroup = async () => {
    if (!chatId || !groupInfo) return;

    try {
      const encryptedExitText = encrypt(`${currentUser.username} left the group`, getChatKey(chatId));

      if (isLocalMode) {
        // SQLite local exit group
        // 1. Remove currentUser.id from group members list in chats table
        const chats = localDb._getTable("chats");
        const chatIdx = chats.findIndex(c => c.id === chatId);
        if (chatIdx > -1) {
          chats[chatIdx].members = chats[chatIdx].members.filter(id => id !== currentUser.id);
          // Push a system message that the user left
          chats[chatIdx].messages.push({
            senderId: "system",
            text: encryptedExitText,
            createdAt: new Date().toISOString()
          });
          localDb._setTable("chats", chats);
        }

        // 2. Remove the group chat from the currentUser's userchats list
        const currentUserChats = localDb.getUserChats(currentUser.id).filter(c => c.chatId !== chatId);
        localDb.updateUserChats(currentUser.id, currentUserChats);

        // 3. For all remaining members, update the userchats summaries
        const remainingMembers = groupInfo.members.filter(id => id !== currentUser.id);
        const userchats = JSON.parse(localStorage.getItem("sqlite_userchats") || "{}");
        remainingMembers.forEach(memberId => {
          if (userchats[memberId]) {
            const idx = userchats[memberId].chats.findIndex(c => c.chatId === chatId);
            if (idx > -1) {
              userchats[memberId].chats[idx].lastMessage = encryptedExitText;
              userchats[memberId].chats[idx].updatedAt = Date.now();
            }
          }
        });
        localStorage.setItem("sqlite_userchats", JSON.stringify(userchats));
        window.dispatchEvent(new CustomEvent("local-db-update"));

        toast.success(`You have left the group "${groupInfo.groupName}"`);
        resetChat();
        return;
      }

      // Cloud Firebase exit group
      const chatDocRef = doc(db, "chats", chatId);
      const chatDocSnap = await getDoc(chatDocRef);
      if (chatDocSnap.exists()) {
        const chatData = chatDocSnap.data();
        const updatedMembers = (chatData.members || []).filter(id => id !== currentUser.id);
        const updatedMessages = [
          ...(chatData.messages || []),
          {
            senderId: "system",
            text: encryptedExitText,
            createdAt: Date.now()
          }
        ];
        
        await updateDoc(chatDocRef, {
          members: updatedMembers,
          messages: updatedMessages
        });

        // Remove from current user's userchats
        const userChatsRef = doc(db, "userchats", currentUser.id);
        const userChatsSnap = await getDoc(userChatsRef);
        if (userChatsSnap.exists()) {
          const userChatsData = userChatsSnap.data();
          const filteredChats = (userChatsData.chats || []).filter(c => c.chatId !== chatId);
          await updateDoc(userChatsRef, { chats: filteredChats });
        }

        // Update lastMessage for other members
        for (const memberId of updatedMembers) {
          const mChatsRef = doc(db, "userchats", memberId);
          const mChatsSnap = await getDoc(mChatsRef);
          if (mChatsSnap.exists()) {
            const mChatsData = mChatsSnap.data();
            const idx = (mChatsData.chats || []).findIndex(c => c.chatId === chatId);
            if (idx > -1) {
              mChatsData.chats[idx].lastMessage = encryptedExitText;
              mChatsData.chats[idx].updatedAt = Date.now();
              await updateDoc(mChatsRef, { chats: mChatsData.chats });
            }
          }
        }
      }

      toast.success(`You have left the group "${groupInfo.groupName}"`);
      resetChat();
    } catch (err) {
      console.error("Error exiting group:", err);
      toast.error("Failed to exit the group.");
    }
  };

  const confirmExitGroup = () => {
    handleExitGroup();
    setShowExitGroupModal(false);
  };

  const cancelExitGroup = () => {
    setShowExitGroupModal(false);
  };

  const handleDownload = (photo) => {
    saveAs(photo.url, photo.name);
  };

  const handleBlock = async () => {
    if (!user) return;

    if (isLocalMode) {
      const users = localDb._getTable("users");
      const currentUserIndex = users.findIndex(u => u.id === currentUser.id);
      if (currentUserIndex > -1) {
        const isBlocked = currentUser.blocked.includes(user.id);
        if (isBlocked) {
          users[currentUserIndex].blocked = users[currentUserIndex].blocked.filter(id => id !== user.id);
        } else {
          users[currentUserIndex].blocked.push(user.id);
        }
        localDb._setTable("users", users);

        currentUser.blocked = users[currentUserIndex].blocked;
        localStorage.setItem("local_current_user", JSON.stringify(currentUser));
      }
      changeBlock();
      setShowBlockModal(false);
      return;
    }

    const userDocRef = doc(db, "users", currentUser.id);

    try {
      await updateDoc(userDocRef, {
        blocked: isReceiverBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
      });
      changeBlock();
      setShowBlockModal(false);  // Close block modal after confirming
    } catch (err) {
      console.error("Error updating block status:", err);
    }
  };

  const handleDelchat = async () => {
    if (!chatId) {
      toast.error("Chat ID not found.");
      return;
    }
  
    if (isLocalMode) {
      const userChats = localDb.getUserChats(currentUser.id).filter(c => c.chatId !== chatId);
      localDb.updateUserChats(currentUser.id, userChats);

      const receiverChats = localDb.getUserChats(user.id).filter(c => c.chatId !== chatId);
      localDb.updateUserChats(user.id, receiverChats);

      localDb.query("DELETE FROM chats WHERE id = ?", [chatId]);
      
      toast.success("Chat deleted successfully.");
      resetChat();
      return;
    }

    try {
      const userChatsDocRef = doc(db, "userchats", currentUser.id);
      const userChatsDocSnap = await getDoc(userChatsDocRef);
  
      if (!userChatsDocSnap.exists()) {
        console.log("User chats document not found.");
        toast.error("User chats not found.");
        return;
      }
  
      const userChatsData = userChatsDocSnap.data();
      const chats = userChatsData.chats;
  
      const chatToDelete = chats.find((chat) => chat.chatId === chatId);
  
      if (!chatToDelete) {
        console.log("Chat not found in the user's chats.");
        toast.error("Chat not found.");
        return;
      }
  
      // Remove the chat from the current user's chat list
      await updateDoc(userChatsDocRef, {
        chats: arrayRemove(chatToDelete),
      });
  
      // Check if the receiver has the same chatId and delete it from their chat list
      const receiverId = chatToDelete.receiverId;  // Assuming the chat has receiverId field
      const receiverChatsDocRef = doc(db, "userchats", receiverId);
      const receiverChatsDocSnap = await getDoc(receiverChatsDocRef);
  
      if (receiverChatsDocSnap.exists()) {
        const receiverChatsData = receiverChatsDocSnap.data();
        const receiverChats = receiverChatsData.chats;
  
        const receiverChatToDelete = receiverChats.find(
          (chat) => chat.chatId === chatId
        );
  
        if (receiverChatToDelete) {
          await updateDoc(receiverChatsDocRef, {
            chats: arrayRemove(receiverChatToDelete),
          });
        }
      }
  
      // Now delete the chat document itself
      const chatDocRef = doc(db, "chats", chatId);
      await deleteDoc(chatDocRef);
  
      toast.success("Chat deleted successfully.");
      console.log("Chat deleted successfully.");
      resetChat();
    } catch (err) {
      console.error("Error deleting chat:", err);
      toast.error("Failed to delete the chat. Please try again later.");
    }
  };

  const confirmDeleteChat = () => {
    handleDelchat();
    setShowModal(false);  // Close the modal after confirming
  };

  const cancelDeleteChat = () => {
    setShowModal(false);  // Close the modal if cancelled
  };

  const handleLogout = () => {
    if (isLocalMode) {
      const { logoutGuest } = useUserStore.getState();
      logoutGuest();
      resetChat();
      setShowLogoutModal(false);
      return;
    }
    auth.signOut();
    resetChat();
    setShowLogoutModal(false);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);  // Close the logout modal if cancelled
  };

  const cancelBlock = () => {
    setShowBlockModal(false);  // Close the block modal if cancelled
  };

  return (
    <div className="detail">
      <div className="user">
        <img
          src={isGroup ? (groupInfo?.groupAvatar || "./avatar2.png") : (user?.avatar || "./avatar2.png")}
          alt="Avatar"
        />
        <h2>{isGroup ? (groupInfo?.groupName || "Group Chat") : (user?.username || "Unknown User")}</h2>
        <p>{isGroup ? `${groupInfo?.members?.length || 0} participants` : (user?.status || "Hey! I'm using Chatapp")}</p>
      </div>

      <div className="info">
        {isGroup && (
          <div className="option">
            <div
              className="title"
              onClick={() => setShowGroupMembersDropdown((prev) => !prev)}
            >
              <span>Group Members</span>
              <img
                src={showGroupMembersDropdown ? "./arrowDown.png" : "./arrowUp.png"}
                alt="Arrow"
              />
            </div>
            {showGroupMembersDropdown && (
              <div className="detail__members-list">
                {loadingMembers ? (
                  <p className="detail__loading-text">Loading members...</p>
                ) : (
                  membersList.map((m) => (
                    <div key={m.id} className="detail__member-item">
                      <img src={m.avatar || "./avatar2.png"} alt={m.username} className="detail__member-avatar" />
                      <div className="detail__member-info">
                        <span className="detail__member-name">
                          {m.id === currentUser.id ? `${m.username} (You)` : m.username}
                        </span>
                        <span className="detail__member-status">{m.status || "Hey! I'm using Chatapp"}</span>
                      </div>
                      {m.isOnline && <span className="detail__member-online-dot"></span>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div className="option">
          <div
            className="title"
            onClick={() => setShowChatDropdown((prev) => !prev)}
          >
            <span>Chat Settings</span>
            <img
              src={showChatDropdown ? "./arrowDown.png" : "./arrowUp.png"}
              alt="Arrow"
            />
          </div>
          {showChatDropdown && (
            <div className="dropdown">
              <button
                className="logout-button"
                onClick={() => setShowLogoutModal(true)} // Show logout confirmation modal
              >
                Logout
              </button>
              {isGroup ? (
                <button
                  onClick={() => setShowExitGroupModal(true)}
                  className="logout-button"
                >
                  Exit Group
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setShowModal(true)} 
                    style={{ margin: "0px 20px" }} 
                    className="logout-button"
                  >
                    Delete Chat
                  </button>
                  <button 
                    onClick={() => setShowBlockModal(true)}  // Show block confirmation modal
                    className="logout-button"
                  >
                    {isReceiverBlocked ? "Unblock User" : "Block User"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="option">
          <div
            className="title"
            onClick={() => setShowPrivacyDropdown((prev) => !prev)}
          >
            <span>Privacy & Help</span>
            <img
              src={showPrivacyDropdown ? "./arrowDown.png" : "./arrowUp.png"}
              alt="Arrow"
            />
          </div>
          {showPrivacyDropdown && (
            <div className="dropdown">
              <a
                href="https://firebase.google.com/support/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
            </div>
          )}
        </div>

        <div className="option">
          <div
            className="title"
            onClick={() => setShowDeveloperDropdown((prev) => !prev)}
          >
            <span>Developer Tools</span>
            <img
              src={showDeveloperDropdown ? "./arrowDown.png" : "./arrowUp.png"}
              alt="Arrow"
            />
          </div>
          {showDeveloperDropdown && (
            <div className="dropdown" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px" }}>
              <button
                onClick={() => setShowSqlConsole(true)}
                className="sql-console-btn"
                style={{
                  background: "rgba(99, 102, 241, 0.15)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  color: "var(--text-primary)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                  textAlign: "left",
                  transition: "background var(--transition-fast)"
                }}
              >
                🗄️ Interactive SQLite Console
              </button>
              <a
                href="https://github.com/nottysukku"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13px",
                  fontWeight: "500",
                  textDecoration: "none",
                  textAlign: "center",
                  transition: "background var(--transition-fast)"
                }}
              >
                🐙 Developer GitHub Profile
              </a>
            </div>
          )}
        </div>

        <div className="option">
          <div
            className="title"
            onClick={() => setShowPhotos(!showPhotos)}
          >
            <span>Shared Files</span>
            <img
              src={showPhotos ? "./arrowDown.png" : "./arrowUp.png"}
              alt="Arrow"
            />
          </div>
          {showPhotos && (
            <div id="showfiles" className="photos">
              {loadingPhotos ? (
                <p>Loading photos...</p>
              ) : error ? (
                <p className="error">{error}</p>
              ) : sharedPhotos.length > 0 ? (
                sharedPhotos.map((photo, index) => (
                  <div key={photo.id} className="photoItem">
                    <div className="photoDetail">
                      <img
                        src={photo.url}
                        alt={photo.name}
                        onError={(e) => {
                          e.target.src = './attach.png';
                        }} 
                      />
                      <span>{`Document ${index + 1}`}</span>
                    </div>
                    <img
                      src="./download.png"
                      alt="Download"
                      className="icon"
                      onClick={() => handleDownload(photo)}
                    />
                  </div>
                ))
              ) : (
                <p className="no-photos">No shared Files yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Deleting Chat */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <p>Are you sure you want to delete this chat?</p>
            <div className="modal-buttons">
              <button onClick={confirmDeleteChat} className="confirm-btn">Yes</button>
              <button onClick={cancelDeleteChat} className="cancel-btn">No</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Logout */}
      {showLogoutModal && (
        <div className="modal">
          <div className="modal-content">
            <p>Are you sure you want to log out?</p>
            <div className="modal-buttons">
              <button onClick={handleLogout} className="confirm-btn">Yes</button>
              <button onClick={cancelLogout} className="cancel-btn">No</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Blocking User */}
      {showBlockModal && (
        <div className="modal">
          <div className="modal-content">
            <p>Are you sure you want to {isReceiverBlocked ? "unblock" : "block"} this user?</p>
            <div className="modal-buttons">
              <button onClick={handleBlock} className="confirm-btn">Yes</button>
              <button onClick={cancelBlock} className="cancel-btn">No</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Exiting Group */}
      {showExitGroupModal && (
        <div className="modal">
          <div className="modal-content">
            <p>Are you sure you want to exit this group?</p>
            <div className="modal-buttons">
              <button onClick={confirmExitGroup} className="confirm-btn">Yes</button>
              <button onClick={cancelExitGroup} className="cancel-btn">No</button>
            </div>
          </div>
        </div>
      )}
      <SqlConsole isOpen={showSqlConsole} onClose={() => setShowSqlConsole(false)} />
    </div>
  );
};

export default Detail;
