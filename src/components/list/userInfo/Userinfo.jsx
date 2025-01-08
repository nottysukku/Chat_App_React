import "./userInfo.css";
import { useState, useEffect } from "react";
import { useUserStore } from "../../../lib/userStore";
import { auth, db } from "../../../lib/firebase"; // Import Firebase configurations
import { doc, getDoc, setDoc } from "firebase/firestore"; // Use Firestore functions to get and set status

const Userinfo = () => {
  const { currentUser } = useUserStore();
  const [status, setStatus] = useState("Hey! I'm using Chatapp."); // Default value for status
  const [isEditing, setIsEditing] = useState(false); // Track if status is being edited
  const [loading, setLoading] = useState(false); // Track loading state for saving status

  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);

  // Fetch user status from Firestore when the component mounts
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const docRef = doc(db, "users", currentUser.id); // Get user document from Firestore
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStatus(docSnap.data().status || "Hey! I'm using Chatapp."); // Set the status if exists, otherwise default
        }
      } catch (error) {
        console.error("Error fetching user status:", error);
      }
    };
    fetchStatus();
  }, [currentUser.id]);

  // Open confirmation modal for GitHub link
  const openGitHubModal = () => setShowGitHubModal(true);

  // Open confirmation modal for ToDo link
  const openTodoModal = () => setShowTodoModal(true);

  // Handle redirection to GitHub
  const handleGoToGitHub = () => {
    window.open("https://github.com/nottysukku", "_blank");
    setShowGitHubModal(false);
  };

  // Handle redirection to ToDo List
  const handleGoToTodo = () => {
    window.open("https://to-do-list-five-self.vercel.app/", "_blank");
    setShowTodoModal(false);
  };

  // Close modal
  const handleCloseModal = () => {
    setShowGitHubModal(false);
    setShowTodoModal(false);
  };

  // Handle status input changes
  const handleStatusChange = (e) => setStatus(e.target.value);

  // Save updated status to Firestore
  const handleSaveStatus = async () => {
    setLoading(true);
    try {
      const userDocRef = doc(db, "users", currentUser.id); // Get user document in Firestore
      await setDoc(
        userDocRef,
        {
          status,
        },
        { merge: true } // Merge status with existing user data
      );
      setIsEditing(false); // Stop editing after saving
      setLoading(false);
    } catch (error) {
      console.error("Error updating status:", error);
      setLoading(false);
    }
  };

  return (
    <div className="userInfo">
      <div className="user">
        <img src={currentUser.avatar || "./avatar.png"} alt="User Avatar" />
        <h2>{currentUser.username}</h2>
      </div>

      {/* Status Section */}
      <div className="status-section">
        {isEditing ? (
          <div className="status-edit">
            <input
              type="text"
              value={status}
              onChange={handleStatusChange}
              placeholder="Edit your status..."
            />
            <button
              disabled={loading}
              className="save-status-btn"
              onClick={handleSaveStatus}
            >
              {loading ? "Saving..." : "Save Status"}
            </button>
            {/* Close icon */}
            <button
            id="closebut"
              className="close-status-btn"
              onClick={() => setIsEditing(false)} // Close the edit box
            >
              ×
            </button>
          </div>
        ) : (
          <div className="status-display" onClick={() => setIsEditing(true)}>
            <p id="statususer1">{status}</p>
          </div>
        )}
      </div>

      {/* Icons */}
      <div className="icons">
        <a
          id="githublink"
          onClick={openGitHubModal} // Trigger GitHub modal on click
          className="icon-link"
        >
          <img src="./more.png" alt="More Options" />
        </a>

        <a
          onClick={openTodoModal} // Trigger ToDo List modal on click
          className="icon-link"
        >
          <img src="./edit.png" alt="Go to ToDo List" />
        </a>
      </div>

      {/* Confirmation Modal for GitHub */}
      {showGitHubModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>This will take you to my GitHub page. Do you want to go?</h2>
            <div className="modal-actions">
              <button className="yes-btn" onClick={handleGoToGitHub}>Yes</button>
              <button className="no-btn" onClick={handleCloseModal}>No</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for ToDo List */}
      {showTodoModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>This will help you complete your goals! Do you want to go?</h2>
            <div className="modal-actions">
              <button className="yes-btn" onClick={handleGoToTodo}>Yes</button>
              <button className="no-btn" onClick={handleCloseModal}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Userinfo;
