import { arrayRemove, arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { useState, useEffect } from "react";
import { useChatStore } from "../../lib/chatStore";
import { auth, db, storage } from "../../lib/firebase";
import { useUserStore } from "../../lib/userStore";
import "./detail.css";

const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock, resetChat } = useChatStore();
  const { currentUser } = useUserStore();

  const [showPhotos, setShowPhotos] = useState(true);
  const [sharedPhotos, setSharedPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [error, setError] = useState(null);
  const [showChatDropdown, setShowChatDropdown] = useState(false);
  const [showPrivacyDropdown, setShowPrivacyDropdown] = useState(false);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!chatId) return;

      setLoadingPhotos(true);
      setError(null);

      try {
        const chatDocRef = doc(db, "chats", chatId);
        const chatDocSnap = await getDoc(chatDocRef);

        if (chatDocSnap.exists()) {
          const chatData = chatDocSnap.data();
          const photos = chatData.messages
            ?.filter((message) => message.img)
            .map((message, index) => ({
              id: index,
              url: message.img,
              name: message.fileName || `photo_${index + 1}.png`,
            }));
          setSharedPhotos(photos || []);
        } else {
          console.warn("No chat found with the given chatId");
          setSharedPhotos([]);
        }
      } catch (err) {
        console.error("Error fetching photos:", err);
        setError("Failed to load shared photos. Please try again later.");
      } finally {
        setLoadingPhotos(false);
      }
    };

    fetchPhotos();
  }, [chatId]);

  const handleDownload = async (photo) => {
    try {
      const imageRef = ref(storage, photo.url);
      const url = await getDownloadURL(imageRef);

      const link = document.createElement("a");
      link.href = url;
      link.download = photo.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading photo:", error);
      setError("Failed to download photo. Please try again.");
    }
  };

  const handleBlock = async () => {
    if (!user) return;

    const userDocRef = doc(db, "users", currentUser.id);

    try {
      await updateDoc(userDocRef, {
        blocked: isReceiverBlocked ? arrayRemove(user.id) : arrayUnion(user.id),
      });
      changeBlock();
    } catch (err) {
      console.error("Error updating block status:", err);
    }
  };

  return (
    <div className="detail">
      <div className="user">
        <img src={user?.avatar || "./avatar2.png"} alt="User Avatar" />
        <h2>{user?.username || "Unknown User"}</h2>
        <p>Hey! I'm using Chatapp</p>
      </div>

      <div className="info">
        <div className="option">
          <div
            className="title"
            onClick={() => setShowChatDropdown((prev) => !prev)}
          >
            <span>Chat Settings</span>
            <img
              src={showChatDropdown ? "./arrowDown.png" : "./arrowUp.png"}
              alt="Arrow"
            />
          </div>
          {showChatDropdown && (
            <div className="dropdown">
              <button
                className="logout-button"
                onClick={() => auth.signOut()}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <div className="option">
          <div
            className="title"
            onClick={() => setShowPrivacyDropdown((prev) => !prev)}
          >
            <span>Privacy & Help</span>
            <img
              src={showPrivacyDropdown ? "./arrowDown.png" : "./arrowUp.png"}
              alt="Arrow"
            />
          </div>
          {showPrivacyDropdown && (
            <div className="dropdown">
              <a
                href="https://firebase.google.com/support/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
            </div>
          )}
        </div>

        <div className="option">
          <div
            className="title"
            onClick={() => setShowPhotos(!showPhotos)}
          >
            <span>Shared Photos</span>
            <img
              src={showPhotos ? "./arrowDown.png" : "./arrowUp.png"}
              alt="Arrow"
            />
          </div>
          {showPhotos && (
            <div className="photos">
              {loadingPhotos ? (
                <p>Loading photos...</p>
              ) : error ? (
                <p className="error">{error}</p>
              ) : sharedPhotos.length > 0 ? (
                sharedPhotos.map((photo) => (
                  <div key={photo.id} className="photoItem">
                    <div className="photoDetail">
                      <img src={photo.url} alt={photo.name} />
                      <span>{photo.name}</span>
                    </div>
                    <img
                      src="./download.png"
                      alt="Download"
                      className="icon"
                      onClick={() => handleDownload(photo)}
                    />
                  </div>
                ))
              ) : (
                <p className="no-photos">No shared photos yet</p>
              )}
            </div>
          )}
        </div>

        {/* <button onClick={handleBlock}>
          {isCurrentUserBlocked
            ? "You are Blocked!"
            : isReceiverBlocked
            ? "User Blocked"
            : "Block User"}
        </button> */}
      </div>
    </div>
  );
};

export default Detail;
