import { useEffect, useState } from "react";
import "./chatList.css";
import AddUser from "./addUser/addUser";
import { useUserStore } from "../../../lib/userStore";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useChatStore } from "../../../lib/chatStore";
import { localDb } from "../../../lib/localDb";

const ChatList = () => {
  const [chats, setChats] = useState([]);
  const [addMode, setAddMode] = useState(false);
  const [input, setInput] = useState("");

  const { currentUser, isLocalMode } = useUserStore();
  const { changeChat } = useChatStore();

  useEffect(() => {
    if (isLocalMode) {
      const fetchLocalChats = async () => {
        const localChats = localDb.getUserChats(currentUser.id);
        const promises = localChats.map(async (item) => {
          const userRows = localDb.query("SELECT * FROM users WHERE id = ?", [item.receiverId]);
          const user = userRows[0] || { id: item.receiverId, username: "User", avatar: "./avatar2.png", blocked: [] };
          return { ...item, user };
        });
        const chatData = await Promise.all(promises);
        setChats(chatData.sort((a, b) => b.updatedAt - a.updatedAt));
      };

      fetchLocalChats();
      window.addEventListener("local-db-update", fetchLocalChats);
      return () => {
        window.removeEventListener("local-db-update", fetchLocalChats);
      };
    }

    const unSub = onSnapshot(
      doc(db, "userchats", currentUser.id),
      async (res) => {
        const items = res.data()?.chats || [];

        const promises = items.map(async (item) => {
          const userDocRef = doc(db, "users", item.receiverId);
          const userDocSnap = await getDoc(userDocRef);
          const user = userDocSnap.data();
          return { ...item, user };
        });

        const chatData = await Promise.all(promises);
        setChats(chatData.sort((a, b) => b.updatedAt - a.updatedAt));
      }
    );

    return () => {
      unSub();
    };
  }, [currentUser.id, isLocalMode]);

  const handleSelect = async (chat) => {
    const userChats = chats.map((item) => {
      const { user, ...rest } = item;
      return rest;
    });

    const chatIndex = userChats.findIndex(
      (item) => item.chatId === chat.chatId
    );

    userChats[chatIndex].isSeen = true;

    if (isLocalMode) {
      localDb.updateUserChats(currentUser.id, userChats);
      changeChat(chat.chatId, chat.user);
      return;
    }

    const userChatsRef = doc(db, "userchats", currentUser.id);

    try {
      await updateDoc(userChatsRef, { chats: userChats });
      changeChat(chat.chatId, chat.user);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredChats = chats.filter((c) =>
    c.user.username.toLowerCase().includes(input.toLowerCase())
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const oneDay = 86400000;

    if (diff < oneDay) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diff < oneDay * 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="wa-chatlist">
      {/* Search Bar */}
      <div className="wa-chatlist__search-wrapper">
        <div className="wa-chatlist__search">
          <span className="wa-chatlist__search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search or start new chat"
            className="wa-chatlist__search-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button
          className="wa-chatlist__new-chat-btn"
          onClick={() => setAddMode((prev) => !prev)}
          title="New Chat"
        >
          📝
        </button>
      </div>

      {/* Chat Items */}
      <div className="wa-chatlist__items">
        {filteredChats.map((chat) => (
          <div
            className={`wa-chatlist__item ${!chat?.isSeen ? "wa-chatlist__item--unread" : ""}`}
            key={chat.chatId}
            onClick={() => handleSelect(chat)}
          >
            <img
              src={
                chat.user.blocked?.includes(currentUser.id)
                  ? "./avatar2.png"
                  : chat.user.avatar || "./avatar2.png"
              }
              alt="Avatar"
              className="wa-chatlist__avatar"
            />
            <div className="wa-chatlist__content">
              <div className="wa-chatlist__top-row">
                <span className="wa-chatlist__username">
                  {chat.user.blocked?.includes(currentUser.id)
                    ? "User"
                    : chat.user.username}
                </span>
                <span className="wa-chatlist__time">
                  {formatTime(chat.updatedAt)}
                </span>
              </div>
              <div className="wa-chatlist__bottom-row">
                <p className="wa-chatlist__last-message">
                  {chat.lastMessage || "No messages yet"}
                </p>
                {!chat?.isSeen && (
                  <span className="wa-chatlist__unread-dot"></span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {addMode && <AddUser setAddMode={setAddMode} />}
    </div>
  );
};

export default ChatList;
