import { useEffect, useState } from "react";
import "./chatList.css";
import AddUser from "./addUser/addUser";
import CreateGroup from "./CreateGroup";
import { useUserStore } from "../../../lib/userStore";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useChatStore } from "../../../lib/chatStore";
import { localDb } from "../../../lib/localDb";
import { decrypt, getChatKey } from "../../../lib/encryption";
import { toast } from "react-toastify";

const ChatList = () => {
  const [chats, setChats] = useState([]);
  const [addMode, setAddMode] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [input, setInput] = useState("");
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);

  const { currentUser, isLocalMode } = useUserStore();
  const { changeChat, chatId: activeChatId, isGroup: activeIsGroup, groupInfo: activeGroupInfo } = useChatStore();

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isLocalMode || !onlineStatus) {
      const fetchLocalChats = async () => {
        const localChats = localDb.getUserChats(currentUser.id);
        const promises = localChats.map(async (item) => {
          if (item.isGroup) {
            // Group chat mock user
            const group = {
              id: item.chatId,
              username: item.groupName,
              avatar: item.groupAvatar || "./avatar2.png",
              isGroup: true,
              members: item.members,
              blocked: [],
              isAIBoredom: item.isAIBoredom || false,
              boredomType: item.boredomType || null,
              boredomCaseIndex: item.boredomCaseIndex !== undefined ? item.boredomCaseIndex : null
            };
            return { ...item, user: group };
          }
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
          if (item.isGroup) {
            const group = {
              id: item.chatId,
              username: item.groupName,
              avatar: item.groupAvatar || "./avatar2.png",
              isGroup: true,
              members: item.members,
              blocked: [],
              isAIBoredom: item.isAIBoredom || false,
              boredomType: item.boredomType || null,
              boredomCaseIndex: item.boredomCaseIndex !== undefined ? item.boredomCaseIndex : null
            };
            return { ...item, user: group };
          }
          const userDocRef = doc(db, "users", item.receiverId);
          const userDocSnap = await getDoc(userDocRef);
          const user = userDocSnap.data();

          if (user) {
            // Cache user in local SQLite database
            const userRows = localDb.query("SELECT * FROM users WHERE id = ?", [user.id]);
            if (userRows.length === 0) {
              localDb.query("INSERT INTO users (id, username, email, avatar, status) VALUES (?, ?, ?, ?, ?)", [
                user.id,
                user.username,
                user.email,
                user.avatar || "./avatar2.png",
                user.status || ""
              ]);
            } else {
              const users = localDb._getTable("users");
              const uIdx = users.findIndex(u => u.id === user.id);
              if (uIdx > -1) {
                users[uIdx].username = user.username;
                users[uIdx].avatar = user.avatar || "./avatar2.png";
                users[uIdx].status = user.status || "";
                localDb._setTable("users", users);
              }
            }
          }

          return { ...item, user };
        });

        const chatData = await Promise.all(promises);

        // Cache userchats in local SQLite simulation
        const cachedUserchats = chatData.map(chat => ({
          chatId: chat.chatId,
          lastMessage: chat.lastMessage,
          receiverId: chat.receiverId,
          updatedAt: chat.updatedAt instanceof Date ? chat.updatedAt.getTime() : (chat.updatedAt?.seconds ? chat.updatedAt.seconds * 1000 : chat.updatedAt || Date.now()),
          isSeen: chat.isSeen,
          isGroup: chat.isGroup || false,
          groupName: chat.groupName || null,
          groupAvatar: chat.groupAvatar || null,
          members: chat.members || null,
          isAIBoredom: chat.isAIBoredom || false,
          boredomType: chat.boredomType || null,
          boredomCaseIndex: chat.boredomCaseIndex !== undefined ? chat.boredomCaseIndex : null
        }));
        localDb.updateUserChats(currentUser.id, cachedUserchats);

        setChats(chatData.sort((a, b) => b.updatedAt - a.updatedAt));
      }
    );

    return () => {
      unSub();
    };
  }, [currentUser.id, isLocalMode, onlineStatus]);

  const handleSelect = async (chat) => {
    if (activeIsGroup && activeGroupInfo?.isAIBoredom && activeChatId !== chat.chatId) {
      toast.warn(activeGroupInfo?.boredomType === "mystery"
        ? "🔎 You cannot leave the Mystery Room! Solve the mystery first."
        : "😈 You cannot flee the Boredom Zone! Escape the roast battle first."
      );
      return;
    }

    const userChats = chats.map((item) => {
      const { user, ...rest } = item;
      return rest;
    });

    const chatIndex = userChats.findIndex(
      (item) => item.chatId === chat.chatId
    );

    userChats[chatIndex].isSeen = true;

    if (isLocalMode || !onlineStatus) {
      localDb.updateUserChats(currentUser.id, userChats);
      if (chat.isGroup) {
        changeChat(chat.chatId, chat.user, true);
      } else {
        changeChat(chat.chatId, chat.user, false);
      }
      return;
    }

    const userChatsRef = doc(db, "userchats", currentUser.id);

    try {
      await updateDoc(userChatsRef, { chats: userChats });
      if (chat.isGroup) {
        changeChat(chat.chatId, chat.user, true);
      } else {
        changeChat(chat.chatId, chat.user, false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredChats = chats.filter((c) =>
    c.user?.username?.toLowerCase().includes(input.toLowerCase())
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
        <div className="wa-chatlist__actions">
          <button
            className="wa-chatlist__new-chat-btn"
            onClick={() => setGroupMode((prev) => !prev)}
            title="New Group"
            style={{ marginRight: "6px" }}
          >
            👥
          </button>
          <button
            className="wa-chatlist__new-chat-btn"
            onClick={() => setAddMode((prev) => !prev)}
            title="New Chat"
          >
            📝
          </button>
        </div>
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
                  {chat.lastMessage ? decrypt(chat.lastMessage, getChatKey(chat.chatId)) : "No messages yet"}
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
      <CreateGroup isOpen={groupMode} onClose={() => setGroupMode(false)} />
    </div>
  );
};

export default ChatList;
