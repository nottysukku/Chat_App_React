import { create } from "zustand";
import { useUserStore } from "./userStore";

export const useChatStore = create((set) => ({
  chatId: null,
  user: null,
  userStatus: null,  // Track user status here
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,

  // Change chat and user details, including status
  changeChat: (chatId, user) => {
    const currentUser = useUserStore.getState().currentUser;

    if (user.blocked.includes(currentUser.id)) {
      return set({
        chatId,
        user: null,
        userStatus: null,  // Reset status if user is blocked
        isCurrentUserBlocked: true,
        isReceiverBlocked: false,
      });
    } else if (currentUser.blocked.includes(user.id)) {
      return set({
        chatId,
        user: user,
        userStatus: user.status,  // Fetch the status from the user object
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
    } else {
      return set({
        chatId,
        user,
        userStatus: user.status || "Hey! I'm using Chatapp.",  // Default status if not set
        isCurrentUserBlocked: false,
        isReceiverBlocked: false,
      });
    }
  },

  // Update status in the store (to be synced with the backend in your case)
  updateUserStatus: (newStatus) => {
    set((state) => ({
      ...state,
      userStatus: newStatus,
    }));
  },

  // Toggle the block status
  changeBlock: () => {
    set((state) => ({ ...state, isReceiverBlocked: !state.isReceiverBlocked }));
  },

  // Reset chat data
  resetChat: () => {
    set({
      chatId: null,
      user: null,
      userStatus: null,  // Reset status on chat reset
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
    });
  },
}));
