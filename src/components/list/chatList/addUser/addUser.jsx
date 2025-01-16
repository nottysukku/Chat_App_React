import "./addUser.css";
import { db } from "../../../../lib/firebase";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useState } from "react";
import { useUserStore } from "../../../../lib/userStore";
import { toast } from "react-toastify";

const AddUser = ({ setAddMode }) => {
  const [user, setUser] = useState(null);
  const { currentUser } = useUserStore();

  const handleSearch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get("username");

    try {
      const userRef = collection(db, "users");
      const q = query(userRef, where("username", "==", username));
      const querySnapShot = await getDocs(q);

      if (!querySnapShot.empty) {
        setUser(querySnapShot.docs[0].data());
      } else {
        toast.error("No user found!");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while searching for the user.");
    }
  };

  const handleAdd = async () => {
    try {
      const chatRef = collection(db, "chats");
      const userChatsRef = collection(db, "userchats");
      const newChatRef = doc(chatRef);

      await setDoc(newChatRef, {
        createdAt: serverTimestamp(),
        messages: [],
      });

     

      await updateDoc(doc(userChatsRef, user.id), {
        chats: arrayUnion({

          chatId: newChatRef.id,

          lastMessage: "",

          receiverId: currentUser.id,

          updatedAt: Date.now(),

        }),
      });
      await updateDoc(doc(userChatsRef, currentUser.id), {
        chats: arrayUnion({

          chatId: newChatRef.id,

          lastMessage: "",

          receiverId: user.id,

          updatedAt: Date.now(),

        }),
      });

      toast.success("Chat created successfully!");
      setAddMode(false);
    } catch (err) {
      console.error(err);
      toast.error("Error occurred while adding the user.");
    }
  };

  return (
    <div className="addUser">
      <form onSubmit={handleSearch}>
        <input type="text" placeholder="Username" name="username" />
        <button type="submit">Search</button>
        <img
          src="./minus.png"
          alt="Close"
          className="cross"
          onClick={() => setAddMode(false)}
        />
      </form>
      {user && (
        <div className="user">
          <div className="detail">
            <img src={user.avatar || "./avatar2.png"} alt="Avatar" />
            <span>{user.username}</span>
          </div>
          <button onClick={handleAdd}>Add User</button>
        </div>
      )}
    </div>
  );
};

export default AddUser;
