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
  const { currentUser } = useUserStore();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const chunks = useRef([]);
  const [elapsedTime, setElapsedTime] = useState(0);

  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } = useChatStore();
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

    // Check if the file size is greater than 3MB
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Image size exceeds 1MB limit!"); // Show error toast
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

      if (file.size > 1 * 1024 * 1024) {
        toast.error("File size exceeds 1MB limit!");
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
        }),
      });
  
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
  setConfirmModalCall(false)
}

const handleVideo = () => {
  setConfirmModalVideo(false)
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

  return (
    <div className="chat">
      <div className="top">
        <div className="user">
          <img src={user?.avatar || "./avatar2.png"} alt="" />
          <div className="texts">
            <span>{user?.username}</span>
            <p>{user?.status || "Hey! I'm using Chatapp"}</p>
          </div>
        </div>
        <div className="icons">
          <img id="linked" onClick={handleLinkedin1} src="./phone.png" alt="" />
          <img id="linked" onClick={handleLinkedin2} src="./video.png" alt="" />
          {/* <img id="linked" src="./info.png" onClick={() => window.open("https://www.linkedin.com/in/sukrit-chopra-5923a9215/")} alt="" /> */}
          <img id="linked" src="./info.png" onClick={handleLinkedin} alt="" />
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
                  alt="Image"
                  onError={(e) => (e.target.src = "attach.png")}
                />
              )}
              {message.audio && (
                <audio controls>
                  <source src={message.audio} type="audio/mp3" />
                  Your browser does not support the audio element.
                </audio>
              )}
              <p>{message.text}</p>
              <span>{format(message.createdAt.toDate())}</span>
            </div>
            {hoveredMessage === message && message.senderId === currentUser?.id && (
              <div className="dropdown">
                <button id="delete" onClick={() => openModal(message)}>
                  Delete
                </button>
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
          <input type="file" id="file" style={{ display: "none" }} onChange={handleImg} />
          <img style={{ filter: "invert(1)" }} src="./attach.png" alt="" onClick={handleAttach} />
          <img
            src="./mic.png"
            alt="Record Audio"
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              filter: isRecording ? "invert(1)" : "none",
              animation: isRecording ? "micAnimation 1s infinite" : "",
            }}
          />
          {audioBlob && (
            <div className="message own">
              <audio controls>
                <source src={audioUrl} type="audio/webm" />
                Your browser does not support audio playback.
              </audio>
              <button onClick={handleSendAudio}>Send Audio</button>
              <button className="close-btn" onClick={() => setAudioBlob(null)}>
                ✕
              </button>
            </div>
          )}
          {isRecording && (
  <div className="audio-recording-notification">
    <span>AUDIO IS BEING RECORDED!</span>
    {/* Ensure the timer visibility */}
    <div className="audio-timer">
      {formatTime(elapsedTime)} {/* Display elapsed time */}
    </div>
  </div>
)}
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
        <button className="sendButton" onClick={handleSend}>
          Send
        </button>
      </div>

      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>ARE YOU SURE YOU WANT TO PERMANENTLY DELETE THIS MESSAGE?</h2>
            <div className="modal-actions">
              <button className="yes-btn" onClick={handleDelete}>
                Yes
              </button>
              <button className="no-btn" onClick={() => setConfirmModal(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmModalLinkedin && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>This will take you to my Linkedin page. Do you want to go?</h2>
            <div className="modal-actions">
              <button className="yes-btn" onClick={() => {window.open("https://www.linkedin.com/in/sukrit-chopra-5923a9215/")
              setConfirmModalLinkedin(false)
              }}>
                Yes
              </button>
              <button className="no-btn" onClick={() => setConfirmModalLinkedin(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}

{confirmModalVideo && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>Do you want to initiate a video call?</h2>
            <div className="modal-actions">
              <button className="yes-btn" onClick={handleVideo}>
                Yes
              </button>
              <button className="no-btn" onClick={() => setConfirmModalVideo(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}

{confirmModalCall && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>Do you want to initiate an audio call?</h2>
            <div className="modal-actions">
              <button className="yes-btn" onClick={handleCall}>
                Yes
              </button>
              <button className="no-btn" onClick={() => setConfirmModalCall(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
