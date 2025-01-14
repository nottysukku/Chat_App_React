import React, { useState, useEffect } from "react";
import Chat from "./components/chat/Chat";
import Detail from "./components/detail/Detail";
import List from "./components/list/List";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useUserStore } from "./lib/userStore";
import { useChatStore } from "./lib/chatStore";
import Darklightmode from "./components/darklightmode/Darklightmode";
import Chatbot from "./components/Chatbot/Chatbot";
import './index.css';


const fixStyle = document.querySelector("head > style:nth-child(70)");
if (fixStyle) {
  const audioStyle = document.createElement("style");
  const isDesktop = window.innerWidth >= 1024;
  audioStyle.innerHTML = `
    audio {
      width: 200px !important;
      height: 25px !important;
      position: absolute;
      top: -20px;
      ${isDesktop ? 'right: 100px;' : ''}
    }
  `;
  fixStyle.appendChild(audioStyle);
}


const App = () => {
  const { currentUser, isLoading, fetchUserInfo } = useUserStore();
  const { chatId } = useChatStore();
  
  useEffect(() => {
    const unSub = onAuthStateChanged(auth, (user) => {
      fetchUserInfo(user?.uid);
    });

    return () => unSub();
  }, [fetchUserInfo]);

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="controls-container">
        <Darklightmode />
        <Chatbot />
      </div>

      <main className="main-container">
        {currentUser ? (
          <div className="chat-layout">
            <List />
            {chatId && (
              <>
                <Chat />
                <Detail />
              </>
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