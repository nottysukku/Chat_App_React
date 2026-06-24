import React, { useState, useEffect } from "react";
import { useUserStore } from "../../../lib/userStore";
import { useChatStore } from "../../../lib/chatStore";
import { db } from "../../../lib/firebase";
import { collection, addDoc, doc, setDoc, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import upload from "../../../lib/upload";
import { toast } from "react-toastify";
import "./createGroup.css";

const CreateGroup = ({ isOpen, onClose }) => {
  const { currentUser, isLocalMode } = useUserStore();
  const { changeChat } = useChatStore();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [avatar, setAvatar] = useState({ file: null, url: "" });
  const [loading, setLoading] = useState(false);

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

      // Query Firebase users list
      const querySnapshot = await getDocs(collection(db, "users"));
      const allUsers = querySnapshot.docs
        .map((docSnap) => docSnap.data())
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
        const initialMsg = {
          senderId: "system",
          text: `${currentUser.username} created group "${groupName}"`,
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
            lastMessage: `${currentUser.username} created group "${groupName}"`,
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
      const newChatDoc = await addDoc(chatRef, {
        createdAt: Date.now(),
        isGroup: true,
        groupName,
        groupAvatar: groupAvatarUrl,
        members: [currentUser.id, ...selectedMembers],
        messages: [
          {
            senderId: "system",
            text: `${currentUser.username} created group "${groupName}"`,
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
            chatId: newChatDoc.id,
            isGroup: true,
            groupName,
            groupAvatar: groupAvatarUrl,
            lastMessage: `${currentUser.username} created group "${groupName}"`,
            isSeen: memberId === currentUser.id,
            updatedAt: Date.now()
          })
        });
      }

      toast.success(`Group "${groupName}" created!`);
      const groupObj = {
        id: newChatDoc.id,
        groupName,
        groupAvatar: groupAvatarUrl,
        members: allMemberIds
      };
      changeChat(newChatDoc.id, groupObj, true);
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

          <div className="wa-group-drawer__label">Add group members</div>
          <div className="wa-group-drawer__users-list">
            {filteredUsers.length === 0 ? (
              <div className="wa-group-drawer__empty">No contacts found</div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`wa-group-drawer__user-item ${
                    selectedMembers.includes(user.id) ? "wa-group-drawer__user-item--selected" : ""
                  }`}
                  onClick={() => toggleMember(user.id)}
                >
                  <img src={user.avatar || "./avatar2.png"} alt={user.username} className="wa-group-drawer__user-avatar" />
                  <div className="wa-group-drawer__user-info">
                    <span className="wa-group-drawer__user-name">{user.username}</span>
                    <span className="wa-group-drawer__user-status">{user.status || "Hey! I'm using Chatapp."}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="wa-group-drawer__user-checkbox"
                    checked={selectedMembers.includes(user.id)}
                    onChange={() => {}} // toggling handled by item click
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
    </div>
  );
};

export default CreateGroup;
