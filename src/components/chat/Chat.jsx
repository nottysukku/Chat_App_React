import React, { useState, useEffect, useRef } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import {
  arrayRemove,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import upload from "../../lib/upload";
import { format } from "timeago.js";

const Chat = () => {
  const [chat, setChat] = useState();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [confirmModal, setConfirmModal] = useState(false); // Modal visibility state
  const [messageToDelete, setMessageToDelete] = useState(null); // Store the message to delete
  const [img, setImg] = useState({ file: null, url: "" });
  const { currentUser } = useUserStore();
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } =
    useChatStore();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  useEffect(() => {
    const unSub = onSnapshot(doc(db, "chats", chatId), (res) => {
      setChat(res.data());
    });

    return () => {
      unSub();
    };
  }, [chatId]);

  const handleEmoji = (e) => {
    setText((prev) => prev + e.emoji);
    setOpen(false);
  };

  const handleImg = (e) => {
    if (e.target.files[0]) {
      setImg({ file: e.target.files[0], url: URL.createObjectURL(e.target.files[0]) });
    }
  };

  const handleDelete = async () => {
    if (!messageToDelete) return;

    try {
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayRemove(messageToDelete),
      });
    } catch (error) {
      console.error("Error deleting message:", error);
    }
    setMessageToDelete(null);
    setConfirmModal(false); // Close the modal
  };

  const openModal = (message) => {
    setMessageToDelete(message); // Set the message to delete
    setConfirmModal(true); // Show the modal
  };

  return (
    <div className="chat">
      <div className="top">
        <div className="user">
          <img src={user?.avatar || "./avatar2.png"} alt="" />
          <div className="texts">
            <span>{user?.username}</span>
            <p>Hey! I'm using Chatapp</p>
          </div>
        </div>
        <div className="icons">
          <img src="./phone.png" alt="" />
          <img src="./video.png" alt="" />
          <img id="linked" src="./info.png" onClick={() => window.open("https://www.linkedin.com/in/sukrit-chopra-5923a9215/")} alt="" />
        </div>
      </div>
      <div className="center">
        {chat?.messages?.map((message) => (
          <div
            className={`message ${message.senderId === currentUser?.id ? "own" : ""}`}
            key={message.createdAt}
            onMouseEnter={() => setHoveredMessage(message)}
            onMouseLeave={() => setHoveredMessage(null)}
          >
            <div className="texts">
              {message.img && <img src={message.img} alt="" />}
              <p>{message.text}</p>
              <span>{format(message.createdAt.toDate())}</span>
            </div>
            {hoveredMessage === message && message.senderId === currentUser?.id && (
              <div className="dropdown">
                <button onClick={() => openModal(message)}>Delete</button>
              </div>
            )}
          </div>
        ))}
        {img.url && (
          <div className="message own">
            <div className="texts">
              <img src={img.url} alt="" />
            </div>
          </div>
        )}
        <div ref={endRef}></div>
      </div>
      <div className="bottom">
        <div className="icons">
          <label htmlFor="file">
            <img src="./img.png" alt="" />
          </label>
          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onChange={handleImg}
          />
          <img src="./camera.png" alt="" />
          <img src="./mic.png" alt="" />
        </div>
        <input
          type="text"
          placeholder={isCurrentUserBlocked || isReceiverBlocked ? "You cannot send a message" : "Type a message..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        />
        <div className="emoji">
          <img src="./emoji.png" alt="" onClick={() => setOpen((prev) => !prev)} />
          <div className="picker">
            <EmojiPicker open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button
          className="sendButton"
          onClick={() => {/* Add Send Functionality Here */}}
        >
          Send
        </button>
      </div>

      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>ARE YOU SURE YOU WANT TO PERMANENTLY DELETE THIS MESSAGE?</h2>
            <div className="modal-actions">
              <button className="yes-btn" onClick={handleDelete}>Yes</button>
              <button className="no-btn" onClick={() => setConfirmModal(false)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
