import React, { useState, useEffect } from "react";
import { useUserStore } from "../../../lib/userStore";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "./userInfo.css";

const UserInfo = () => {
  const { currentUser } = useUserStore();
  const [status, setStatus] = useState("Hey! I'm using Chatapp.");
  const [username, setUsername] = useState(currentUser.username);
  const [avatar, setAvatar] = useState(currentUser.avatar || "./avatar.png");
  const [tempAvatar, setTempAvatar] = useState(null);
  const [isEditing, setIsEditing] = useState({
    status: false,
    username: false,
    avatar: false
  });
  const [loading, setLoading] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const docRef = doc(db, "users", currentUser.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setStatus(userData.status || "Hey! I'm using Chatapp.");
          setUsername(userData.username || currentUser.username);
          setAvatar(userData.avatar || "./avatar.png");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, [currentUser.id]);

  const handleSave = async (field) => {
    setLoading(true);
    try {
      const userDocRef = doc(db, "users", currentUser.id);
      const updateData = {};
      
      switch (field) {
        case 'status':
          updateData.status = status;
          break;
        case 'username':
          updateData.username = username;
          break;
        case 'avatar':
          updateData.avatar = tempAvatar;
          setAvatar(tempAvatar);
          break;
      }

      await setDoc(userDocRef, updateData, { merge: true });
      setIsEditing({ ...isEditing, [field]: false });
      setTempAvatar(null);
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempAvatar(reader.result);
        setIsEditing({ ...isEditing, avatar: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const cancelAvatarChange = () => {
    setTempAvatar(null);
    setIsEditing({ ...isEditing, avatar: false });
  };

  const handleGoToGitHub = () => {
    window.open("https://github.com/nottysukku", "_blank");
    setShowGitHubModal(false);
  };

  const handleGoToTodo = () => {
    window.open("https://to-do-list-five-self.vercel.app/", "_blank");
    setShowTodoModal(false);
  };

  const handleCloseModal = () => {
    setShowGitHubModal(false);
    setShowTodoModal(false);
  };

  return (
    <div className="userInfo">
      <div className="user">
        <div className="user-avatar">
          <img 
            src={tempAvatar || avatar} 
            alt="User Avatar" 
          />
          {!isEditing.avatar ? (
            <label className="avatar-edit-button">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <span className="edit-text">Edit</span>
            </label>
          ) : (
            <div className="avatar-buttons">
              <button
                onClick={() => handleSave('avatar')}
                className="save-avatar-btn"
                disabled={loading}
              >
                {loading ? "..." : "✓"}
              </button>
              <button
                onClick={cancelAvatarChange}
                className="cancel-avatar-btn"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {isEditing.username ? (
          <div className="username-edit">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button
              disabled={loading}
              onClick={() => handleSave('username')}
              className="save-username-btn"
            >
              {loading ? "..." : "✓"}
            </button>
            <button
              onClick={() => setIsEditing({ ...isEditing, username: false })}
              className="cancel-username-btn"
            >
              ×
            </button>
          </div>
        ) : (
          <h2 
            className="username-display"
            onClick={() => setIsEditing({ ...isEditing, username: true })}
          >
            {username}
          </h2>
        )}
      </div>

      <div className="status-section">
        {isEditing.status ? (
          <div className="status-edit">
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="Edit your status..."
            />
            <button
              disabled={loading}
              className="save-status-btn"
              onClick={() => handleSave('status')}
            >
              {loading ? "Saving..." : "Save Status"}
            </button>
            <button
              className="cancel-status-btn"
              onClick={() => setIsEditing({ ...isEditing, status: false })}
            >
              ×
            </button>
          </div>
        ) : (
          <div 
            className="status-display" 
            onClick={() => setIsEditing({ ...isEditing, status: true })}
          >
            <p>{status}</p>
          </div>
        )}
      </div>

      <div className="icons">
        <button
          className="icon-button"
          onClick={() => setShowGitHubModal(true)}
        >
          <img src="./more.png" alt="More Options" />
        </button>
        <button
          className="icon-button"
          onClick={() => setShowTodoModal(true)}
        >
          <img src="./edit.png" alt="Go to ToDo List" />
        </button>
      </div>

      {(showGitHubModal || showTodoModal) && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>
              {showGitHubModal 
                ? "This will take you to my GitHub page. Do you want to go?"
                : "This will help you complete your goals! Do you want to go?"}
            </h2>
            <div className="modal-actions">
              <button 
                className="yes-btn"
                onClick={showGitHubModal ? handleGoToGitHub : handleGoToTodo}
              >
                Yes
              </button>
              <button 
                className="no-btn"
                onClick={handleCloseModal}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserInfo;