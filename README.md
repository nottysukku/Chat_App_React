# 💬 **React+Firebase Chat** 🚀  
**Stay connected. Simplify communication. All powered by React and Firebase.**  

## 🌟 **Features You’ll Love**  
- 🔥 **Seamless Real-time Chat**: Powered by Firebase’s lightning-fast database.  
- 🌈 **Light and Dark Mode**: Switch themes with a single click!  
- 🎉 **Media Sharing**: Share images and files effortlessly.  
- 🔒 **Secure Conversations**: Enjoy end-to-end encrypted communication for peace of mind.  
- 🗄️ **SQLite Offline Caching & Sync**: Real-time message storage in a local SQLite simulation (`localDb.js`) when offline. Messages sent while offline queue up locally, display a pending clock (`⏳`), and sync automatically with Firebase Firestore once network connection is restored!
- 🗄️ **Interactive SQL Console**: Run raw SQL queries against the local database directly inside the app for easy debugging and inspection.

---

## 🖼️ **Sneak Peek**  

[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/z0sCI3Xmllo/0.jpg)](https://www.youtube.com/watch?v=z0sCI3Xmllo)

*Switch between dark and light themes with ease!*  
*Modern, intuitive design for seamless chatting!*  
---

## ⚙️ **Tech Stack**  
- **Frontend**: React + Material-UI  
- **Backend**: Firebase Firestore & Authentication  
- **Real-time Updates**: Firebase Realtime Database  
- **Deployment**: Firebase Hosting  

---

## 🚀 **Getting Started**  

### 1️⃣ Clone the Repository  
```bash
git clone https://github.com/yourusername/Chat_App_React.git
```

### 2️⃣ Install Dependencies  
```bash
cd Chat_App_React
npm install  
```

### 3️⃣ Set up Firebase  
1. Go to [Firebase Console](https://console.firebase.google.com/).  
2. Create a project, and configure Firestore and Authentication.  
3. Add your Firebase config details to a `.env` file:  

   ```env
   REACT_APP_FIREBASE_API_KEY=your-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-messaging-id
   REACT_APP_FIREBASE_APP_ID=your-app-id
   ```

### 4️⃣ Run the App  
```bash
npm start
```


---

## 🗄️ **SQLite Offline-First Architecture**
This application uses a local SQLite emulation database (`localDb.js` / Web SQL simulation) to provide a fully offline-first user experience for both local and cloud modes:
1. **Message Caching**: Every message fetched from Cloud Mode (Firebase) is automatically cached locally in the SQLite database.
2. **Offline Mode**: If the user loses connection (`navigator.onLine === false`), the app seamlessly falls back to reading the cached messages from the SQLite database.
3. **Message Queueing**: Outgoing messages, images, audio recordings, and shared WebRTC links sent offline are queued in SQLite with a `synced: false` flag and rendered instantly in the chat feed with a pending icon (`⏳`).
4. **Auto-Reconnection Sync**: Upon returning online, a network status listener triggers `syncOfflineMessages()`, uploading queued messages to Firestore and updating their SQLite records to `synced: true` with a success toast.
5. **Interactive SQL Console**: Developers can open the interactive SQL console in the header to run raw SQL queries directly on the SQLite database (e.g. `SELECT * FROM chats`, `SELECT * FROM users`, etc.).

---

## 💡 **Why React+Firebase Chat?**  
This app combines the powerful features of **React** with **Firebase’s real-time capabilities**, making it fast, secure, and scalable. Perfect for teams, social circles, or just casual chatting with friends!  

---

## ❤️ **Contribute**  
We’d love to have you onboard! Open issues, suggest features, or submit PRs.  

---

### **Author**- Sukrit

---  

Let’s connect the world, one chat at a time! ✨
