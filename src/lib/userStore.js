import { doc, getDoc } from "firebase/firestore";
import { create } from "zustand";
import { db } from "./firebase";
import { localDb } from "./localDb";

export const useUserStore = create((set) => ({
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
        set({ currentUser: docSnap.data(), isLocalMode: false, isLoading: false });
      } else {
        set({ currentUser: null, isLocalMode: false, isLoading: false });
      }
    } catch (err) {
      console.log(err);
      // Fallback to local mode checking on database failures
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
  },
  logoutGuest: () => {
    localStorage.removeItem("is_local_mode");
    localStorage.removeItem("local_current_user");
    set({ currentUser: null, isLocalMode: false, isLoading: false });
  }
}));
