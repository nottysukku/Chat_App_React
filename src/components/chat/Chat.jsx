import React, { useState, useEffect, useRef } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import {
  arrayUnion,
  arrayRemove,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useChatStore } from "../../lib/chatStore";
import { useUserStore } from "../../lib/userStore";
import upload from "../../lib/upload";
import { format } from "timeago.js";
import {toast} from "react-toastify";
import LoadingPopup from "./LoadingPopup";
const Chat = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
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
    const file = e.target.files[0];
    
    if (!file) return; // No file selected
  
    // Check if the file type is an image
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image"); // Show error toast for non-image files
      return;
    }
  
    // Check if the file size is greater than 3MB
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image size exceeds 3MB limit!"); // Show error toast
      return;
    }
  
    // If file is an image and size is under 3MB, set the image state and generate the URL for preview
    setImg({
      file: file,
      url: URL.createObjectURL(file),
    });
  
    toast.success("Image selected successfully!"); // Optional: show success toast on image selection
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

  
  const handleAttach = async () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,application/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
  
      if (file.size > 3 * 1024 * 1024) {
        toast.error("File size exceeds 3MB limit!");
        return;
      }
  
      try {
        setUploadProgress(0); // Reset progress
        const fileUrl = await upload(file, (progress) => {
          setUploadProgress(progress); // Update progress
        });
        
        await updateDoc(doc(db, "chats", chatId), {
          messages: [
            ...chat.messages,
            {
              senderId: currentUser.id,
              text: "",
              createdAt: new Date(),
              img: fileUrl,
              type: file.type,
            },
          ],
        });
        
        toast.success("File uploaded successfully!");
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error("Failed to upload the file. Please try again.");
      } finally {
        setUploadProgress(0); // Reset progress when done
      }
    };
    fileInput.click();
  };
  
  // Handle send message
  const handleSend = async () => {
    if (!text.trim() && !img.file) return;
  
    let imgUrl = null;
  
    try {
      // Upload image if exists
      if (img.file) {
        setUploadProgress(0); // Reset progress
        imgUrl = await upload(img.file, (progress) => {
          setUploadProgress(progress); // Update progress
        });
      }
  
      // Update chat messages in Firestore
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text,
          createdAt: new Date(),
          ...(imgUrl && { img: imgUrl }),
        }),
      });
  
      // Update user chat details for both users
      const userIDs = [currentUser.id, user.id];
      for (const id of userIDs) {
        const userChatsRef = doc(db, "userchats", id);
        const userChatsSnapshot = await getDoc(userChatsRef);
        
        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();
          const chatIndex = userChatsData.chats.findIndex((c) => c.chatId === chatId);
          
          if (chatIndex >= 0) {
            userChatsData.chats[chatIndex].lastMessage = text;
            userChatsData.chats[chatIndex].isSeen = id === currentUser.id;
            userChatsData.chats[chatIndex].updatedAt = Date.now();
            await updateDoc(userChatsRef, { chats: userChatsData.chats });
          }
        }
      }
  
      // Show success toast if image was uploaded
      if (img.file) {
        toast.success("Message with image sent successfully!");
      }
  
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Failed to send message. Please try again.");
    } finally {
      // Reset all states
      setText("");
      setImg({ file: null, url: "" });
      setUploadProgress(0); // Reset progress bar
      
      // Scroll to the bottom of the chat
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };
  
  return (
    <div className="chat">
       
      <div className="top">
        <div className="user">
          <img src={user?.avatar || "./avatar2.png"} alt="" />
          <div className="texts">
            <span>{user?.username}</span>
            <p>{user?.status||"Hey! I'm using Chatapp"}</p>
          </div>
        </div>
        <div className="icons">
          <img src="./phone.png" alt="" />
          <img src="./video.png" alt="" />
          <img id="linked" src="./info.png" onClick={() => window.open("https://www.linkedin.com/in/sukrit-chopra-5923a9215/")} alt="" />
        </div>
      </div>
      <div className="center">
        {uploadProgress > 0 && <LoadingPopup progress={uploadProgress} />}
     
      {chat?.messages?.map((message) => (
        <div
        className={`message ${message.senderId === currentUser?.id ? "own" : ""}`}
        key={message.createdAt}
        onMouseEnter={() => setHoveredMessage(message)}
        onMouseLeave={() => setHoveredMessage(null)}
        >
    <div className="texts">
      {message.img && (
        <img
          src={message.img}
          alt=""
          onError={(e) => e.target.src = 'attach.png'} // Set to default image on error
        />
      )}
      <p>{message.text}</p>
      <span>{format(message.createdAt.toDate())}</span>
    </div>
    {hoveredMessage === message && message.senderId === currentUser?.id && (
      <div className="dropdown">
        <button id="delete" onClick={() => openModal(message)}>Delete</button>
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
        
          <img style={{ filter: "invert(1)" }} src="./attach.png" alt="" onClick={handleAttach}/>
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
          onClick={handleSend}
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
