import React, { useState } from "react";
import "./addUser.css";
import { db } from "../../../../lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { toast } from "react-toastify";

const AddUser = ({ setAddMode }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    setAddMode(false); // Close the modal by setting addMode to false
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target);
    const username = formData.get("username");

    try {
      const userRef = collection(db, "users");
      const q = query(userRef, where("username", "==", username));

      const querySnapShot = await getDocs(q);

      if (!querySnapShot.empty) {
        setUser(querySnapShot.docs[0].data());
      } else {
        setError("No user found with this username.");
      }
    } catch (err) {
      console.log(err);
      setError("Error occurred while searching.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!user) return; // Early return if user is not found

    const chatRef = collection(db, "chats");
    const userChatsRef = collection(db, "userchats");

    try {
      // Check if a chat already exists between the users
      const existingChatQuery = query(
        userChatsRef,
        where("chats.receiverId", "array-contains", user.id)
      );

      const existingChatSnapshot = await getDocs(existingChatQuery);

      if (!existingChatSnapshot.empty) {
        toast.error("You already have a chat with this user.");
        return; // Exit if a chat already exists
      }

      // Create a new chat document
      const newChatRef = doc(chatRef);

      await setDoc(newChatRef, {
        createdAt: serverTimestamp(),
        messages: [],
      });

      // Add the new chat to both users' chat lists
      await updateDoc(doc(userChatsRef, user.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: user.id,
          updatedAt: Date.now(),
        }),
      });

      await updateDoc(doc(userChatsRef, user.id), {
        chats: arrayUnion({
          chatId: newChatRef.id,
          lastMessage: "",
          receiverId: user.id,
          updatedAt: Date.now(),
        }),
      });

      toast.success("Chat created successfully!");
    } catch (err) {
      console.log(err);
      toast.error("Error occurred while adding the user.");
    }
  };

  return (
    <div className="addUser">
      <div className="popupHeader">
        <button className="closeButton" onClick={handleClose}>
          &times; {/* Cross button */}
        </button>
      </div>
      <form onSubmit={handleSearch}>
        <input type="text" placeholder="Username" name="username" />
        <button disabled={loading}>{loading ? "Searching..." : "Search"}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {user && (
        <div className="user">
          <div className="detail">
            <img src={user.avatar || "./avatar2.png"} alt="" />
            <span>{user.username}</span>
          </div>
          <button onClick={handleAdd}>Add User</button>
        </div>
      )}
    </div>
  );
};

export default AddUser;
