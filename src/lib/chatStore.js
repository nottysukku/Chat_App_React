import { create } from "zustand";
import { useUserStore } from "./userStore";

export const useChatStore = create((set) => ({
  chatId: null,
  user: null,
  isGroup: false,
  groupInfo: null, // { id, groupName, groupAvatar, members }
  userStatus: null,  // Track user status here
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,
  isChatsLoaded: false,
  setChatsLoaded: (loaded) => set({ isChatsLoaded: loaded }),

  // Change chat and user details, including status and group support
  changeChat: (chatId, info, isGroupChat = false) => {
    if (isGroupChat) {
      return set({
        chatId,
        user: null,
        isGroup: true,
        groupInfo: info,
        userStatus: null,
        isCurrentUserBlocked: false,
        isReceiverBlocked: false,
      });
    }

    const currentUser = useUserStore.getState().currentUser;

    if (info.blocked.includes(currentUser.id)) {
      return set({
        chatId,
        user: null,
        isGroup: false,
        groupInfo: null,
        userStatus: null,  // Reset status if user is blocked
        isCurrentUserBlocked: true,
        isReceiverBlocked: false,
      });
    } else if (currentUser.blocked.includes(info.id)) {
      return set({
        chatId,
        user: info,
        isGroup: false,
        groupInfo: null,
        userStatus: info.status,  // Fetch the status from the user object
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
    } else {
      return set({
        chatId,
        user: info,
        isGroup: false,
        groupInfo: null,
        userStatus: info.status || "Hey! I'm using Chatapp.",  // Default status if not set
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
      isGroup: false,
      groupInfo: null,
      userStatus: null,  // Reset status on chat reset
      isCurrentUserBlocked: false,
      isReceiverBlocked: false,
      isChatsLoaded: false,
    });
  },
}));
