import React, { useState, useEffect } from "react";
import { useUserStore } from "../../../lib/userStore";
import { useChatStore } from "../../../lib/chatStore";
import { db } from "../../../lib/firebase";
import { collection, addDoc, doc, setDoc, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import upload from "../../../lib/upload";
import { toast } from "react-toastify";
import "./createGroup.css";
import { encrypt, getChatKey } from "../../../lib/encryption";
import { mysteryCases } from "../../../lib/mysteryCases";

const CreateGroup = ({ isOpen, onClose }) => {
  const { currentUser, isLocalMode } = useUserStore();
  const { changeChat } = useChatStore();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [boredomType, setBoredomType] = useState("roast");

  useEffect(() => {
    if (!isOpen) return;
    fetchUsers();
    // Reset fields on open
    setGroupName("");
    setSelectedMembers([]);
    setAvatar({ file: null, url: "" });
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      if (isLocalMode) {
        // Query local users list
        const allUsers = JSON.parse(localStorage.getItem("sqlite_users") || "[]")
          .filter((u) => u.id !== currentUser.id);
        setUsers(allUsers);
        return;
      }

      // Query Firebase users list — always include doc ID as fallback
      const querySnapshot = await getDocs(collection(db, "users"));
      const allUsers = querySnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((u) => u.id !== currentUser.id);
      setUsers(allUsers);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load contacts.");
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar({
        file,
        url: URL.createObjectURL(file),
      });
    }
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateAIBoredom = async () => {
    setShowWarning(false);
    try {
      setLoading(true);
      const isMystery = boredomType === "mystery";
      const groupName = isMystery ? "Mystery Case File 🔎" : "AI Boredom Zone 🤖💥";
      const groupAvatarUrl = "./avatar2.png";

      const caseIndex = Math.floor(Math.random() * mysteryCases.length);
      const selectedCase = mysteryCases[caseIndex];

      let membersList = [];
      if (isLocalMode) {
        const allUsers = JSON.parse(localStorage.getItem("sqlite_users") || "[]")
          .filter((u) => u.id !== currentUser.id);
        membersList = allUsers.map(u => u.id);
      } else {
        const querySnapshot = await getDocs(collection(db, "users"));
        const allUsers = querySnapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((u) => u.id !== currentUser.id);
        membersList = allUsers.map(u => u.id);
      }

      if (membersList.length === 0) {
        membersList = ["alice_id", "bob_id", "gemini_ai_id"];
      }

      if (isLocalMode) {
        const localChatId = "group_chat_boredom_" + Date.now();
        const localChats = JSON.parse(localStorage.getItem("sqlite_chats") || "[]");
        const groupKey = getChatKey(localChatId);
        const welcomeText = isMystery 
          ? `🔎 MYSTERY CASE: ${selectedCase.title}\n\n${selectedCase.intro}` 
          : `Welcome to the AI Boredom Zone! Prepare to be roasted.`;
        const encryptedText = encrypt(welcomeText, groupKey);

        const initialMsg = {
          senderId: "system",
          text: encryptedText,
          createdAt: new Date().toISOString()
        };

        localChats.push({
          id: localChatId,
          createdAt: Date.now(),
          isGroup: true,
          groupName,
          groupAvatar: groupAvatarUrl,
          members: [currentUser.id, ...membersList],
          messages: [initialMsg],
          isAIBoredom: true,
          boredomType,
          boredomCaseIndex: caseIndex
        });
        localStorage.setItem("sqlite_chats", JSON.stringify(localChats));

        const userchats = JSON.parse(localStorage.getItem("sqlite_userchats") || "{}");
        const memberId = currentUser.id;
        if (!userchats[memberId]) userchats[memberId] = { chats: [] };
        userchats[memberId].chats.push({
          chatId: localChatId,
          isGroup: true,
          groupName,
          groupAvatar: groupAvatarUrl,
          lastMessage: encryptedText,
          isSeen: true,
          updatedAt: Date.now(),
          isAIBoredom: true,
          boredomType,
          boredomCaseIndex: caseIndex
        });
        localStorage.setItem("sqlite_userchats", JSON.stringify(userchats));
        window.dispatchEvent(new CustomEvent("local-db-update"));

        toast.success(isMystery ? "Entered the Murder Mystery Room!" : "Entered the AI Boredom Zone!");
        
        const groupObj = {
          id: localChatId,
          groupName,
          groupAvatar: groupAvatarUrl,
          members: [currentUser.id, ...membersList],
          isAIBoredom: true,
          boredomType,
          boredomCaseIndex: caseIndex
        };
        changeChat(localChatId, groupObj, true);
        onClose();
        return;
      }

      // Cloud Firebase mode
      const chatRef = collection(db, "chats");
      const newChatDocRef = doc(chatRef);
      const newChatId = newChatDocRef.id;
      const groupKey = getChatKey(newChatId);
      const welcomeText = isMystery 
        ? `🔎 MYSTERY CASE: ${selectedCase.title}\n\n${selectedCase.intro}` 
        : `Welcome to the AI Boredom Zone! Prepare to be roasted.`;
      const encryptedText = encrypt(welcomeText, groupKey);

      await setDoc(newChatDocRef, {
        createdAt: Date.now(),
        isGroup: true,
        groupName,
        groupAvatar: groupAvatarUrl,
        members: [currentUser.id, ...membersList],
        messages: [
          {
            senderId: "system",
            text: encryptedText,
            createdAt: Date.now()
          }
        ],
        isAIBoredom: true,
        boredomType,
        boredomCaseIndex: caseIndex
      });

      const userChatsRef = doc(db, "userchats", currentUser.id);
      await updateDoc(userChatsRef, {
        chats: arrayUnion({
          chatId: newChatId,
          isGroup: true,
          groupName,
          groupAvatar: groupAvatarUrl,
          lastMessage: encryptedText,
          isSeen: true,
          updatedAt: Date.now(),
          isAIBoredom: true,
          boredomType,
          boredomCaseIndex: caseIndex
        })
      });

      toast.success(isMystery ? "Entered the Murder Mystery Room!" : "Entered the AI Boredom Zone!");
      const groupObj = {
        id: newChatId,
        groupName,
        groupAvatar: groupAvatarUrl,
        members: [currentUser.id, ...membersList],
        isAIBoredom: true,
        boredomType,
        boredomCaseIndex: caseIndex
      };
      changeChat(newChatId, groupObj, true);
      onClose();
    } catch (err) {
      console.error("Create AI Boredom group error:", err);
      toast.error("Failed to enter the Boredom Zone.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      return toast.warn("Please enter a group subject!");
    }
    if (selectedMembers.length === 0) {
      return toast.warn("Please add at least one member!");
    }

    try {
      setLoading(true);
      let groupAvatarUrl = "./avatar2.png";

      if (avatar.file) {
        if (isLocalMode) {
          // Read local image as Base64
          const getBase64 = (file) => {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(file);
            });
          };
          groupAvatarUrl = await getBase64(avatar.file);
        } else {
          // Upload to Firebase Storage
          groupAvatarUrl = await upload(avatar.file);
        }
      }

      if (isLocalMode) {
        // SQLite Local group creation
        const localChatId = "group_chat_" + Date.now();
        const localChats = JSON.parse(localStorage.getItem("sqlite_chats") || "[]");
        const groupKey = getChatKey(localChatId);
        const encryptedText = encrypt(`${currentUser.username} created group "${groupName}"`, groupKey);

        const initialMsg = {
          senderId: "system",
          text: encryptedText,
          createdAt: new Date().toISOString()
        };

        localChats.push({
          id: localChatId,
          createdAt: Date.now(),
          isGroup: true,
          groupName,
          groupAvatar: groupAvatarUrl,
          members: [currentUser.id, ...selectedMembers],
          messages: [initialMsg]
        });
        localStorage.setItem("sqlite_chats", JSON.stringify(localChats));

        // Update userchats list for all participants
        const allMemberIds = [currentUser.id, ...selectedMembers];
        const userchats = JSON.parse(localStorage.getItem("sqlite_userchats") || "{}");
        allMemberIds.forEach(memberId => {
          if (!userchats[memberId]) userchats[memberId] = { chats: [] };
          userchats[memberId].chats.push({
            chatId: localChatId,
            isGroup: true,
            groupName,
            groupAvatar: groupAvatarUrl,
            lastMessage: encryptedText,
            isSeen: memberId === currentUser.id,
            updatedAt: Date.now()
          });
        });
        localStorage.setItem("sqlite_userchats", JSON.stringify(userchats));
        window.dispatchEvent(new CustomEvent("local-db-update"));

        toast.success(`Group "${groupName}" created locally!`);
        
        // Select newly created chat
        const groupObj = {
          id: localChatId,
          groupName,
          groupAvatar: groupAvatarUrl,
          members: allMemberIds
        };
        changeChat(localChatId, groupObj, true);
        onClose();
        return;
      }

      // Cloud Firebase group creation
      const chatRef = collection(db, "chats");
      const newChatDocRef = doc(chatRef);
      const newChatId = newChatDocRef.id;
      const groupKey = getChatKey(newChatId);
      const encryptedText = encrypt(`${currentUser.username} created group "${groupName}"`, groupKey);

      await setDoc(newChatDocRef, {
        createdAt: Date.now(),
        isGroup: true,
        groupName,
        groupAvatar: groupAvatarUrl,
        members: [currentUser.id, ...selectedMembers],
        messages: [
          {
            senderId: "system",
            text: encryptedText,
            createdAt: Date.now()
          }
        ]
      });

      // Update userchats list for all participants in Firebase
      const allMemberIds = [currentUser.id, ...selectedMembers];
      for (const memberId of allMemberIds) {
        const userChatsRef = doc(db, "userchats", memberId);
        await updateDoc(userChatsRef, {
          chats: arrayUnion({
            chatId: newChatId,
            isGroup: true,
            groupName,
            groupAvatar: groupAvatarUrl,
            lastMessage: encryptedText,
            isSeen: memberId === currentUser.id,
            updatedAt: Date.now()
          })
        });
      }

      toast.success(`Group "${groupName}" created!`);
      const groupObj = {
        id: newChatId,
        groupName,
        groupAvatar: groupAvatarUrl,
        members: allMemberIds
      };
      changeChat(newChatId, groupObj, true);
      onClose();
    } catch (err) {
      console.error("Create group error:", err);
      toast.error("Failed to create group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`wa-group-drawer ${isOpen ? "wa-group-drawer--open" : ""}`}>
      {/* Header */}
      <div className="wa-group-drawer__header">
        <button className="wa-group-drawer__back-btn" onClick={onClose} title="Back">
          ←
        </button>
        <span className="wa-group-drawer__title">New Group</span>
      </div>

      {/* Content Form */}
      <form className="wa-group-drawer__content" onSubmit={handleCreate}>
        {/* AI Boredom Group Button */}
        <div className="wa-group-drawer__ai-boredom-section">
          <button
            type="button"
            className="wa-group-drawer__ai-boredom-btn"
            onClick={() => setShowWarning(true)}
            disabled={loading}
          >
            🤖 Create AI Boredom Group 💥
          </button>
        </div>

        {/* Group Photo & subject */}
        <div className="wa-group-drawer__fields">
          <label className="wa-group-drawer__avatar-wrapper" htmlFor="group-avatar-input">
            <img src={avatar.url || "./avatar2.png"} alt="Group Avatar" className="wa-group-drawer__avatar" />
            <div className="wa-group-drawer__avatar-overlay">
              <span>ADD GROUP ICON</span>
            </div>
            <input
              id="group-avatar-input"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
              disabled={loading}
            />
          </label>

          <input
            type="text"
            className="wa-group-drawer__input"
            placeholder="Group subject..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            maxLength={25}
            disabled={loading}
          />
        </div>

        {/* Member Selector */}
        <div className="wa-group-drawer__members-section">
          <div className="wa-group-drawer__search-row">
            <input
              type="text"
              className="wa-group-drawer__search-input"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="wa-group-drawer__label">
            Add group members
            {selectedMembers.length > 0 && (
              <span className="wa-group-drawer__selected-count">
                {selectedMembers.length} selected
              </span>
            )}
            <button
              type="button"
              className="wa-group-drawer__refresh-btn"
              onClick={fetchUsers}
              title="Refresh contact list"
            >
              🔄
            </button>
          </div>
          <div className="wa-group-drawer__users-list">
            {filteredUsers.length === 0 ? (
              <div className="wa-group-drawer__empty">
                {search ? `No contacts matching "${search}"` : "No contacts found"}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`wa-group-drawer__user-item ${
                    selectedMembers.includes(user.id) ? "wa-group-drawer__user-item--selected" : ""
                  }`}
                  onClick={() => toggleMember(user.id)}
                >
                  <div className="wa-group-drawer__avatar-wrapper">
                    <img
                      src={user.avatar || "./avatar2.png"}
                      alt={user.username}
                      className="wa-group-drawer__user-avatar"
                      onError={(e) => (e.target.src = "./avatar2.png")}
                    />
                    {user.isOnline && (
                      <span className="wa-group-drawer__online-dot" />
                    )}
                  </div>
                  <div className="wa-group-drawer__user-info">
                    <span className="wa-group-drawer__user-name">{user.username}</span>
                    <span className="wa-group-drawer__user-status">{user.status || "Hey! I'm using Chatapp."}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="wa-group-drawer__user-checkbox"
                    checked={selectedMembers.includes(user.id)}
                    onChange={() => {}}
                    disabled={loading}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Floating submit checkmark button */}
        <button
          type="submit"
          className="wa-group-drawer__submit-btn"
          disabled={loading || selectedMembers.length === 0 || !groupName.trim()}
          title="Create Group"
        >
          {loading ? "..." : "✓"}
        </button>
      </form>

      {/* AI Boredom Warning Modal */}
      {showWarning && (
        <div className="wa-group-drawer__warning-overlay">
          <div className="wa-group-drawer__warning-modal">
            <div className="wa-group-drawer__warning-icon">⚠️</div>
            <h3 className="wa-group-drawer__warning-title">AI BOREDOM ZONE WARNING</h3>
            
            <div className="wa-group-drawer__game-select">
              <span className="wa-group-drawer__game-select-label">Choose Game Type:</span>
              <div className="wa-group-drawer__game-options">
                <button
                  type="button"
                  className={`wa-group-drawer__game-option ${boredomType === "roast" ? "wa-group-drawer__game-option--active" : ""}`}
                  onClick={() => setBoredomType("roast")}
                >
                  🔥 Roast Battle
                </button>
                <button
                  type="button"
                  className={`wa-group-drawer__game-option ${boredomType === "mystery" ? "wa-group-drawer__game-option--active" : ""}`}
                  onClick={() => setBoredomType("mystery")}
                >
                  🔎 Text Mystery
                </button>
              </div>
            </div>

            {boredomType === "roast" ? (
              <>
                <p className="wa-group-drawer__warning-text">
                  You are about to enter a highly roasted chat zone! All other members will be AI bots simulating your contacts.
                </p>
                <p className="wa-group-drawer__warning-text">
                  They will troll and mock you based on your responses. <strong>You cannot leave this group</strong> unless you either win the roast battle (evaluated by AI) or beat the Breakout game to escape.
                </p>
              </>
            ) : (
              <>
                <p className="wa-group-drawer__warning-text">
                  You are about to enter a Text Mystery Room! You will need to ask questions to solve a randomly chosen murder mystery case.
                </p>
                <p className="wa-group-drawer__warning-text">
                  The bots will respond with clues when you uncover specific case words (case-insensitive). <strong>You cannot leave this group</strong> until you solve the mystery or beat the Breakout game to escape.
                </p>
              </>
            )}

            <p className="wa-group-drawer__warning-text wa-group-drawer__warning-highlight">
              Do you dare to proceed?
            </p>
            <div className="wa-group-drawer__warning-actions">
              <button
                type="button"
                className="wa-group-drawer__warning-btn wa-group-drawer__warning-btn--cancel"
                onClick={() => setShowWarning(false)}
              >
                Back Out
              </button>
              <button
                type="button"
                className="wa-group-drawer__warning-btn wa-group-drawer__warning-btn--confirm"
                onClick={handleCreateAIBoredom}
              >
                Enter Zone! 😈
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateGroup;
