import React, { useEffect } from 'react';
import Chat from './components/chat/Chat';
import Detail from './components/detail/Detail';
import List from './components/list/List';
import Login from './components/login/Login';
import Notification from './components/notification/Notification';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useUserStore } from './lib/userStore';
import { useChatStore } from './lib/chatStore';
import './index.css';

const App = () => {
  const { currentUser, isLoading, fetchUserInfo, updateUserOnlineStatus, isLocalMode } = useUserStore();
  const { chatId } = useChatStore();

  useEffect(() => {
    // Apply saved theme on mount
    const savedTheme = localStorage.getItem("chat_app_theme") || "theme-green";
    document.documentElement.className = savedTheme;

    const unSub = onAuthStateChanged(auth, (user) => {
      fetchUserInfo(user?.uid);
    });
    return () => unSub();
  }, [fetchUserInfo]);

  useEffect(() => {
    if (currentUser?.id) {
      // Mark user as online
      updateUserOnlineStatus(currentUser.id, true);

      // Run DB health check to seed mock users/messages if it's cloud mode
      if (!isLocalMode) {
        import('./lib/dbHealthCheck').then(({ runDbHealthCheck }) => {
          runDbHealthCheck(currentUser);
        });
      }

      const handleUnload = () => {
        updateUserOnlineStatus(currentUser.id, false);
      };

      window.addEventListener("beforeunload", handleUnload);

      return () => {
        window.removeEventListener("beforeunload", handleUnload);
        // Mark user as offline when component unmounts or user changes
        updateUserOnlineStatus(currentUser.id, false);
      };
    }
  }, [currentUser?.id, isLocalMode, updateUserOnlineStatus, currentUser]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading">ChatApp</div>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="main-container">
        {currentUser ? (
          <div className={`chat-layout ${chatId ? 'chat-layout--active' : ''}`}>
            <List />
            {chatId ? (
              <>
                <Chat />
                <Detail />
              </>
            ) : (
              <div className="no-chat-selected">
                <h2>ChatApp Web</h2>
                <p>Send and receive messages. Select a conversation from the sidebar or start a new chat to begin messaging.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="login-layout">
            <Login />
            <span className="love-message">Made with ❤ by Sukritchopra</span>
          </div>
        )}
        <Notification />
      </main>
    </div>
  );
};

export default App;