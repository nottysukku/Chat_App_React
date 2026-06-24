import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "./firebase";

const MOCK_USERS_DATA = [
  { id: "mock_user_1", username: "Emma Watson", avatar: "https://i.pravatar.cc/150?img=32", status: "✨ Live, Love, Laugh" },
  { id: "mock_user_2", username: "John Doe", avatar: "https://i.pravatar.cc/150?img=68", status: "👨‍💻 Coding all day" },
  { id: "mock_user_3", username: "Sarah Jenkins", avatar: "https://i.pravatar.cc/150?img=47", status: "🌸 Chasing dreams" },
  { id: "mock_user_4", username: "Michael Scott", avatar: "https://i.pravatar.cc/150?img=12", status: "👔 World's Best Boss" },
  { id: "mock_user_5", username: "David Miller", avatar: "https://i.pravatar.cc/150?img=53", status: "🎵 Music is life" },
  { id: "mock_user_6", username: "Sophia Carter", avatar: "https://i.pravatar.cc/150?img=25", status: "✈️ Wanderlust" },
  { id: "mock_user_7", username: "James Wilson", avatar: "https://i.pravatar.cc/150?img=15", status: "🏋️‍♂️ No pain, no gain" },
  { id: "mock_user_8", username: "Olivia Taylor", avatar: "https://i.pravatar.cc/150?img=9", status: "🎨 Creating art" },
  { id: "mock_user_9", username: "Robert Brown", avatar: "https://i.pravatar.cc/150?img=4", status: "📚 Always learning" },
  { id: "mock_user_10", username: "Emily Davis", avatar: "https://i.pravatar.cc/150?img=22", status: "🍳 Cooking up a storm" }
];

const MOCK_GREETINGS = [
  "Hey there! Welcome to ChatApp! How are you doing today?",
  "Hi! I saw you just signed up. Let's connect!",
  "Hello! How's everything going? Ready to chat?",
  "Hey, welcome! Let me know if you need anything on this app.",
  "Greetings! Glad to see you here. Hope you are having a great day!",
  "Hi there! Welcome. What's your status today?",
  "Hey! Let's catch up sometime soon.",
  "Hello, welcome to the cross-continent chat workspace!",
  "Hey! Let's explore the themes and animations on this app.",
  "Hello! Welcome aboard. Feel free to shoot a message back!"
];

export const runDbHealthCheck = async (currentUser) => {
  if (!currentUser?.id || currentUser.id === "guest_user") return;
  
  // To avoid running the check repeatedly in the same browser session, check sessionStorage
  if (sessionStorage.getItem(`db_health_checked_${currentUser.id}`) === "true") {
    return;
  }

  console.log("Running Database Health Checkup & User Seeding...");
  
  try {
    // 1. Fetch current user's userchats
    const userChatsRef = doc(db, "userchats", currentUser.id);
    const userChatsSnap = await getDoc(userChatsRef);
    
    let currentChats = [];
    if (userChatsSnap.exists()) {
      currentChats = userChatsSnap.data().chats || [];
    } else {
      // Create userchats document if missing
      await setDoc(userChatsRef, { chats: [] });
    }

    // Only populate if they have no existing chats (which indicates they are a new user)
    if (currentChats.length === 0) {
      console.log("New user detected with 0 chats. Seeding 10 mock users and messages...");
      
      const newChatsList = [];

      for (let i = 0; i < MOCK_USERS_DATA.length; i++) {
        const mockUser = MOCK_USERS_DATA[i];
        
        // A. Ensure the mock user document exists in the "users" collection
        const mockUserRef = doc(db, "users", mockUser.id);
        const mockUserSnap = await getDoc(mockUserRef);
        if (!mockUserSnap.exists()) {
          await setDoc(mockUserRef, {
            id: mockUser.id,
            username: mockUser.username,
            avatar: mockUser.avatar,
            status: mockUser.status,
            email: `${mockUser.id}@chatapp.local`,
            blocked: [],
            isOnline: true // Show mock users as online so we can test double tick receipts!
          });
        }

        // B. Ensure mock user's "userchats" doc exists
        const mockUserChatsRef = doc(db, "userchats", mockUser.id);
        const mockUserChatsSnap = await getDoc(mockUserChatsRef);
        if (!mockUserChatsSnap.exists()) {
          await setDoc(mockUserChatsRef, { chats: [] });
        }

        // C. Create a unique chat document ID
        const chatId = `chat_${currentUser.id}_${mockUser.id}`;
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        const greetingText = MOCK_GREETINGS[i % MOCK_GREETINGS.length];

        if (!chatSnap.exists()) {
          // D. Create the chat document with a greeting message
          await setDoc(chatRef, {
            createdAt: Date.now() - (10 - i) * 60000,
            messages: [
              {
                senderId: mockUser.id,
                text: greetingText,
                createdAt: new Date(Date.now() - (10 - i) * 60000),
                seen: false
              }
            ]
          });
        }

        // E. Add to current user's chats array
        newChatsList.push({
          chatId: chatId,
          lastMessage: greetingText,
          receiverId: mockUser.id,
          updatedAt: Date.now() - (10 - i) * 60000,
          isSeen: false // Show as unread
        });

        // F. Add to mock user's chats array
        await updateDoc(mockUserChatsRef, {
          chats: arrayUnion({
            chatId: chatId,
            lastMessage: greetingText,
            receiverId: currentUser.id,
            updatedAt: Date.now() - (10 - i) * 60000,
            isSeen: true
          })
        });
      }

      // G. Update current user's chats document with all 10 new chats
      await updateDoc(userChatsRef, {
        chats: newChatsList
      });

      console.log("Seeding complete! 10 mock users and messages added successfully.");
    }

    // Set check flag in session storage so it doesn't run again until reload
    sessionStorage.setItem(`db_health_checked_${currentUser.id}`, "true");
  } catch (err) {
    console.error("Error in database health checkup:", err);
  }
};
