import { useEffect } from "react";
import Chat from "./components/chat/Chat";
import Detail from "./components/detail/Detail";
import List from "./components/list/List";
import Login from "./components/login/Login";
import Notification from "./components/notification/Notification";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase";
import { useUserStore } from "./lib/userStore";
import { useChatStore } from "./lib/chatStore";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Card, CardContent, CardMedia, Switch, Typography } from "@mui/material"
import Darklightmode from "./components/darklightmode/Darklightmode";
const App = () => {
  const { currentUser, isLoading, fetchUserInfo } = useUserStore();
  const { chatId } = useChatStore();
/**
 * This component uses the `useUserStore` and `useChatStore` hooks to get the current user, loading state, and chat ID.
 * It also sets up an authentication state listener using `onAuthStateChanged` to fetch user information when the authentication state changes.
 * The cleanup function in the `useEffect` hook is used to unsubscribe from the `onAuthStateChanged` listener when the component unmounts.
 * This is important to prevent memory leaks and ensure that the listener is not called after the component is destroyed.
 */
  useEffect(() => {
    const unSub = onAuthStateChanged(auth, (user) => {
      fetchUserInfo(user?.uid);
    });

    return () => {
      unSub();
    };
  }, [fetchUserInfo]);

  if (isLoading) return <div className="loading">Loading...</div>;


  return (
    <div>
      <Darklightmode />
      
    <div id="container" className="container">
      {currentUser ? (
        <>
          <List />
          {chatId && <Chat />}
          {chatId && <Detail />}
        </>
      ) : (
        <Login />
        
      )}
      <Notification />
    </div>
    </div>
  );
};

export default App;
