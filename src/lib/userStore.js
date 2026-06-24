import { doc, getDoc, updateDoc } from "firebase/firestore";
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
        // Ensure id is present in the currentUser object (firebase uses uid, but id is expected by many components)
        const userData = docSnap.data();
        if (!userData.id) userData.id = uid;
        set({ currentUser: userData, isLocalMode: false, isLoading: false });
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
  },
  updateUserInfo: async (updatedData) => {
    set((state) => {
      const newUser = { ...state.currentUser, ...updatedData };
      if (state.isLocalMode) {
        localStorage.setItem("local_current_user", JSON.stringify(newUser));
        // Update user in localDb
        const users = JSON.parse(localStorage.getItem("sqlite_users") || "[]");
        const idx = users.findIndex(u => u.id === newUser.id);
        if (idx > -1) {
          users[idx] = { ...users[idx], ...updatedData };
          localStorage.setItem("sqlite_users", JSON.stringify(users));
          window.dispatchEvent(new CustomEvent("local-db-update"));
        }
      }
      return { currentUser: newUser };
    });

    // In Firebase mode, update Firestore document
    const { isLocalMode, currentUser } = useUserStore.getState();
    if (!isLocalMode && currentUser?.id) {
      try {
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, updatedData);
      } catch (err) {
        console.error("Failed to update Firestore user info:", err);
      }
    }
  }
}));
