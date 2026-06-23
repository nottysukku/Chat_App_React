import { useState } from "react";
import { useUserStore } from "../../../lib/userStore";
import { auth } from "../../../lib/firebase";
import { useChatStore } from "../../../lib/chatStore";
import Chatbot from "../../Chatbot/Chatbot";
import Stories from "../../stories/Stories";
import "./userInfo.css";

const UserInfo = () => {
  const { currentUser, isLocalMode, logoutGuest } = useUserStore();
  const { resetChat } = useChatStore();
  const [isDark, setIsDark] = useState(!document.documentElement.classList.contains("light"));
  const [showChatbot, setShowChatbot] = useState(false);
  const [showStories, setShowStories] = useState(false);

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("light");
    } else {
      html.classList.remove("light");
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
          />
          <span className="wa-header__title">ChatApp</span>
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
    </>
  );
};

export default UserInfo;