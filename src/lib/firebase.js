// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "react-chat-app-bc50b.firebaseapp.com",
  projectId: "react-chat-app-bc50b",
  storageBucket: "react-chat-app-bc50b.firebasestorage.app",
  messagingSenderId: "743080591769",
  appId: "1:743080591769:web:1622310a9148d565245308",
  measurementId: "G-Z216QYEXDP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const db = getFirestore();
const analytics = getAnalytics(app);
export const storage = getStorage();