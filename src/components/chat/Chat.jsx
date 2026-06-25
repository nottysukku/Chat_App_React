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
import { encrypt, decrypt, getChatKey } from "../../lib/encryption";
import BreakersGame from "./BreakersGame";
import { mysteryCases } from "../../lib/mysteryCases";

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

  // AI Boredom state
  const [isRoasting, setIsRoasting] = useState(false);
  const [roastBotName, setRoastBotName] = useState("");
  const [showGame, setShowGame] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [evaluatingVictory, setEvaluatingVictory] = useState(false);
  const [victoryFeedback, setVictoryFeedback] = useState("");
  const [victoryEvaluationResult, setVictoryEvaluationResult] = useState(null);

  // Calling Signaling State
  const [activeCallRoomId, setActiveCallRoomId] = useState(null);
  const [activeCallIsHost, setActiveCallIsHost] = useState(false);
  const [activeCallIsVideo, setActiveCallIsVideo] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const actionMenuRef = useRef(null);

  const updateUserChatsSummary = async (lastMsgText) => {
    const userIDs = isGroup ? (groupInfo?.members || []) : [currentUser.id, user.id];
    const encryptedLastMsg = encrypt(lastMsgText, getChatKey(chatId));
    
    // Always update local SQLite cache first so it's instantly available and updated offline
    userIDs.forEach((id) => {
      const userChats = localDb.getUserChats(id);
      const idx = userChats.findIndex((c) => c.chatId === chatId);
      if (idx > -1) {
        userChats[idx].lastMessage = encryptedLastMsg;
        userChats[idx].isSeen = id === currentUser.id;
        userChats[idx].updatedAt = Date.now();
        localDb.updateUserChats(id, userChats);
      } else {
        userChats.push({
          chatId,
          lastMessage: encryptedLastMsg,
          receiverId: isGroup ? null : (id === currentUser.id ? user.id : currentUser.id),
          updatedAt: Date.now(),
          isSeen: id === currentUser.id,
          isGroup: isGroup,
          groupName: isGroup ? groupInfo?.groupName : null,
          groupAvatar: isGroup ? groupInfo?.groupAvatar : null,
          members: isGroup ? groupInfo?.members : null
        });
        localDb.updateUserChats(id, userChats);
      }
    });

    if (isLocalMode || !onlineStatus) {
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
            userChatsData.chats[chatIndex].lastMessage = encryptedLastMsg;
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
    const handleOnline = () => {
      setOnlineStatus(true);
    };
    const handleOffline = () => {
      setOnlineStatus(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setShowMoreActions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  useEffect(() => {
    if (chatId && isGroup && groupInfo?.isAIBoredom && chat?.messages) {
      const systemMsgOnly = chat.messages.length === 1 && chat.messages[0].senderId === "system";
      if (systemMsgOnly && !isRoasting && groupInfo?.boredomType !== "mystery") {
        setTimeout(() => {
          triggerInitialBotQuestion();
        }, 1500);
      }
    }
  }, [chatId, isGroup, groupInfo, chat?.messages]);

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
    if (isLocalMode || !onlineStatus) {
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
        // Cache these messages in local SQLite database driver
        const localChats = localDb._getTable("chats");
        const idx = localChats.findIndex((c) => c.id === chatId);
        
        const cachedMessages = data.messages.map(msg => ({
          ...msg,
          createdAt: msg.createdAt?.toDate 
            ? msg.createdAt.toDate().toISOString() 
            : (msg.createdAt?.seconds 
               ? new Date(msg.createdAt.seconds * 1000).toISOString() 
               : (msg.createdAt || new Date().toISOString())),
          synced: true // Cloud Firestore messages are always synced
        }));

        if (idx > -1) {
          const localUnsynced = localChats[idx].messages.filter(m => m.synced === false);
          // Combine cloud messages with local unsynced messages
          localChats[idx].messages = [...cachedMessages, ...localUnsynced];
          localDb._setTable("chats", localChats);
        } else {
          localChats.push({
            id: chatId,
            createdAt: data.createdAt?.toDate 
              ? data.createdAt.toDate().toISOString() 
              : (data.createdAt?.seconds 
                 ? new Date(data.createdAt.seconds * 1000).toISOString() 
                 : (data.createdAt || new Date().toISOString())),
            messages: cachedMessages
          });
          localDb._setTable("chats", localChats);
        }

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
  }, [chatId, isLocalMode, currentUser.id, onlineStatus]);

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

    if (isLocalMode || !onlineStatus) {
      if (!onlineStatus && !isLocalMode) {
        toast.warn("Deleting messages is not supported while offline.");
        setMessageToDelete(null);
        setConfirmModal(false);
        return;
      }
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

      if (isLocalMode || !onlineStatus) {
        try {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            const fileBase64 = reader.result;
            const chats = localDb._getTable("chats");
            let chatIndex = chats.findIndex((c) => c.id === chatId);
            
            const encryptedImg = encrypt(fileBase64, getChatKey(chatId));
            const newMsg = {
              senderId: currentUser.id,
              text: "",
              createdAt: new Date().toISOString(),
              img: encryptedImg,
              type: file.type,
              seen: false,
              synced: isLocalMode ? true : false,
            };

            if (chatIndex > -1) {
              chats[chatIndex].messages.push(newMsg);
            } else {
              chats.push({
                id: chatId,
                createdAt: Date.now(),
                messages: [newMsg],
              });
              chatIndex = chats.length - 1;
            }
            localDb._setTable("chats", chats);

            updateUserChatsSummary("[File]");
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

        const encryptedFileUrl = encrypt(fileUrl, getChatKey(chatId));

        await updateDoc(doc(db, "chats", chatId), {
          messages: [
            ...chat.messages,
            {
              senderId: currentUser.id,
              text: "",
              createdAt: new Date(),
              img: encryptedFileUrl,
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

    if (isLocalMode || !onlineStatus) {
      const processSend = (imgBase64) => {
        const chats = localDb._getTable("chats");
        let chatIndex = chats.findIndex((c) => c.id === chatId);
        
        const encryptedText = encrypt(text, getChatKey(chatId));
        const encryptedImg = imgBase64 ? encrypt(imgBase64, getChatKey(chatId)) : null;
        const newMsg = {
          senderId: currentUser.id,
          text: encryptedText,
          createdAt: new Date().toISOString(),
          seen: false,
          ...(encryptedImg && { img: encryptedImg }),
          synced: isLocalMode ? true : false,
        };

        if (chatIndex > -1) {
          chats[chatIndex].messages.push(newMsg);
        } else {
          chats.push({
            id: chatId,
            createdAt: Date.now(),
            messages: [newMsg],
          });
          chatIndex = chats.length - 1;
        }
        localDb._setTable("chats", chats);

        updateUserChatsSummary(text || (imgBase64 ? "[Image]" : ""));

        if (isLocalMode) {
          if (!isGroup && user.id === "gemini_ai_id") {
            setTimeout(() => {
              triggerLocalGeminiResponse(chatId, [...chats[chatIndex].messages]);
            }, 1000);
          } else if (isGroup && groupInfo?.isAIBoredom) {
            setTimeout(() => {
              if (groupInfo?.boredomType === "mystery") {
                triggerAIBoredomMysterySequence([...chats[chatIndex].messages]);
              } else {
                triggerAIBoredomRoastSequence([...chats[chatIndex].messages]);
              }
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

      const encryptedText = encrypt(text, getChatKey(chatId));
      const encryptedImg = imgUrl ? encrypt(imgUrl, getChatKey(chatId)) : null;

      // Update chat messages in Firestore
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text: encryptedText,
          createdAt: new Date(),
          seen: false,
          ...(encryptedImg && { img: encryptedImg }),
        }),
      });

      await updateUserChatsSummary(text || (encryptedImg ? "[Image]" : ""));

      // Show success toast if image was uploaded
      if (img.file) {
        toast.success("Message with image sent successfully!");
      }

      if (isGroup && groupInfo?.isAIBoredom) {
        const docSnap = await getDoc(doc(db, "chats", chatId));
        const currentMessages = docSnap.data()?.messages || [];
        setTimeout(() => {
          if (groupInfo?.boredomType === "mystery") {
            triggerAIBoredomMysterySequence(currentMessages);
          } else {
            triggerAIBoredomRoastSequence(currentMessages);
          }
        }, 1000);
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
  
    if (isLocalMode || !onlineStatus) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const audioBase64 = reader.result;
          const chats = localDb._getTable("chats");
          let chatIndex = chats.findIndex((c) => c.id === chatId);
          
          const encryptedAudio = encrypt(audioBase64, getChatKey(chatId));
          const newMsg = {
            senderId: currentUser.id,
            text: "",
            createdAt: new Date().toISOString(),
            audio: encryptedAudio,
            type: "audio",
            seen: false,
            synced: isLocalMode ? true : false,
          };

          if (chatIndex > -1) {
            chats[chatIndex].messages.push(newMsg);
          } else {
            chats.push({
              id: chatId,
              createdAt: Date.now(),
              messages: [newMsg],
            });
            chatIndex = chats.length - 1;
          }
          localDb._setTable("chats", chats);

          updateUserChatsSummary("[Voice Message]");
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
  
      const encryptedAudioUrl = encrypt(audioUrl, getChatKey(chatId));
  
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text: "",
          createdAt: new Date(),
          audio: encryptedAudioUrl,  // Use the encrypted audio URL
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
    const roomId = `call_${chatId}_${Date.now()}`;
    setActiveCallRoomId(roomId);
    setActiveCallIsHost(true);
    setActiveCallIsVideo(false);
    setCallboxVisible(true);
    sendCallInvite(roomId, false);
  };

  const handleVideo = () => {
    setConfirmModalVideo(false);
    const roomId = `call_${chatId}_${Date.now()}`;
    setActiveCallRoomId(roomId);
    setActiveCallIsHost(true);
    setActiveCallIsVideo(true);
    setCallboxVisible(true);
    sendCallInvite(roomId, true);
  };

  const handleLinkedin= () => {
    setConfirmModalLinkedin(true);
  }
  const handleLinkedin1= () => {
    if (!isLocalMode && !onlineStatus) {
      toast.error("You cannot start voice calls while offline.");
      return;
    }
    setConfirmModalCall(true);
  }
  const handleLinkedin2= () => {
    if (!isLocalMode && !onlineStatus) {
      toast.error("You cannot start video calls while offline.");
      return;
    }
    setConfirmModalVideo(true);
  }

  const handleCallClose = () => {
    // Small timeout to ensure smooth transition
    setTimeout(() => {
      if (activeCallRoomId) {
        updateCallMessageStatus(activeCallRoomId, "ended");
      }
      setCallboxVisible(false);
      setConfirmModalCall(false);
      setConfirmModalVideo(false);
      setActiveCallRoomId(null);
    }, 100);
  };

  const handleShareLink = useCallback(
    async (messagee) => {
      const generatedLink = `${messagee}`;

      console.log(generatedLink);

      if (isLocalMode || !onlineStatus) {
        const chats = localDb._getTable("chats");
        let chatIndex = chats.findIndex((c) => c.id === chatId);
        const encryptedLink = encrypt(generatedLink, getChatKey(chatId));
        const newMsg = {
          senderId: currentUser.id,
          text: encryptedLink,
          createdAt: new Date().toISOString(),
          type: "link",
          seen: false,
          synced: isLocalMode ? true : false,
        };

        if (chatIndex > -1) {
          chats[chatIndex].messages.push(newMsg);
        } else {
          chats.push({
            id: chatId,
            createdAt: Date.now(),
            messages: [newMsg],
          });
          chatIndex = chats.length - 1;
        }
        localDb._setTable("chats", chats);
        updateUserChatsSummary(generatedLink);
        toast.success("Link shared in chat!");
        return;
      }

      try {
        const encryptedLink = encrypt(generatedLink, getChatKey(chatId));
        await updateDoc(doc(db, "chats", chatId), {
          messages: arrayUnion({
            senderId: currentUser.id,
            text: encryptedLink,
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
        parts: [{ text: decrypt(msg.text, getChatKey(chatId)) || "" }]
      }));
      
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: formattedHistory })
      });

      const data = await response.json();
      const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

      const chats = localDb._getTable("chats");
      const chatIndex = chats.findIndex((c) => c.id === chatId);
      if (chatIndex > -1) {
        const encryptedResponse = encrypt(aiResponse, getChatKey(chatId));
        chats[chatIndex].messages.push({
          senderId: "gemini_ai_id",
          text: encryptedResponse,
          createdAt: new Date().toISOString(),
        });
        localDb._setTable("chats", chats);

        // Update userchats for both
        const userIDs = [currentUser.id, "gemini_ai_id"];
        userIDs.forEach((id) => {
          const userChats = localDb.getUserChats(id);
          const idx = userChats.findIndex((c) => c.chatId === chatId);
          if (idx > -1) {
            userChats[idx].lastMessage = encryptedResponse;
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

  // --- AI Boredom Zone Game helpers ---

  const triggerInitialBotQuestion = async () => {
    if (!chatId || !groupInfo || isRoasting) return;

    const otherMembers = groupInfo.members.filter(mId => mId !== currentUser.id);
    if (otherMembers.length === 0) return;
    const botId = otherMembers[Math.floor(Math.random() * otherMembers.length)];
    const botUser = groupMembers.find(m => m.id === botId) || { username: "TrollBot", status: "Chilling" };

    setIsRoasting(true);
    setRoastBotName(botUser.username);

    try {
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const prompt = `You are a troll bot in a group chat named "AI Boredom Zone". You are speaking as user ${botUser.username} (status: "${botUser.status || ""}"). Ask the user ${currentUser.username} an open-ended, slightly cheeky, embarrassing or funny question on a random topic (e.g. why their username is weird, their coding skills, their fashion sense, what they do when they are bored, etc.). Keep it funny and witty. Keep it under 2 sentences. Target the user by their name @${currentUser.username}. Do not prefix your message with anything. Speak directly.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      const questionText = data?.candidates?.[0]?.content?.parts?.[0]?.text || `Hey @${currentUser.username}, tell us something boring.`;

      const encryptedText = encrypt(questionText, getChatKey(chatId));

      if (isLocalMode) {
        const chats = localDb._getTable("chats");
        const chatIndex = chats.findIndex((c) => c.id === chatId);
        if (chatIndex > -1) {
          chats[chatIndex].messages.push({
            senderId: botId,
            text: encryptedText,
            createdAt: new Date().toISOString(),
            seen: true
          });
          localDb._setTable("chats", chats);
          updateUserChatsSummary(questionText);
        }
      } else {
        await updateDoc(doc(db, "chats", chatId), {
          messages: arrayUnion({
            senderId: botId,
            text: encryptedText,
            createdAt: new Date(),
            seen: true
          })
        });
        await updateUserChatsSummary(questionText);
      }
    } catch (err) {
      console.error("Failed to trigger initial question:", err);
    } finally {
      setIsRoasting(false);
      setRoastBotName("");
    }
  };

  const triggerAIBoredomMysterySequence = async (currentMessages) => {
    if (!chatId || !groupInfo || isRoasting) return;

    const caseIndex = groupInfo.boredomCaseIndex !== undefined ? groupInfo.boredomCaseIndex : 0;
    const selectedCase = mysteryCases[caseIndex];
    if (!selectedCase) return;

    // Determine user's current progress: check how many clues have been decrypted in the history
    let progress = 0;
    const decryptedMessages = currentMessages.map(m => decrypt(m.text, getChatKey(chatId)) || "");
    for (let i = 0; i < selectedCase.clues.length; i++) {
      if (decryptedMessages.some(text => text.includes(selectedCase.clues[i]))) {
        progress = i + 1;
      }
    }

    // If already fully solved, user won! Exit out.
    if (progress >= selectedCase.clues.length) {
      return;
    }

    // Get the user's latest decrypted message
    const userLastMessageObj = [...currentMessages].reverse().find(m => m.senderId === currentUser.id);
    if (!userLastMessageObj) return;

    const userMessageText = (decrypt(userLastMessageObj.text, getChatKey(chatId)) || "").toLowerCase();
    const expectedKeyword = selectedCase.keywords[progress].toLowerCase();
    const keywordMatches = userMessageText.includes(expectedKeyword);

    // Select a random bot user to respond
    const otherMembers = groupInfo.members.filter(mId => mId !== currentUser.id);
    const botId = otherMembers[Math.floor(Math.random() * otherMembers.length)];
    const botUser = groupMembers.find(m => m.id === botId) || { username: "DetectiveBot", status: "Investigating" };

    setIsRoasting(true);
    setRoastBotName(botUser.username);

    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 2200));

    try {
      let replyText = "";
      if (keywordMatches) {
        // Correct keyword! Trigger next clue.
        replyText = selectedCase.clues[progress];
      } else {
        // Incorrect: try calling Gemini to keep the roleplay/atmosphere or fallback to a hint
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (geminiKey) {
          try {
            const prompt = `You are a helper witness or assistant in a cooperative group chat named "Mystery Case File". You are speaking as user ${botUser.username} (status: "${botUser.status || ""}"). You are investigating a murder mystery titled "${selectedCase.title}".
            Mystery Details: "${selectedCase.intro}"
            The clues discovered so far are:
            ${JSON.stringify(selectedCase.clues.slice(0, progress))}
            The player (${currentUser.username}) just asked/said: "${userMessageText}".
            Respond in character. Do NOT give away the secret keyword "${expectedKeyword}" or solve the mystery for them. If the user is close, give a gentle hint about it. Otherwise, steer their attention back to the current clues or suggest what to look at. Keep it under 2 sentences. Speak naturally.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
              })
            });

            const data = await response.json();
            replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          } catch (e) {
            console.error("Gemini failed, using fallback hint:", e);
          }
        }
        
        if (!replyText) {
          replyText = `Hmm... that didn't reveal anything new. Hint: ${selectedCase.hints[progress]}`;
        }
      }

      const encryptedText = encrypt(replyText, getChatKey(chatId));

      if (isLocalMode) {
        const chats = localDb._getTable("chats");
        const chatIndex = chats.findIndex((c) => c.id === chatId);
        if (chatIndex > -1) {
          chats[chatIndex].messages.push({
            senderId: botId,
            text: encryptedText,
            createdAt: new Date().toISOString(),
            seen: true
          });
          localDb._setTable("chats", chats);
          updateUserChatsSummary(replyText);
        }
      } else {
        await updateDoc(doc(db, "chats", chatId), {
          messages: arrayUnion({
            senderId: botId,
            text: encryptedText,
            createdAt: new Date(),
            seen: true
          })
        });
        await updateUserChatsSummary(replyText);
      }
    } catch (err) {
      console.error("Mystery loop error:", err);
    } finally {
      setIsRoasting(false);
      setRoastBotName("");
    }
  };

  const triggerAIBoredomRoastSequence = async (currentMessages) => {
    if (!chatId || !groupInfo || isRoasting) return;

    const otherMembers = groupInfo.members.filter(mId => mId !== currentUser.id);
    if (otherMembers.length === 0) return;

    // Pick 2 random bots to roast sequentially
    const bot1Id = otherMembers[Math.floor(Math.random() * otherMembers.length)];
    let bot2Id = otherMembers[Math.floor(Math.random() * otherMembers.length)];
    if (otherMembers.length > 1 && bot2Id === bot1Id) {
      bot2Id = otherMembers.find(mId => mId !== bot1Id);
    }

    const bot1 = groupMembers.find(m => m.id === bot1Id) || { username: "Roaster1", status: "Roasting" };
    const bot2 = groupMembers.find(m => m.id === bot2Id) || { username: "Roaster2", status: "Roasting" };

    const runBotRoast = async (botId, botUser, messagesSnapshot) => {
      setIsRoasting(true);
      setRoastBotName(botUser.username);

      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, 2200));

      try {
        const historyText = messagesSnapshot.slice(-10).map(msg => {
          const senderName = msg.senderId === currentUser.id ? currentUser.username : (groupMembers.find(m => m.id === msg.senderId)?.username || "Bot");
          const decryptedText = decrypt(msg.text, getChatKey(chatId)) || "";
          return `${senderName}: ${decryptedText}`;
        }).join("\n");

        const prompt = `You are a troll bot in a group chat named "AI Boredom Zone". The chat members are roasting each other. You are speaking as ${botUser.username} (status: "${botUser.status || ""}"). Roast and mock the user ${currentUser.username}'s latest reply based on the chat history. Keep it extremely sarcastic, funny, and witty. You can agree with other bots or add your own roast. Keep your reply under 2 sentences. Do not mention that you are an AI. Speak naturally.
        Chat History:
        ${historyText}`;

        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const data = await response.json();
        const roastText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Wow, press F to pay respects.";

        const encryptedText = encrypt(roastText, getChatKey(chatId));

        if (isLocalMode) {
          const chats = localDb._getTable("chats");
          const chatIndex = chats.findIndex((c) => c.id === chatId);
          if (chatIndex > -1) {
            chats[chatIndex].messages.push({
              senderId: botId,
              text: encryptedText,
              createdAt: new Date().toISOString(),
              seen: true
            });
            localDb._setTable("chats", chats);
            updateUserChatsSummary(roastText);
          }
        } else {
          await updateDoc(doc(db, "chats", chatId), {
            messages: arrayUnion({
              senderId: botId,
              text: encryptedText,
              createdAt: new Date(),
              seen: true
            })
          });
          await updateUserChatsSummary(roastText);
        }
      } catch (err) {
        console.error("Roast error for " + botUser.username, err);
      }
    };

    // Bot 1 roasts
    await runBotRoast(bot1Id, bot1, currentMessages);

    // Wait and then Bot 2 roasts with refreshed snapshot
    let updatedMessagesList = [];
    if (isLocalMode) {
      const chats = localDb._getTable("chats");
      const currentChat = chats.find(c => c.id === chatId);
      updatedMessagesList = currentChat ? currentChat.messages : [];
    } else {
      const snap = await getDoc(doc(db, "chats", chatId));
      updatedMessagesList = snap.data()?.messages || [];
    }

    await runBotRoast(bot2Id, bot2, updatedMessagesList);

    setIsRoasting(false);
    setRoastBotName("");
  };

  const handleEvaluateVictory = async () => {
    if (!chat || !chat.messages) return;
    setEvaluatingVictory(true);
    setShowVictoryModal(true);
    setVictoryFeedback("");
    setVictoryEvaluationResult(null);

    // Intercept if this is a mystery text game
    if (groupInfo?.boredomType === "mystery") {
      const caseIndex = groupInfo.boredomCaseIndex !== undefined ? groupInfo.boredomCaseIndex : 0;
      const selectedCase = mysteryCases[caseIndex];
      if (selectedCase) {
        let progress = 0;
        const decryptedMessages = chat.messages.map(m => decrypt(m.text, getChatKey(chatId)) || "");
        for (let i = 0; i < selectedCase.clues.length; i++) {
          if (decryptedMessages.some(text => text.includes(selectedCase.clues[i]))) {
            progress = i + 1;
          }
        }

        const won = progress >= selectedCase.clues.length;
        setVictoryEvaluationResult(won ? "won" : "lost");
        setVictoryFeedback(
          won 
            ? `Congratulations! You successfully uncovered all clues and solved "${selectedCase.title}" by identifying the culprit: ${selectedCase.answer.toUpperCase()}. Excellent detective work!` 
            : `You have not solved the case yet. You need to ask more questions and find the secret keywords to uncover clues! (Currently at clue ${progress}/${selectedCase.clues.length})`
        );
        setEvaluatingVictory(false);
        return;
      }
    }

    try {
      const historyText = chat.messages.map(msg => {
        const senderName = msg.senderId === "system" ? "System" : 
          (msg.senderId === currentUser.id ? currentUser.username : 
          (groupMembers.find(m => m.id === msg.senderId)?.username || "Bot"));
        const decryptedText = decrypt(msg.text, getChatKey(chatId)) || "";
        return `${senderName}: ${decryptedText}`;
      }).join("\n");

      const prompt = `Analyze this group chat conversation between a user (${currentUser.username}) and several roasting AI bots in a chat called "AI Boredom Zone". 
      Determine if the user won the roast battle (e.g. by making funny/witty comebacks, roasting the bots back successfully, or standing their ground with humor) or if they lost (got roasted into oblivion, got defensive, got angry, or made boring/generic replies). 
      You MUST return a JSON object with exactly two keys: "won" (boolean) and "feedback" (string, explaining in a funny, sassy, sarcastic tone in 2 sentences why they won or lost). Do not return markdown, do not wrap in backticks, just raw JSON.
      
      Conversation History:
      ${historyText}`;

      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{"won": false, "feedback": "Connection lost. Try again."}';
      
      rawText = rawText.trim();
      if (rawText.startsWith("```json")) {
        rawText = rawText.substring(7, rawText.length - 3).trim();
      } else if (rawText.startsWith("```")) {
        rawText = rawText.substring(3, rawText.length - 3).trim();
      }

      const evaluationObj = JSON.parse(rawText);
      setVictoryEvaluationResult(evaluationObj.won ? "won" : "lost");
      setVictoryFeedback(evaluationObj.feedback || "");
    } catch (err) {
      console.error("Victory evaluation error:", err);
      setVictoryEvaluationResult("lost");
      setVictoryFeedback("The referee bots decided you lost because of API errors. Sucks to be you!");
    } finally {
      setEvaluatingVictory(false);
    }
  };

  const handleEscapeSuccess = async () => {
    try {
      if (isLocalMode) {
        let chats = localDb._getTable("chats");
        chats = chats.filter(c => c.id !== chatId);
        localDb._setTable("chats", chats);

        const userchats = JSON.parse(localStorage.getItem("sqlite_userchats") || "{}");
        if (userchats[currentUser.id]) {
          userchats[currentUser.id].chats = userchats[currentUser.id].chats.filter(c => c.chatId !== chatId);
          localStorage.setItem("sqlite_userchats", JSON.stringify(userchats));
        }
        window.dispatchEvent(new CustomEvent("local-db-update"));
      } else {
        const userChatsRef = doc(db, "userchats", currentUser.id);
        const snap = await getDoc(userChatsRef);
        if (snap.exists()) {
          const updatedChats = snap.data().chats.filter(c => c.chatId !== chatId);
          await updateDoc(userChatsRef, { chats: updatedChats });
        }
      }
      toast.success("Successfully exited the Boredom Zone and kicked everyone out!");
    } catch (err) {
      console.error("Error exiting group:", err);
    } finally {
      setShowGame(false);
      setShowVictoryModal(false);
      resetChat();
    }
  };

  const syncOfflineMessages = async () => {
    if (isLocalMode || !navigator.onLine) return;

    try {
      const chats = localDb._getTable("chats");
      let totalSynced = 0;

      for (let i = 0; i < chats.length; i++) {
        const localChat = chats[i];
        const unsyncedMessages = localChat.messages.filter(m => m.synced === false);
        if (unsyncedMessages.length === 0) continue;

        const chatRef = doc(db, "chats", localChat.id);
        const docSnap = await getDoc(chatRef);
        if (!docSnap.exists()) continue;

        const syncedMessages = unsyncedMessages.map(m => {
          const firestoreMsg = {
            senderId: m.senderId,
            text: m.text,
            createdAt: new Date(m.createdAt),
            seen: m.seen,
          };
          if (m.img) firestoreMsg.img = m.img;
          if (m.audio) firestoreMsg.audio = m.audio;
          if (m.type) firestoreMsg.type = m.type;
          if (m.callRoomId) firestoreMsg.callRoomId = m.callRoomId;
          if (m.callActive !== undefined) firestoreMsg.callActive = m.callActive;
          if (m.callStatus) firestoreMsg.callStatus = m.callStatus;
          return firestoreMsg;
        });

        await updateDoc(chatRef, {
          messages: arrayUnion(...syncedMessages)
        });

        chats[i].messages = chats[i].messages.map(m => {
          if (m.synced === false) {
            m.synced = true;
          }
          return m;
        });
        totalSynced += unsyncedMessages.length;
      }

      if (totalSynced > 0) {
        localDb._setTable("chats", chats);
        toast.success(`✅ Synced ${totalSynced} offline messages successfully!`);
      }
    } catch (err) {
      console.error("Failed to sync offline messages:", err);
      toast.error("Failed to sync some offline messages. Retrying later.");
    }
  };

  useEffect(() => {
    if (onlineStatus) {
      const timer = setTimeout(() => {
        syncOfflineMessages();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [onlineStatus]);

  const sendCallInvite = async (callRoomId, isVideo) => {
    const inviteText = isVideo ? "🎥 Video Call" : "📞 Voice Call";
    const encryptedText = encrypt(inviteText, getChatKey(chatId));
    
    if (isLocalMode) {
      const chats = localDb._getTable("chats");
      const chatIndex = chats.findIndex((c) => c.id === chatId);
      if (chatIndex > -1) {
        const newMsg = {
          senderId: currentUser.id,
          text: encryptedText,
          type: "call-invite",
          callRoomId: callRoomId,
          callActive: true,
          isVideo: isVideo,
          callStatus: "ringing",
          createdAt: new Date().toISOString(),
          seen: false
        };
        chats[chatIndex].messages.push(newMsg);
        localDb._setTable("chats", chats);
        updateUserChatsSummary(inviteText);
      }
      return;
    }

    // Cloud Mode
    try {
      await updateDoc(doc(db, "chats", chatId), {
        messages: arrayUnion({
          senderId: currentUser.id,
          text: encryptedText,
          type: "call-invite",
          callRoomId: callRoomId,
          callActive: true,
          isVideo: isVideo,
          callStatus: "ringing",
          createdAt: new Date(),
          seen: false
        }),
      });
      await updateUserChatsSummary(inviteText);
    } catch (err) {
      console.error("Failed to send call invite:", err);
    }
  };

  const updateCallMessageStatus = async (targetRoomId, newStatus) => {
    if (!targetRoomId) return;
    if (isLocalMode) {
      const chats = localDb._getTable("chats");
      const chatIndex = chats.findIndex((c) => c.id === chatId);
      if (chatIndex > -1) {
        let updated = false;
        chats[chatIndex].messages = chats[chatIndex].messages.map((m) => {
          if (m.type === "call-invite" && m.callRoomId === targetRoomId) {
            m.callActive = false;
            m.callStatus = newStatus;
            updated = true;
          }
          return m;
        });
        if (updated) {
          localDb._setTable("chats", chats);
        }
      }
      return;
    }

    // Cloud Mode
    try {
      const chatRef = doc(db, "chats", chatId);
      const docSnap = await getDoc(chatRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        let updated = false;
        const updatedMessages = data.messages.map((m) => {
          if (m.type === "call-invite" && m.callRoomId === targetRoomId) {
            m.callActive = false;
            m.callStatus = newStatus;
            updated = true;
          }
          return m;
        });
        if (updated) {
          await updateDoc(chatRef, { messages: updatedMessages });
        }
      }
    } catch (err) {
      console.error("Failed to update call status:", err);
    }
  };

  const handleBack = () => {
    if (isGroup && groupInfo?.isAIBoredom) {
      toast.warn(groupInfo?.boredomType === "mystery" 
        ? "🔎 You cannot leave the Mystery Room so easily! Solve the mystery or play Breakers to escape."
        : "😈 You cannot leave the Boredom Zone so easily! Click 'End Chat Game' to escape."
      );
      return;
    }
    resetChat();
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

  const userMessagesCount = chat?.messages?.filter(m => m.senderId === currentUser?.id).length || 0;
  const showEndGameButton = isGroup && groupInfo?.isAIBoredom && userMessagesCount >= 3;

  return (
    <div className="wa-chat">
      {/* ===== Header ===== */}
      <div className="wa-chat__header">
        <button className="wa-chat__back-btn" onClick={handleBack} title="Back to chats">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
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
              {!onlineStatus && <span style={{ color: "#ff9800", fontWeight: "bold", marginRight: "6px" }} title="Pending Offline Sync">⚠️ Offline |</span>}
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
            className={`wa-chat__message ${message.senderId === currentUser?.id ? "wa-chat__message--own" : ""} ${message.senderId === "system" ? "wa-chat__message--system" : ""} ${message.type === "call-invite" ? "wa-chat__message--call-invite" : ""}`}
            key={message.createdAt}
            onMouseEnter={() => setHoveredMessage(message)}
            onMouseLeave={() => setHoveredMessage(null)}
          >
            {message.type === "call-invite" ? (
              <div className="wa-chat__call-card">
                <div className="wa-chat__call-card-icon-wrapper">
                  <span className="wa-chat__call-card-icon">{message.isVideo ? "🎥" : "📞"}</span>
                </div>
                <div className="wa-chat__call-card-content">
                  <span className="wa-chat__call-card-title">
                    {message.isVideo ? "Video Call" : "Voice Call"}
                  </span>
                  <span className="wa-chat__call-card-status">
                    {message.callActive 
                      ? (message.senderId === currentUser.id ? "Outgoing call..." : "Incoming call...") 
                      : (message.callStatus === "ended" ? "Call Ended" : 
                         message.callStatus === "declined" ? "Call Declined" : 
                         message.callStatus === "cancelled" ? "Call Cancelled" : "Missed Call")
                    }
                  </span>
                </div>
                {message.callActive && (
                  <div className="wa-chat__call-card-actions">
                    {message.senderId !== currentUser.id ? (
                      <>
                        <button 
                          className="wa-chat__call-btn wa-chat__call-btn--accept" 
                          onClick={() => {
                            setActiveCallRoomId(message.callRoomId);
                            setActiveCallIsHost(false);
                            setActiveCallIsVideo(message.isVideo);
                            setCallboxVisible(true);
                          }}
                        >
                          Accept
                        </button>
                        <button 
                          className="wa-chat__call-btn wa-chat__call-btn--decline" 
                          onClick={() => updateCallMessageStatus(message.callRoomId, "declined")}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <button 
                        className="wa-chat__call-btn wa-chat__call-btn--cancel" 
                        onClick={() => updateCallMessageStatus(message.callRoomId, "cancelled")}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : message.senderId === "system" ? (
              <div className="wa-chat__system-message">
                <span>{decrypt(message.text, getChatKey(chatId))}</span>
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
                    src={decrypt(message.img, getChatKey(chatId))}
                    alt="Image"
                    onError={(e) => (e.target.src = "attach.png")}
                  />
                )}
                {message.audio && (
                  <audio controls className="wa-chat__bubble-audio" src={decrypt(message.audio, getChatKey(chatId))}>
                    Your browser does not support the audio element.
                  </audio>
                )}
                {message.text && (
                  <p className="wa-chat__text">{decrypt(message.text, getChatKey(chatId))}</p>
                )}
                <span className="wa-chat__time">
                  {format(
                    message.createdAt?.toDate
                      ? message.createdAt.toDate()
                      : new Date(message.createdAt)
                  )}
                  {message.senderId === currentUser?.id && (
                    <span className={`wa-chat__ticks ${message.seen ? "wa-chat__ticks--read" : ""}`}>
                      {message.synced === false ? (
                        <span style={{ fontSize: "0.95em", marginRight: "2px" }} title="Pending Offline Sync">⏳</span>
                      ) : (
                        message.seen ? "✓✓" : (activeUser?.isOnline ? "✓✓" : "✓")
                      )}
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

        {isRoasting && (
          <div className="wa-chat__message wa-chat__message--bot wa-chat__roast-typing">
            <span className="wa-chat__roast-typing-name">{roastBotName} is typing...</span>
            <div className="wa-chat__bubble wa-chat__typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        {showEndGameButton && !isRoasting && (
          <div className="wa-chat__boredom-escape-banner">
            <span>💥 Ready to escape the AI Boredom Zone?</span>
            <button className="wa-chat__boredom-escape-btn" onClick={handleEvaluateVictory}>
              End Chat Game
            </button>
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
        <div ref={actionMenuRef} className={`wa-chat__input-icons ${showMoreActions ? "wa-chat__input-icons--expanded" : ""}`}>
          <button
            className="wa-chat__icon-btn wa-chat__toggle-actions-btn"
            onClick={() => setShowMoreActions((prev) => !prev)}
            title="More actions"
          >
            <span style={{
              fontSize: "24px",
              lineHeight: 1,
              transition: "transform var(--transition-fast)",
              transform: showMoreActions ? "rotate(45deg)" : "rotate(0deg)",
              display: "inline-block"
            }}>+</span>
          </button>
          <div className="wa-chat__action-buttons">
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
          <button className="wa-chat__icon-btn wa-chat__emoji-btn" onClick={() => setOpen((prev) => !prev)}>
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
          roomId={activeCallRoomId}
          isHost={activeCallIsHost}
          isVideoCall={activeCallIsVideo}
          onShareLink={handleShareLink}
          onClose={handleCallClose}
        />
      )}

      {/* ===== AI Boredom Escape / Victory Modal ===== */}
      {showVictoryModal && (
        <div className="wa-chat__modal-overlay">
          <div className="wa-chat__modal wa-chat__modal--boredom">
            <h3 className="wa-chat__modal-title">{groupInfo?.boredomType === "mystery" ? "Escape Mystery Room" : "Escape AI Boredom Zone"}</h3>
            
            {evaluatingVictory ? (
              <div className="wa-chat__modal-evaluating">
                <div className="wa-chat__spinner"></div>
                <p>{groupInfo?.boredomType === "mystery" ? "Verifying case clues..." : "Analyzing conversation roast balance via Gemini AI..."}</p>
              </div>
            ) : victoryEvaluationResult === null ? (
              <>
                <p className="wa-chat__modal-text">
                  {groupInfo?.boredomType === "mystery" 
                    ? "Choose how you want to exit. You can claim victory (and see if you successfully solved the mystery case) or admit defeat immediately (which triggers the Breakers brick game)."
                    : "Choose how you want to exit. You can claim victory (and let Gemini decide if you roasted them back successfully) or admit defeat immediately (which triggers the Breakers brick game)."}
                </p>
                <div className="wa-chat__modal-actions wa-chat__modal-actions--column">
                  <button className="wa-chat__modal-btn wa-chat__modal-btn--victory" onClick={handleEvaluateVictory}>
                    {groupInfo?.boredomType === "mystery" ? "🏆 Claim Victory (Check Case)" : "🏆 Claim Victory (AI Evaluation)"}
                  </button>
                  <button className="wa-chat__modal-btn wa-chat__modal-btn--defeat" onClick={() => { setShowVictoryModal(false); setShowGame(true); }}>
                    🏳️ Admit Defeat (Play Breakers)
                  </button>
                  <button className="wa-chat__modal-btn wa-chat__modal-btn--cancel" onClick={() => setShowVictoryModal(false)}>
                    Stay in Chat
                  </button>
                </div>
              </>
            ) : victoryEvaluationResult === "won" ? (
              <>
                <div className="wa-chat__modal-result-icon">🏆</div>
                <h4 className="wa-chat__modal-subtitle" style={{ color: "#10b981" }}>
                  {groupInfo?.boredomType === "mystery" ? "Case Solved Successfully!" : "Gemini Declared You Winner!"}
                </h4>
                <p className="wa-chat__modal-feedback">"{victoryFeedback}"</p>
                <div className="wa-chat__modal-actions">
                  <button className="wa-chat__modal-btn wa-chat__modal-btn--exit-group" onClick={handleEscapeSuccess}>
                    Close Case & Exit
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="wa-chat__modal-result-icon">{groupInfo?.boredomType === "mystery" ? "🔎" : "💀"}</div>
                <h4 className="wa-chat__modal-subtitle" style={{ color: "#ef4444" }}>
                  {groupInfo?.boredomType === "mystery" ? "Case Unsolved!" : "You got roasted into oblivion!"}
                </h4>
                <p className="wa-chat__modal-feedback">"{victoryFeedback}"</p>
                <p className="wa-chat__modal-text" style={{ fontSize: "12px", marginTop: "8px" }}>
                  {groupInfo?.boredomType === "mystery" 
                    ? "You haven't uncovered all the clues yet. To escape, you must now play the Breakers brick game!"
                    : "Gemini decided your roasts were too weak. To escape, you must now play the Breakers brick game!"}
                </p>
                <div className="wa-chat__modal-actions">
                  <button className="wa-chat__modal-btn wa-chat__modal-btn--defeat" onClick={() => { setShowVictoryModal(false); setShowGame(true); }}>
                    Play Breakers Game
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Breakers Game Modal ===== */}
      {showGame && (
        <BreakersGame onSuccess={handleEscapeSuccess} />
      )}
    </div>
  );
};

export default Chat;
