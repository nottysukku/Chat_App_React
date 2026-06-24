import { create } from "zustand";
import { localDb } from "./localDb";
import { toast } from "react-toastify";

export const useUserStore = create((set) => ({
  currentUser: null,
  isLoading: true,
  isLocalMode: true, // Always run in SQLite/Local storage mode for this build

  fetchUserInfo: async () => {
    try {
      const localUser = localStorage.getItem("local_current_user");
      if (localUser) {
        set({ currentUser: JSON.parse(localUser), isLocalMode: true, isLoading: false });
      } else {
        set({ currentUser: null, isLocalMode: true, isLoading: false });
      }
    } catch (err) {
      console.error("fetchUserInfo error:", err);
      set({ currentUser: null, isLocalMode: true, isLoading: false });
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
      toast.success("Account created successfully! You can sign in now.");
      return true;
    } catch (err) {
      console.error("Signup error:", err);
      toast.error("An error occurred during sign up.");
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
      console.error("Login error:", err);
      toast.error("An error occurred during sign in.");
      return false;
    }
  },

  logoutGuest: () => {
    localStorage.removeItem("is_local_mode");
    localStorage.removeItem("local_current_user");
    set({ currentUser: null, isLocalMode: true, isLoading: false });
    toast.success("Logged out successfully.");
  },

  updateUserInfo: async (updatedData) => {
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
  }
}));
