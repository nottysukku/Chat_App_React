import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { create } from "zustand";
import { db, auth } from "./firebase";
import { localDb } from "./localDb";
import { toast } from "react-toastify";

export const useUserStore = create((set, get) => ({
  currentUser: null,
  isLoading: true,
  isLocalMode: localStorage.getItem("is_local_mode") === "true",

  fetchUserInfo: async (uid) => {
    if (!uid) {
      const isLocal = localStorage.getItem("is_local_mode") === "true";
      const localUser = localStorage.getItem("local_current_user");
      if (isLocal && localUser) {
        return set({ currentUser: JSON.parse(localUser), isLocalMode: true, isLoading: false });
      }
      return set({ currentUser: null, isLocalMode: false, isLoading: false });
    }

    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        if (!userData.id) userData.id = uid;
        // Always clear local mode when Firebase user is found
        localStorage.setItem("is_local_mode", "false");
        localStorage.removeItem("local_current_user");
        set({ currentUser: userData, isLocalMode: false, isLoading: false });
      } else {
        // Firebase Auth user exists but no Firestore doc — this can happen
        // if the account was created in another session or the doc write failed.
        // Sign them out cleanly so they can re-register properly.
        console.warn("Firebase Auth user found but no Firestore profile document. Signing out.");
        toast.error("Account profile not found. Please sign up again.");
        await auth.signOut();
        localStorage.setItem("is_local_mode", "false");
        localStorage.removeItem("local_current_user");
        set({ currentUser: null, isLocalMode: false, isLoading: false });
      }
    } catch (err) {
      console.error("Firebase fetch user info error, falling back:", err);
      const isLocal = localStorage.getItem("is_local_mode") === "true";
      const localUser = localStorage.getItem("local_current_user");
      if (isLocal && localUser) {
        return set({ currentUser: JSON.parse(localUser), isLocalMode: true, isLoading: false });
      }
      return set({ currentUser: null, isLocalMode: false, isLoading: false });
    }
  },

  loginGuest: (username) => {
    const guestUser = {
      id: "guest_user",
      username: username || "Guest User",
      email: "guest@chatapp.local",
      avatar: "./avatar.png",
      status: "Hey! I am using ChatApp as a guest.",
      blocked: [],
    };
    
    // Add guest user to local database if not exists
    localDb.query("INSERT INTO users (id, username, email, avatar, status) VALUES (?, ?, ?, ?, ?)", [
      guestUser.id,
      guestUser.username,
      guestUser.email,
      guestUser.avatar,
      guestUser.status,
    ]);

    localStorage.setItem("is_local_mode", "true");
    localStorage.setItem("local_current_user", JSON.stringify(guestUser));
    set({ currentUser: guestUser, isLocalMode: true, isLoading: false });
    toast.success("Welcome! Logged in as Guest.");
  },

  signupLocal: async (username, email, password, avatarBase64) => {
    try {
      const users = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        toast.error("Email already exists!");
        return false;
      }

      const userId = "user_" + Date.now();
      const newUser = {
        id: userId,
        username,
        email: email.toLowerCase(),
        password,
        avatar: avatarBase64 || "./avatar2.png",
        status: "Hey! I am using ChatApp.",
        blocked: [],
      };

      users.push(newUser);
      localStorage.setItem("sqlite_users", JSON.stringify(users));

      // Create local userchats record
      const userchats = JSON.parse(localStorage.getItem("sqlite_userchats") || "{}");
      if (!userchats[userId]) {
        userchats[userId] = { chats: [] };
        localStorage.setItem("sqlite_userchats", JSON.stringify(userchats));
      }

      window.dispatchEvent(new CustomEvent("local-db-update"));
      toast.success("Local account created successfully! You can sign in now.");
      return true;
    } catch (err) {
      console.error("Local signup error:", err);
      toast.error("An error occurred during local sign up.");
      return false;
    }
  },

  loginLocal: async (email, password) => {
    try {
      const users = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        toast.error("User with this email does not exist!");
        return false;
      }
      if (user.password !== password) {
        toast.error("Incorrect password!");
        return false;
      }

      localStorage.setItem("is_local_mode", "true");
      localStorage.setItem("local_current_user", JSON.stringify(user));
      set({ currentUser: user, isLocalMode: true, isLoading: false });
      toast.success(`Welcome back, ${user.username}!`);
      return true;
    } catch (err) {
      console.error("Local login error:", err);
      toast.error("An error occurred during local sign in.");
      return false;
    }
  },

  logoutGuest: () => {
    const isLocal = get().isLocalMode;
    const uid = get().currentUser?.id;
    if (uid) {
      get().updateUserOnlineStatus(uid, false);
    }
    localStorage.removeItem("is_local_mode");
    localStorage.removeItem("local_current_user");
    set({ currentUser: null, isLocalMode: false, isLoading: false });
    if (!isLocal) {
      auth.signOut();
    }
    toast.success("Logged out successfully.");
  },

  updateUserOnlineStatus: async (uid, isOnline) => {
    const isLocal = get().isLocalMode;
    if (isLocal) {
      const users = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
      const idx = users.findIndex(u => u.id === uid);
      if (idx > -1) {
        users[idx].isOnline = isOnline;
        users[idx].lastActive = Date.now();
        localStorage.setItem("sqlite_users", JSON.stringify(users));
        window.dispatchEvent(new CustomEvent("local-db-update"));
      }
    } else if (uid) {
      try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
          isOnline: isOnline,
          lastActive: Date.now()
        });
      } catch (err) {
        console.error("Failed to update Firestore user online status:", err);
      }
    }
  },

  updateUserInfo: async (updatedData) => {
    const { isLocalMode, currentUser } = get();
    if (isLocalMode) {
      set((state) => {
        const newUser = { ...state.currentUser, ...updatedData };
        localStorage.setItem("local_current_user", JSON.stringify(newUser));
        // Update user in localDb
        const users = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
        const idx = users.findIndex(u => u.id === newUser.id);
        if (idx > -1) {
          users[idx] = { ...users[idx], ...updatedData };
          localStorage.setItem("sqlite_users", JSON.stringify(users));
          window.dispatchEvent(new CustomEvent("local-db-update"));
        }
        return { currentUser: newUser };
      });
    } else if (currentUser?.id) {
      set((state) => ({ currentUser: { ...state.currentUser, ...updatedData } }));
      try {
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, updatedData);
      } catch (err) {
        console.error("Failed to update Firestore user info:", err);
      }
    }
  }
}));
