import { useState } from "react";
import { useUserStore } from "../../../lib/userStore";
import { auth } from "../../../lib/firebase";
import { useChatStore } from "../../../lib/chatStore";
import Chatbot from "../../Chatbot/Chatbot";
import Stories from "../../stories/Stories";
import ProfileDrawer from "./ProfileDrawer";
import SqlConsole from "../../SqlConsole/SqlConsole";
import "./userInfo.css";

const UserInfo = () => {
  const { currentUser, isLocalMode, logoutGuest } = useUserStore();
  const { resetChat } = useChatStore();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("chat_app_dark_mode");
    if (saved !== null) {
      return saved === "true";
    }
    return !document.documentElement.classList.contains("light");
  });
  const [showChatbot, setShowChatbot] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSqlConsole, setShowSqlConsole] = useState(false);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("light");
      localStorage.setItem("chat_app_dark_mode", "false");
    } else {
      html.classList.remove("light");
      localStorage.setItem("chat_app_dark_mode", "true");
    }
    setIsDark(!isDark);
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      if (isLocalMode) {
        logoutGuest();
        resetChat();
      } else {
        auth.signOut();
        resetChat();
      }
    }
  };

  return (
    <>
      <div className="wa-header">
        <div className="wa-header__left">
          <img
            src={currentUser.avatar || "./avatar.png"}
            alt="User Avatar"
            className="wa-header__avatar"
            onClick={() => setShowProfile(true)}
            style={{ cursor: "pointer" }}
            title="View Profile"
          />
          <span className="wa-header__title" title={currentUser?.username || "ChatApp"}>
            {currentUser?.username || "ChatApp"}
          </span>
        </div>
        <div className="wa-header__actions">
          <button
            className="wa-header__icon-btn"
            onClick={toggleDarkMode}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
          <button
            className="wa-header__icon-btn"
            onClick={() => setShowSqlConsole(true)}
            title="Interactive SQL Console"
          >
            🗄️
          </button>
          <a
            href="https://github.com/nottysukku"
            target="_blank"
            rel="noopener noreferrer"
            className="wa-header__icon-btn"
            title="Developer's GitHub"
            style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            🐙
          </a>
          <button
            className="wa-header__icon-btn"
            onClick={() => setShowChatbot((prev) => !prev)}
            title="AI Assistant"
          >
            🤖
          </button>
          <button
            className="wa-header__icon-btn"
            onClick={() => setShowStories((prev) => !prev)}
            title="Status / Stories"
          >
            📢
          </button>
          <button
            className="wa-header__icon-btn"
            onClick={handleLogout}
            title="Logout"
          >
            🚪
          </button>
        </div>
      </div>
      <Chatbot isOpen={showChatbot} onClose={() => setShowChatbot(false)} />
      <Stories isOpen={showStories} onClose={() => setShowStories(false)} />
      <ProfileDrawer isOpen={showProfile} onClose={() => setShowProfile(false)} />
      <SqlConsole isOpen={showSqlConsole} onClose={() => setShowSqlConsole(false)} />
    </>
  );
};

export default UserInfo;