import { arrayRemove, arrayUnion, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { useChatStore } from "../../lib/chatStore";
import { auth, db } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import { saveAs } from 'file-saver';
import "./detail.css";
import { toast } from "react-toastify";

const Detail = () => {
  const { chat,receiverId, chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock, resetChat } = useChatStore();
  const { currentUser } = useUserStore();
 
  const [showPhotos, setShowPhotos] = useState(true);
  const [sharedPhotos, setSharedPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [error, setError] = useState(null);
  const [showChatDropdown, setShowChatDropdown] = useState(false);
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);  // For delete chat
  const [showLogoutModal, setShowLogoutModal] = useState(false);  // For logout
  const [showBlockModal, setShowBlockModal] = useState(false);  // For block user

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!chatId) return;

      setLoadingPhotos(true);
      setError(null);

      try {
        const chatDocRef = doc(db, "chats", chatId);
        const chatDocSnap = await getDoc(chatDocRef);

        if (chatDocSnap.exists()) {
          const chatData = chatDocSnap.data();
          const photos = chatData.messages
            ?.filter((message) => message.img)
            .map((message, index) => ({
              id: index,
              url: message.img,
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
  }, [chatId]);

  const handleDownload = (photo) => {
    saveAs(photo.url, photo.name);
  };

  const handleBlock = async () => {
    if (!user) return;

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
    auth.signOut();
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
        <img src={user?.avatar || "./avatar2.png"} alt="User Avatar" />
        <h2>{user?.username || "Unknown User"}</h2>
        <p>{user?.status || "Hey! I'm using Chatapp"}</p>
      </div>

      <div className="info">
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
    </div>
  );
};

export default Detail;
