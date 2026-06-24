import "./addUser.css";
import { db } from "../../../../lib/firebase";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useState, useEffect, useCallback } from "react";
import { useUserStore } from "../../../../lib/userStore";
import { useChatStore } from "../../../../lib/chatStore";
import { toast } from "react-toastify";
import { localDb } from "../../../../lib/localDb";

const AddUser = ({ setAddMode }) => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { currentUser, isLocalMode } = useUserStore();
  const { changeChat } = useChatStore();

  const fetchAllUsers = useCallback(async () => {
    try {
      setLoading(true);
      if (isLocalMode) {
        const allUsers = localDb
          .query("SELECT * FROM users")
          .filter((u) => u.id !== currentUser.id);
        setUsers(allUsers);
        return;
      }
      // Cloud mode — fetch ALL users from Firestore
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      const allUsers = querySnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((u) => u.id !== currentUser.id);
      setUsers(allUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [isLocalMode, currentUser.id]);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const filteredUsers = users.filter((u) =>
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (selectedUser) => {
    try {
      if (isLocalMode) {
        const existingChats = localDb.getUserChats(currentUser.id);
        const existingChat = existingChats.find((c) => c.receiverId === selectedUser.id);
        if (existingChat) {
          toast.info("Chat already exists! Opening it.");
          changeChat(existingChat.chatId, selectedUser);
          setAddMode(false);
          return;
        }
        const newChatId = localDb.createLocalChat(currentUser, selectedUser);
        toast.success("Chat created successfully!");
        changeChat(newChatId, selectedUser);
        setAddMode(false);
        return;
      }

      // Cloud mode — ensure the other user has a userchats doc
      const selectedUserChatsRef = doc(db, "userchats", selectedUser.id);
      const selectedUserChatsSnap = await getDoc(selectedUserChatsRef);
      if (!selectedUserChatsSnap.exists()) {
        await setDoc(selectedUserChatsRef, { chats: [] });
      }

      // Check if chat already exists for current user
      const userChatsRef = doc(db, "userchats", currentUser.id);
      const userChatsSnap = await getDoc(userChatsRef);

      if (userChatsSnap.exists()) {
        const existingChats = userChatsSnap.data().chats || [];
        const existingChat = existingChats.find(
          (c) => c.receiverId === selectedUser.id
        );
        if (existingChat) {
          toast.info("Chat already exists! Opening it.");
          changeChat(existingChat.chatId, selectedUser);
          setAddMode(false);
          return;
        }
      } else {
        // Ensure current user has a userchats doc
        await setDoc(userChatsRef, { chats: [] });
      }

      // Create new chat document
      const chatRef = collection(db, "chats");
      const newChatRef = doc(chatRef);
      const userChatsCollection = collection(db, "userchats");

      await setDoc(newChatRef, {
        createdAt: serverTimestamp(),
        messages: [],
      });

      // Add to the other user's chats
      await updateDoc(doc(userChatsCollection, selectedUser.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: currentUser.id,
          updatedAt: Date.now(),
          isSeen: false,
        }),
      });

      // Add to current user's chats
      await updateDoc(doc(userChatsCollection, currentUser.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: selectedUser.id,
          updatedAt: Date.now(),
          isSeen: true,
        }),
      });

      toast.success("Chat created successfully!");
      changeChat(newChatRef.id, selectedUser);
      setAddMode(false);
    } catch (err) {
      console.error(err);
      toast.error("Error occurred while adding the user.");
    }
  };

  return (
    <div className="wa-newchat__overlay" onClick={() => setAddMode(false)}>
      <div
        className="wa-newchat__modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="wa-newchat__header">
          <button
            className="wa-newchat__back-btn"
            onClick={() => setAddMode(false)}
          >
            ✕
          </button>
          <h2 className="wa-newchat__title">New Chat</h2>
          <button
            className="wa-newchat__refresh-btn"
            onClick={fetchAllUsers}
            title="Refresh user list"
          >
            🔄
          </button>
        </div>

        {/* Mode indicator */}
        <div className="wa-newchat__mode-badge">
          {isLocalMode ? "📦 Local Mode" : "☁️ Cloud Mode"} — {users.length} user{users.length !== 1 ? "s" : ""} found
        </div>

        {/* Search */}
        <div className="wa-newchat__search">
          <span className="wa-newchat__search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search users"
            className="wa-newchat__search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* User List */}
        <div className="wa-newchat__list">
          {loading ? (
            <div className="wa-newchat__loading">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="wa-newchat__empty">
              {search ? `No users matching "${search}"` : "No other users found"}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                className="wa-newchat__user-item"
                key={user.id}
                onClick={() => handleAdd(user)}
              >
                <div className="wa-newchat__avatar-wrapper">
                  <img
                    src={user.avatar || "./avatar2.png"}
                    alt={user.username}
                    className="wa-newchat__user-avatar"
                    onError={(e) => (e.target.src = "./avatar2.png")}
                  />
                  {user.isOnline && (
                    <span className="wa-newchat__online-dot" />
                  )}
                </div>
                <div className="wa-newchat__user-info">
                  <span className="wa-newchat__user-name">
                    {user.username}
                  </span>
                  <span className="wa-newchat__user-status">
                    {user.status || "Hey! I'm using ChatApp."}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AddUser;
