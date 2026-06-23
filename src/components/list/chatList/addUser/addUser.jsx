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
import { useState, useEffect } from "react";
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

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      setLoading(true);
      if (isLocalMode) {
        const allUsers = localDb.query("SELECT * FROM users").filter((u) => u.id !== currentUser.id);
        setUsers(allUsers);
        return;
      }
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      const allUsers = querySnapshot.docs
        .map((docSnap) => docSnap.data())
        .filter((u) => u.id !== currentUser.id);
      setUsers(allUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
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

      // Check if chat already exists
      const userChatsRef = doc(db, "userchats", currentUser.id);
      const userChatsSnap = await getDoc(userChatsRef);

      if (userChatsSnap.exists()) {
        const existingChats = userChatsSnap.data().chats || [];
        const existingChat = existingChats.find(
          (c) => c.receiverId === selectedUser.id
        );
        if (existingChat) {
          // Chat exists — select it and close modal
          toast.info("Chat already exists! Opening it.");
          changeChat(existingChat.chatId, selectedUser);
          setAddMode(false);
          return;
        }
      }

      // Create new chat
      const chatRef = collection(db, "chats");
      const newChatRef = doc(chatRef);
      const userChatsCollection = collection(db, "userchats");

      await setDoc(newChatRef, {
        createdAt: serverTimestamp(),
        messages: [],
      });

      await updateDoc(doc(userChatsCollection, selectedUser.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: currentUser.id,
          updatedAt: Date.now(),
        }),
      });

      await updateDoc(doc(userChatsCollection, currentUser.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: selectedUser.id,
          updatedAt: Date.now(),
        }),
      });

      toast.success("Chat created successfully!");
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
            <div className="wa-newchat__empty">No users found</div>
          ) : (
            filteredUsers.map((user) => (
              <div
                className="wa-newchat__user-item"
                key={user.id}
                onClick={() => handleAdd(user)}
              >
                <img
                  src={user.avatar || "./avatar2.png"}
                  alt={user.username}
                  className="wa-newchat__user-avatar"
                />
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
