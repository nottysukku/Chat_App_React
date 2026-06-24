import React, { useState, useEffect, useCallback, useRef } from "react";
import "./chat.css";
import EmojiPicker from "emoji-picker-react";
import Callbox from "../Callbox/Callbox";
import { localDb } from "../../lib/localDb";

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
import { toast } from "react-toastify";
import LoadingPopup from "./LoadingPopup";

const Chat = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [chat, setChat] = useState();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmModalCall, setConfirmModalCall] = useState(false);
  const [confirmModalVideo, setConfirmModalVideo] = useState(false);
  const [confirmModalLinkedin, setConfirmModalLinkedin] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [img, setImg] = useState({ file: null, url: "" });
  const { currentUser, isLocalMode } = useUserStore();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const chunks = useRef([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [callboxVisible, setCallboxVisible] = useState(false);
  const { chatId, user, isGroup, groupInfo, isCurrentUserBlocked, isReceiverBlocked, resetChat } = useChatStore();
  const [activeUser, setActiveUser] = useState(user);
  const [groupMembers, setGroupMembers] = useState([]);
  const endRef = useRef(null);

  const updateUserChatsSummary = async (lastMsgText) => {
    const userIDs = isGroup ? (groupInfo?.members || []) : [currentUser.id, user.id];
    
    if (isLocalMode) {
      userIDs.forEach((id) => {
        const userChats = localDb.getUserChats(id);
        const idx = userChats.findIndex((c) => c.chatId === chatId);
        if (idx > -1) {
          userChats[idx].lastMessage = lastMsgText;
          userChats[idx].isSeen = id === currentUser.id;
          userChats[idx].updatedAt = Date.now();
          localDb.updateUserChats(id, userChats);
        }
      });
      return;
    }

    // Cloud Firebase mode
    try {
      for (const id of userIDs) {
        const userChatsRef = doc(db, "userchats", id);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();
          const chatIndex = userChatsData.chats.findIndex((c) => c.chatId === chatId);

          if (chatIndex >= 0) {
            userChatsData.chats[chatIndex].lastMessage = lastMsgText;
            userChatsData.chats[chatIndex].isSeen = id === currentUser.id;
            userChatsData.chats[chatIndex].updatedAt = Date.now();
            await updateDoc(userChatsRef, { chats: userChatsData.chats });
          }
        }
      }
    } catch (err) {
      console.error("Failed to update userchats summaries in Firebase:", err);
    }
  };

  useEffect(() => {
    console.log("audioBlob:", audioBlob);
    console.log("audioUrl:", audioUrl);
  }, [audioBlob, audioUrl]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  // 1. Sync User / Group Status and Details in real-time
  useEffect(() => {
    setActiveUser(user);
    if (!user || isGroup) return;

    if (isLocalMode) {
      const fetchUserData = () => {
        const users = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
        const found = users.find(u => u.id === user.id);
        if (found) {
          setActiveUser(found);
        }
      };
      fetchUserData();
      window.addEventListener("local-db-update", fetchUserData);
      return () => {
        window.removeEventListener("local-db-update", fetchUserData);
      };
    } else {
      const unSub = onSnapshot(doc(db, "users", user.id), (res) => {
        if (res.exists()) {
          setActiveUser(res.data());
        }
      });
      return () => unSub();
    }
  }, [user, chatId, isLocalMode, isGroup]);

  // 2. Fetch Group Members' details
  useEffect(() => {
    if (!isGroup || !groupInfo) {
      setGroupMembers([]);
      return;
    }

    const fetchGroupMembers = async () => {
      try {
        if (isLocalMode) {
          const allUsers = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
          const members = allUsers.filter(u => groupInfo.members.includes(u.id));
          setGroupMembers(members);
        } else {
          const members = [];
          for (const memberId of groupInfo.members) {
            const userDocSnap = await getDoc(doc(db, "users", memberId));
            if (userDocSnap.exists()) {
              members.push(userDocSnap.data());
            }
          }
          setGroupMembers(members);
        }
      } catch (err) {
        console.error("Error fetching group members details:", err);
      }
    };

    fetchGroupMembers();
    if (isLocalMode) {
      window.addEventListener("local-db-update", fetchGroupMembers);
      return () => window.removeEventListener("local-db-update", fetchGroupMembers);
    }
  }, [chatId, isGroup, groupInfo, isLocalMode]);

  // 3. Load messages and Auto-Mark seen: true (Read Receipts)
  useEffect(() => {
    if (isLocalMode) {
      const fetchLocalMessages = () => {
        const chats = localDb.query("SELECT * FROM chats WHERE id = ?", [chatId]);
        const currentChat = chats[0];
        if (currentChat && currentChat.messages) {
          let updated = false;
          const updatedMessages = currentChat.messages.map((m) => {
            if (m.senderId !== currentUser.id && !m.seen) {
              m.seen = true;
              updated = true;
            }
            return m;
          });
          if (updated) {
            const allChats = localDb._getTable("chats");
            const idx = allChats.findIndex((c) => c.id === chatId);
            if (idx > -1) {
              allChats[idx].messages = updatedMessages;
              localDb._setTable("chats", allChats);
            }
          }
          setChat(currentChat);
        } else {
          setChat(currentChat || { messages: [] });
        }
      };

      fetchLocalMessages();
      window.addEventListener("local-db-update", fetchLocalMessages);
      return () => {
        window.removeEventListener("local-db-update", fetchLocalMessages);
      };
    }

    const unSub = onSnapshot(doc(db, "chats", chatId), async (res) => {
      const data = res.data();
      if (data && data.messages) {
        let updated = false;
        const updatedMessages = data.messages.map((m) => {
          if (m.senderId !== currentUser.id && !m.seen) {
            m.seen = true;
            updated = true;
          }
          return m;
        });

        if (updated) {
          try {
            await updateDoc(doc(db, "chats", chatId), {
              messages: updatedMessages,
            });
          } catch (err) {
            console.error("Failed to update messages seen status:", err);
          }
        }
      }
      setChat(data);
    });

    return () => {
      unSub();
    };
  }, [chatId, isLocalMode, currentUser.id]);

  // Start/stop recording logic and timer
  useEffect(() => {
    let timer;
    if (isRecording) {
      // Start the timer
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      // Stop the timer
      clearInterval(timer);
      setElapsedTime(0);
    }

    // Clean up on component unmount
    return () => clearInterval(timer);
  }, [isRecording]);

  // Format the time to "MM:SS"
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

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

    // Check if the file size is greater than 1MB
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Image size exceeds 1MB limit!"); // Show error toast
      return;
    }

    // If file is an image and size is under 1MB, set the image state and generate the URL for preview
    setImg({
      file: file,
      url: URL.createObjectURL(file),
    });

    toast.success("Image selected successfully!"); // Optional: show success toast on image selection
  };

  const handleDelete = async () => {
    if (!messageToDelete) return;

    if (isLocalMode) {
      const chats = localDb._getTable("chats");
      const chatIndex = chats.findIndex((c) => c.id === chatId);
      if (chatIndex > -1) {
        chats[chatIndex].messages = chats[chatIndex].messages.filter(
          (m) => m.createdAt !== messageToDelete.createdAt
        );
        localDb._setTable("chats", chats);
      }
      setMessageToDelete(null);
      setConfirmModal(false);
      return;
    }

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

      if (file.size > 1 * 1024 * 1024) {
        toast.error("File size exceeds 1MB limit!");
        return;
      }

      if (isLocalMode) {
        try {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            const fileBase64 = reader.result;
            const chats = localDb._getTable("chats");
            const chatIndex = chats.findIndex((c) => c.id === chatId);
            if (chatIndex > -1) {
              const newMsg = {
                senderId: currentUser.id,
                text: "",
                createdAt: new Date().toISOString(),
                img: fileBase64,
                type: file.type,
                seen: false
              };
              chats[chatIndex].messages.push(newMsg);
              localDb._setTable("chats", chats);

              updateUserChatsSummary("[File]");
            }
            toast.success("File attached successfully!");
            endRef.current?.scrollIntoView({ behavior: "smooth" });
          };
        } catch (error) {
          console.error("Local attachment error:", error);
          toast.error("Failed to attach file.");
        }
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
              seen: false
            },
          ],
        });

        await updateUserChatsSummary("[File]");
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

  const handleSend = async () => {
    if (!text.trim() && !img.file) return;

    if (isLocalMode) {
      const processSend = (imgBase64) => {
        const chats = localDb._getTable("chats");
        const chatIndex = chats.findIndex((c) => c.id === chatId);
        if (chatIndex > -1) {
          const newMsg = {
            senderId: currentUser.id,
            text,
            createdAt: new Date().toISOString(),
            seen: false,
            ...(imgBase64 && { img: imgBase64 }),
          };
          chats[chatIndex].messages.push(newMsg);
          localDb._setTable("chats", chats);

          updateUserChatsSummary(text || (imgBase64 ? "[Image]" : ""));

          if (!isGroup && user.id === "gemini_ai_id") {
            setTimeout(() => {
              triggerLocalGeminiResponse(chatId, [...chats[chatIndex].messages]);
            }, 1000);
          }
        }
        setText("");
        setImg({ file: null, url: "" });
        setUploadProgress(0);
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      };

      if (img.file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          processSend(reader.result);
        };
        reader.readAsDataURL(img.file);
      } else {
        processSend(null);
      }
      return;
    }

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
          seen: false,
          ...(imgUrl && { img: imgUrl }),
        }),
      });

      await updateUserChatsSummary(text || (imgUrl ? "[Image]" : ""));

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

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Your browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => chunks.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        chunks.current = [];
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start audio recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob) {
      toast.error("No audio file available.");
      return;
    }
  
    if (isLocalMode) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const audioBase64 = reader.result;
          const chats = localDb._getTable("chats");
          const chatIndex = chats.findIndex((c) => c.id === chatId);
          if (chatIndex > -1) {
            chats[chatIndex].messages.push({
              senderId: currentUser.id,
              text: "",
              createdAt: new Date().toISOString(),
              audio: audioBase64,
              type: "audio",
              seen: false
            });
            localDb._setTable("chats", chats);

            updateUserChatsSummary("[Voice Message]");
          }
          setAudioBlob(null);
          setAudioUrl(null);
          setUploadProgress(0);
          endRef.current?.scrollIntoView({ behavior: "smooth" });
        };
      } catch (err) {
        console.error("Local audio encoding error:", err);
        toast.error("Failed to process audio message.");
        setAudioBlob(null);
        setAudioUrl(null);
        setUploadProgress(0);
      }
      return;
    }

    try {
      console.log("audioBlob:", audioBlob);  // Debugging output
      
      // Upload audio file
      setUploadProgress(0);
      const audioUrl = await upload(audioBlob, (progress) => {
        setUploadProgress(progress); // Update progress
      });
  
      console.log("Uploaded Audio URL:", audioUrl); // Check if URL is returned
  
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text: "",
          createdAt: new Date(),
          audio: audioUrl,  // Use the uploaded audio URL
          type: "audio",
          seen: false
        }),
      });
  
      await updateUserChatsSummary("[Voice Message]");
      toast.success("Audio message sent!");
    } catch (error) {
      console.error("Error sending audio message:", error);
      toast.error("Failed to send audio message. Please try again.");
    } finally {
      setAudioBlob(null);
      setAudioUrl(null);
      setUploadProgress(0);
    }
  };

  const handleCall = () => {
    setConfirmModalCall(false);
    setCallboxVisible(true);
  };

  const handleVideo = () => {
    setConfirmModalVideo(false)
    setCallboxVisible(true);
  }

  const handleLinkedin= () => {
    setConfirmModalLinkedin(true);
  }
  const handleLinkedin1= () => {
    setConfirmModalCall(true);
  }
  const handleLinkedin2= () => {
    setConfirmModalVideo(true);
  }

  const handleCallClose = () => {
    // Small timeout to ensure smooth transition
    setTimeout(() => {
      setCallboxVisible(false);
      setConfirmModalCall(false);
      setConfirmModalVideo(false);
    }, 100);
  };

  const handleShareLink = useCallback(
    async (messagee) => {
      const generatedLink = `${messagee}`;

      console.log(generatedLink);

      if (isLocalMode) {
        const chats = localDb._getTable("chats");
        const chatIndex = chats.findIndex((c) => c.id === chatId);
        if (chatIndex > -1) {
          chats[chatIndex].messages.push({
            senderId: currentUser.id,
            text: generatedLink,
            createdAt: new Date().toISOString(),
            type: "link",
            seen: false
          });
          localDb._setTable("chats", chats);
          updateUserChatsSummary(generatedLink);
          toast.success("Link shared in chat!");
        }
        return;
      }

      try {
        await updateDoc(doc(db, "chats", chatId), {
          messages: arrayUnion({
            senderId: currentUser.id,
            text: generatedLink,
            createdAt: new Date(),
            type: "link",
            seen: false
          }),
        });
        await updateUserChatsSummary(generatedLink);
        toast.success("Link shared in chat!");
      } catch (error) {
        console.error("Error sharing link in chat:", error);
        toast.error("Failed to share link in chat. Please try again.");
      }
    },
    [currentUser.id, chatId, isLocalMode, isGroup, groupInfo, user]
  );

  const triggerLocalGeminiResponse = async (chatId, currentMessages) => {
    try {
      const formattedHistory = currentMessages.map(msg => ({
        role: msg.senderId === currentUser.id ? 'user' : 'model',
        parts: [{ text: msg.text || "" }]
      }));
      
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: formattedHistory })
      });

      const data = await response.json();
      const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

      const chats = localDb._getTable("chats");
      const chatIndex = chats.findIndex((c) => c.id === chatId);
      if (chatIndex > -1) {
        chats[chatIndex].messages.push({
          senderId: "gemini_ai_id",
          text: aiResponse,
          createdAt: new Date().toISOString(),
        });
        localDb._setTable("chats", chats);

        // Update userchats for both
        const userIDs = [currentUser.id, "gemini_ai_id"];
        userIDs.forEach((id) => {
          const userChats = localDb.getUserChats(id);
          const idx = userChats.findIndex((c) => c.chatId === chatId);
          if (idx > -1) {
            userChats[idx].lastMessage = aiResponse;
            userChats[idx].isSeen = id === "gemini_ai_id";
            userChats[idx].updatedAt = Date.now();
            localDb.updateUserChats(id, userChats);
          }
        });
      }
    } catch (error) {
      console.error("Local Gemini chat error:", error);
    }
  };

  const getHeaderName = () => {
    return isGroup ? (groupInfo?.groupName || "Group Chat") : (activeUser?.username || user?.username);
  };

  const getHeaderAvatar = () => {
    return isGroup ? (groupInfo?.groupAvatar || "./avatar2.png") : (activeUser?.avatar || user?.avatar || "./avatar2.png");
  };

  const getHeaderStatus = () => {
    if (isGroup) {
      if (groupMembers.length > 0) {
        return groupMembers.map(m => m.id === currentUser.id ? "You" : m.username).join(", ");
      }
      return "Loading group members...";
    }
    return activeUser?.isOnline ? "Online" : (activeUser?.status || "Hey! I'm using Chatapp");
  };

  const getSenderColor = (senderId) => {
    const colors = ["#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4", "#009688", "#4caf50", "#8bc34a", "#ff9800", "#ff5722"];
    let hash = 0;
    for (let i = 0; i < senderId.length; i++) {
      hash = senderId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
  };

  const getSenderName = (senderId) => {
    if (senderId === "system") return "";
    const member = groupMembers.find(m => m.id === senderId);
    return member ? member.username : "Group Member";
  };

  return (
    <div className="wa-chat">
      {/* ===== Header ===== */}
      <div className="wa-chat__header">
        <button className="wa-chat__back-btn" onClick={resetChat} title="Back to chats">
          ←
        </button>
        <div className="wa-chat__header-user">
          <img
            className="wa-chat__header-avatar"
            src={getHeaderAvatar()}
            alt=""
          />
          <div className="wa-chat__header-info">
            <span className="wa-chat__header-name">{getHeaderName()}</span>
            <p className="wa-chat__header-status">
              {getHeaderStatus()}
            </p>
          </div>
        </div>
        <div className="wa-chat__header-actions">
          <button className="wa-chat__icon-btn" onClick={handleLinkedin1} title="Audio call">
            <img src="./phone.png" alt="Phone" />
          </button>
          <button className="wa-chat__icon-btn" onClick={handleLinkedin2} title="Video call">
            <img src="./video.png" alt="Video" />
          </button>
          <button className="wa-chat__icon-btn" onClick={handleLinkedin} title="Info">
            <img src="./info.png" alt="Info" />
          </button>
        </div>
      </div>

      {/* ===== Messages ===== */}
      <div className="wa-chat__messages">
        {uploadProgress > 0 && <LoadingPopup progress={uploadProgress} />}

        {chat?.messages?.map((message) => (
          <div
            className={`wa-chat__message ${message.senderId === currentUser?.id ? "wa-chat__message--own" : ""} ${message.senderId === "system" ? "wa-chat__message--system" : ""}`}
            key={message.createdAt}
            onMouseEnter={() => setHoveredMessage(message)}
            onMouseLeave={() => setHoveredMessage(null)}
          >
            {message.senderId === "system" ? (
              <div className="wa-chat__system-message">
                <span>{message.text}</span>
              </div>
            ) : (
              <div className="wa-chat__bubble">
                {isGroup && message.senderId !== currentUser?.id && (
                  <span
                    className="wa-chat__sender-name"
                    style={{ color: getSenderColor(message.senderId) }}
                  >
                    {getSenderName(message.senderId)}
                  </span>
                )}
                {message.img && (
                  <img
                    className="wa-chat__bubble-img"
                    src={message.img}
                    alt="Image"
                    onError={(e) => (e.target.src = "attach.png")}
                  />
                )}
                {message.audio && (
                  <audio controls className="wa-chat__bubble-audio">
                    <source src={message.audio} type="audio/mp3" />
                    Your browser does not support the audio element.
                  </audio>
                )}
                {message.text && (
                  <p className="wa-chat__text">{message.text}</p>
                )}
                <span className="wa-chat__time">
                  {format(
                    message.createdAt?.toDate
                      ? message.createdAt.toDate()
                      : new Date(message.createdAt)
                  )}
                  {message.senderId === currentUser?.id && (
                    <span className={`wa-chat__ticks ${message.seen ? "wa-chat__ticks--read" : ""}`}>
                      {message.seen ? "✓✓" : (activeUser?.isOnline ? "✓✓" : "✓")}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Delete dropdown on hover for own messages */}
            {hoveredMessage === message && message.senderId === currentUser?.id && message.senderId !== "system" && (
              <div className="wa-chat__dropdown">
                <button className="wa-chat__dropdown-btn" onClick={() => openModal(message)}>
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Image preview before sending */}
        {img.url && (
          <div className="wa-chat__message wa-chat__message--own">
            <div className="wa-chat__bubble">
              <img className="wa-chat__bubble-img" src={img.url} alt="Preview" />
              <span className="wa-chat__preview-label">Preview</span>
            </div>
          </div>
        )}

        <div ref={endRef}></div>
      </div>

      {/* ===== Audio Recording Notification ===== */}
      {isRecording && (
        <div className="wa-chat__recording-bar">
          <div className="wa-chat__recording-dot"></div>
          <span className="wa-chat__recording-text">Recording audio...</span>
          <span className="wa-chat__recording-timer">{formatTime(elapsedTime)}</span>
        </div>
      )}

      {/* ===== Audio Preview ===== */}
      {audioBlob && (
        <div className="wa-chat__audio-preview">
          <audio controls className="wa-chat__audio-player">
            <source src={audioUrl} type="audio/webm" />
            Your browser does not support audio playback.
          </audio>
          <button className="wa-chat__audio-send" onClick={handleSendAudio}>Send</button>
          <button className="wa-chat__audio-discard" onClick={() => setAudioBlob(null)}>✕</button>
        </div>
      )}

      {/* ===== Input Area ===== */}
      <div className="wa-chat__input">
        <div className="wa-chat__input-icons">
          <label htmlFor="file" className="wa-chat__icon-btn" title="Send image">
            <img src="./img.png" alt="Image" />
          </label>
          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onChange={handleImg}
          />
          <button className="wa-chat__icon-btn" onClick={handleAttach} title="Attach file">
            <img src="./attach.png" alt="Attach" />
          </button>
          <button
            className={`wa-chat__icon-btn ${isRecording ? "wa-chat__icon-btn--recording" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? "Stop recording" : "Record audio"}
          >
            <img src="./mic.png" alt="Mic" />
          </button>
        </div>

        <input
          className="wa-chat__text-input"
          type="text"
          placeholder={
            isCurrentUserBlocked || isReceiverBlocked
              ? "You cannot send a message"
              : "Type a message..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        />

        <div className="wa-chat__emoji">
          <button className="wa-chat__icon-btn" onClick={() => setOpen((prev) => !prev)}>
            <img src="./emoji.png" alt="Emoji" />
          </button>
          <div className="wa-chat__emoji-picker">
            <EmojiPicker className="emoji1" open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>

        <button
          className="wa-chat__send-btn"
          onClick={handleSend}
          disabled={isCurrentUserBlocked || isReceiverBlocked}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
          </svg>
        </button>
      </div>

      {/* ===== Confirm Delete Modal ===== */}
      {confirmModal && (
        <div className="wa-chat__modal-overlay">
          <div className="wa-chat__modal">
            <h3 className="wa-chat__modal-title">Delete Message</h3>
            <p className="wa-chat__modal-text">
              Are you sure you want to permanently delete this message?
            </p>
            <div className="wa-chat__modal-actions">
              <button className="wa-chat__modal-btn wa-chat__modal-btn--cancel" onClick={() => setConfirmModal(false)}>
                Cancel
              </button>
              <button className="wa-chat__modal-btn wa-chat__modal-btn--danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LinkedIn Modal ===== */}
      {confirmModalLinkedin && (
        <div className="wa-chat__modal-overlay">
          <div className="wa-chat__modal">
            <h3 className="wa-chat__modal-title">Open External Link</h3>
            <p className="wa-chat__modal-text">
              This will take you to my LinkedIn page. Do you want to go?
            </p>
            <div className="wa-chat__modal-actions">
              <button className="wa-chat__modal-btn wa-chat__modal-btn--cancel" onClick={() => setConfirmModalLinkedin(false)}>
                Cancel
              </button>
              <button
                className="wa-chat__modal-btn wa-chat__modal-btn--confirm"
                onClick={() => {
                  window.open("https://www.linkedin.com/in/sukrit-chopra-5923a9215/");
                  setConfirmModalLinkedin(false);
                }}
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Video Call Modal ===== */}
      {confirmModalVideo && (
        <div className="wa-chat__modal-overlay">
          <div className="wa-chat__modal">
            <h3 className="wa-chat__modal-title">Video Call</h3>
            <p className="wa-chat__modal-text">
              Do you want to initiate a video call?
            </p>
            <div className="wa-chat__modal-actions">
              <button className="wa-chat__modal-btn wa-chat__modal-btn--cancel" onClick={() => setConfirmModalVideo(false)}>
                Cancel
              </button>
              <button className="wa-chat__modal-btn wa-chat__modal-btn--confirm" onClick={handleVideo}>
                Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Audio Call Modal ===== */}
      {confirmModalCall && (
        <div className="wa-chat__modal-overlay">
          <div className="wa-chat__modal">
            <h3 className="wa-chat__modal-title">Audio Call</h3>
            <p className="wa-chat__modal-text">
              Do you want to initiate an audio call?
            </p>
            <div className="wa-chat__modal-actions">
              <button className="wa-chat__modal-btn wa-chat__modal-btn--cancel" onClick={() => setConfirmModalCall(false)}>
                Cancel
              </button>
              <button className="wa-chat__modal-btn wa-chat__modal-btn--confirm" onClick={handleCall}>
                Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Callbox ===== */}
      {callboxVisible && (
        <Callbox
          onShareLink={handleShareLink}
          onClose={handleCallClose}
        />
      )}
    </div>
  );
};

export default Chat;
