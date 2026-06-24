import React, { useState } from "react";
import { useUserStore } from "../../../lib/userStore";
import upload from "../../../lib/upload";
import { toast } from "react-toastify";
import "./profileDrawer.css";

const ProfileDrawer = ({ isOpen, onClose }) => {
  const { currentUser, isLocalMode, updateUserInfo } = useUserStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser?.username || "");
  const [statusInput, setStatusInput] = useState(currentUser?.status || "");
  const [loading, setLoading] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem("chat_app_theme") || "theme-green");

  const themes = [
    { id: "theme-green", color: "#00a884", label: "Classic Teal" },
    { id: "theme-blue", color: "#34b7f1", label: "Cobalt Ocean" },
    { id: "theme-purple", color: "#a29bfe", label: "Royal Amethyst" },
    { id: "theme-amber", color: "#f39c12", label: "Desert Sunset" },
    { id: "theme-darkgreen", color: "#1b4332", label: "Forest Grove" }
  ];

  const handleThemeSelect = (themeId) => {
    setActiveTheme(themeId);
    localStorage.setItem("chat_app_theme", themeId);
    const isLight = document.documentElement.classList.contains("light");
    document.documentElement.className = themeId;
    if (isLight) {
      document.documentElement.classList.add("light");
    }
    toast.info(`Theme changed to ${themeId.replace("theme-", "").replace("-", " ")}!`);
  };

  if (!currentUser) return null;

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      if (isLocalMode) {
        // Read file as Base64 to persist avatar in LocalStorage
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Url = reader.result;
          await updateUserInfo({ avatar: base64Url });
          toast.success("Profile picture updated!");
          setLoading(false);
        };
        reader.readAsDataURL(file);
      } else {
        // Upload to Firebase Storage
        const downloadUrl = await upload(file);
        await updateUserInfo({ avatar: downloadUrl });
        toast.success("Profile picture updated!");
        setLoading(false);
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error("Failed to update profile picture.");
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      return toast.warn("Name cannot be empty!");
    }
    try {
      setLoading(true);
      await updateUserInfo({ username: nameInput });
      setIsEditingName(false);
      toast.success("Username updated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update username.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStatus = async () => {
    try {
      setLoading(true);
      await updateUserInfo({ status: statusInput });
      setIsEditingStatus(false);
      toast.success("Status updated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`wa-profile-drawer ${isOpen ? "wa-profile-drawer--open" : ""}`}>
      {/* Header */}
      <div className="wa-profile-drawer__header">
        <button className="wa-profile-drawer__back-btn" onClick={onClose} title="Back">
          ←
        </button>
        <span className="wa-profile-drawer__title">Profile</span>
      </div>

      {/* Content */}
      <div className="wa-profile-drawer__content">
        {/* Avatar Section */}
        <div className="wa-profile-drawer__avatar-container">
          <div className="wa-profile-drawer__avatar-wrapper">
            <img
              className="wa-profile-drawer__avatar"
              src={currentUser.avatar || "./avatar.png"}
              alt="Profile Avatar"
            />
            <label className="wa-profile-drawer__avatar-overlay" htmlFor="avatar-file-input">
              <span className="wa-profile-drawer__camera-icon">📷</span>
              <span className="wa-profile-drawer__overlay-text">CHANGE PROFILE PHOTO</span>
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
                disabled={loading}
              />
            </label>
          </div>
          {loading && <div className="wa-profile-drawer__avatar-loader">Updating...</div>}
        </div>

        {/* Name Section */}
        <div className="wa-profile-drawer__section">
          <label className="wa-profile-drawer__label">Your name</label>
          {isEditingName ? (
            <div className="wa-profile-drawer__edit-row">
              <input
                type="text"
                className="wa-profile-drawer__input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={25}
                autoFocus
              />
              <div className="wa-profile-drawer__edit-actions">
                <button
                  className="wa-profile-drawer__action-btn wa-profile-drawer__action-btn--cancel"
                  onClick={() => {
                    setNameInput(currentUser.username);
                    setIsEditingName(false);
                  }}
                >
                  ✕
                </button>
                <button
                  className="wa-profile-drawer__action-btn wa-profile-drawer__action-btn--save"
                  onClick={handleSaveName}
                  disabled={loading}
                >
                  ✓
                </button>
              </div>
            </div>
          ) : (
            <div className="wa-profile-drawer__display-row">
              <span className="wa-profile-drawer__value">{currentUser.username}</span>
              <button
                className="wa-profile-drawer__pencil-btn"
                onClick={() => setIsEditingName(true)}
                title="Edit Name"
              >
                ✏️
              </button>
            </div>
          )}
          <p className="wa-profile-drawer__hint">
            This is not your username or pin. This name will be visible to your ChatApp contacts.
          </p>
        </div>

        {/* Status / About Section */}
        <div className="wa-profile-drawer__section">
          <label className="wa-profile-drawer__label">About</label>
          {isEditingStatus ? (
            <div className="wa-profile-drawer__edit-row">
              <input
                type="text"
                className="wa-profile-drawer__input"
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <div className="wa-profile-drawer__edit-actions">
                <button
                  className="wa-profile-drawer__action-btn wa-profile-drawer__action-btn--cancel"
                  onClick={() => {
                    setStatusInput(currentUser.status || "");
                    setIsEditingStatus(false);
                  }}
                >
                  ✕
                </button>
                <button
                  className="wa-profile-drawer__action-btn wa-profile-drawer__action-btn--save"
                  onClick={handleSaveStatus}
                  disabled={loading}
                >
                  ✓
                </button>
              </div>
            </div>
          ) : (
            <div className="wa-profile-drawer__display-row">
              <span className="wa-profile-drawer__value">
                {currentUser.status || "Hey! I am using ChatApp."}
              </span>
              <button
                className="wa-profile-drawer__pencil-btn"
                onClick={() => setIsEditingStatus(true)}
                title="Edit About"
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        {/* Theme Customization Section */}
        <div className="wa-profile-drawer__section">
          <label className="wa-profile-drawer__label">Color Theme</label>
          <div className="wa-profile-drawer__theme-picker">
            {themes.map((t) => (
              <button
                key={t.id}
                className={`wa-profile-drawer__theme-dot ${activeTheme === t.id ? "wa-profile-drawer__theme-dot--active" : ""}`}
                style={{ backgroundColor: t.color }}
                onClick={() => handleThemeSelect(t.id)}
                title={t.label}
                type="button"
              />
            ))}
          </div>
        </div>

        {/* Developer Info Section */}
        <div className="wa-profile-drawer__section">
          <label className="wa-profile-drawer__label">Developer Links</label>
          <a
            href="https://github.com/nottysukku"
            target="_blank"
            rel="noopener noreferrer"
            className="wa-profile-drawer__github-link"
          >
            🐙 Visit my GitHub (@nottysukku)
          </a>
        </div>
      </div>
    </div>
  );
};

export default ProfileDrawer;
