import React, { useState, useEffect } from "react";
import "./stories.css";
import { useUserStore } from "../../lib/userStore";
import { localDb } from "../../lib/localDb";
import { db } from "../../lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import upload from "../../lib/upload";
import { toast } from "react-toastify";

const Stories = ({ isOpen, onClose }) => {
  const { currentUser, isLocalMode } = useUserStore();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStatusText, setNewStatusText] = useState("");
  const [newStatusFile, setNewStatusFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeStory, setActiveStory] = useState(null);
  const [storyProgress, setStoryProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    fetchStories();
  }, [isOpen]);

  // Handle auto-progress for active story view
  useEffect(() => {
    if (!activeStory) {
      setStoryProgress(0);
      return;
    }

    setStoryProgress(0);
    const interval = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setActiveStory(null);
          return 0;
        }
        return prev + 1;
      });
    }, 50); // 50ms * 100 = 5 seconds

    return () => clearInterval(interval);
  }, [activeStory]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      if (isLocalMode) {
        // Query local SQLite stories
        const localStories = localDb.query("SELECT * FROM stories");
        setStories(localStories);
        return;
      }

      // Query Firebase stories
      const storiesRef = collection(db, "stories");
      const querySnapshot = await getDocs(storiesRef);
      const fetchedStories = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      
      // Filter expired (older than 24h)
      const now = Date.now();
      const activeStories = fetchedStories.filter(
        story => (story.expiresAt || 0) > now
      );
      setStories(activeStories);
    } catch (error) {
      console.error("Error fetching stories:", error);
      toast.error("Failed to load stories.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStory = async (e) => {
    e.preventDefault();
    if (!newStatusText.trim() && !newStatusFile) {
      return toast.warn("Please add text or select an image!");
    }

    try {
      setUploading(true);
      let content = newStatusText;
      let type = "text";

      if (newStatusFile) {
        if (isLocalMode) {
          // In guest mode, create a local session URL
          content = URL.createObjectURL(newStatusFile);
        } else {
          // Upload to firebase storage
          content = await upload(newStatusFile);
        }
        type = "image";
      }

      const expiresAt = Date.now() + 86400000; // 24 hours from now

      if (isLocalMode) {
        localDb.query("INSERT INTO stories (id, userId, username, userAvatar, content, type, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
          `story_${Date.now()}`,
          currentUser.id,
          currentUser.username,
          currentUser.avatar,
          content,
          type,
          Date.now(),
          expiresAt
        ]);
        toast.success("Status updated locally!");
      } else {
        await addDoc(collection(db, "stories"), {
          userId: currentUser.id,
          username: currentUser.username,
          userAvatar: currentUser.avatar,
          content,
          type,
          createdAt: Date.now(),
          expiresAt
        });
        toast.success("Status updated!");
      }

      setNewStatusText("");
      setNewStatusFile(null);
      fetchStories();
    } catch (error) {
      console.error("Error creating story:", error);
      toast.error("Failed to update status.");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  // Group stories by user (excluding current user's stories in a separate section)
  const myStories = stories.filter(s => s.userId === currentUser.id);
  const otherStories = stories.filter(s => s.userId !== currentUser.id);

  // Group other stories by username for WhatsApp style user updates
  const groupedOtherStories = otherStories.reduce((acc, story) => {
    if (!acc[story.userId]) {
      acc[story.userId] = {
        userId: story.userId,
        username: story.username,
        userAvatar: story.userAvatar,
        stories: []
      };
    }
    acc[story.userId].stories.push(story);
    return acc;
  }, {});

  const otherUpdates = Object.values(groupedOtherStories);

  return (
    <div className="wa-stories__overlay">
      <div className="wa-stories__container">
        {/* Header */}
        <div className="wa-stories__header">
          <h3>Status / Stories</h3>
          <button className="wa-stories__close" onClick={onClose}>✕</button>
        </div>

        {/* Content */}
        <div className="wa-stories__content">
          {/* Add Status Form */}
          <form className="wa-stories__add-form" onSubmit={handleCreateStory}>
            <div className="wa-stories__form-row">
              <input
                type="text"
                value={newStatusText}
                onChange={(e) => setNewStatusText(e.target.value)}
                placeholder="Share a text update..."
                className="wa-stories__input"
                disabled={uploading}
              />
              <label className="wa-stories__file-label" title="Upload Image Status">
                📷
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewStatusFile(e.target.files[0])}
                  style={{ display: "none" }}
                  disabled={uploading}
                />
              </label>
              <button className="wa-stories__submit" type="submit" disabled={uploading}>
                {uploading ? "..." : "Post"}
              </button>
            </div>
            {newStatusFile && (
              <div className="wa-stories__file-preview">
                <span>Selected Image: {newStatusFile.name}</span>
                <button type="button" onClick={() => setNewStatusFile(null)}>✕</button>
              </div>
            )}
          </form>

          {/* My Status */}
          <div className="wa-stories__section">
            <h4>My Status</h4>
            {myStories.length === 0 ? (
              <p className="wa-stories__no-status">No status updates yet.</p>
            ) : (
              <div 
                className="wa-stories__item"
                onClick={() => setActiveStory(myStories[myStories.length - 1])}
              >
                <img src={currentUser.avatar || "./avatar.png"} alt="My Avatar" className="wa-stories__avatar wa-stories__avatar--active" />
                <div className="wa-stories__info">
                  <span>My Status Update</span>
                  <p>{myStories.length} updates active</p>
                </div>
              </div>
            )}
          </div>

          {/* Recent Updates */}
          <div className="wa-stories__section">
            <h4>Recent Updates</h4>
            {loading ? (
              <p className="wa-stories__no-status">Loading status updates...</p>
            ) : otherUpdates.length === 0 ? (
              <p className="wa-stories__no-status">No recent updates from friends.</p>
            ) : (
              otherUpdates.map(update => (
                <div 
                  key={update.userId} 
                  className="wa-stories__item"
                  onClick={() => setActiveStory(update.stories[update.stories.length - 1])}
                >
                  <img src={update.userAvatar || "./avatar2.png"} alt={update.username} className="wa-stories__avatar wa-stories__avatar--active" />
                  <div className="wa-stories__info">
                    <span>{update.username}</span>
                    <p>Click to view story</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {activeStory && (
        <div className="wa-stories__viewer-overlay" onClick={() => setActiveStory(null)}>
          <div className="wa-stories__viewer-container" onClick={(e) => e.stopPropagation()}>
            {/* Progress Bar */}
            <div className="wa-stories__viewer-progress-container">
              <div 
                className="wa-stories__viewer-progress" 
                style={{ width: `${storyProgress}%` }}
              ></div>
            </div>

            {/* Viewer Header */}
            <div className="wa-stories__viewer-header">
              <div className="wa-stories__viewer-user">
                <img src={activeStory.userAvatar || "./avatar2.png"} alt={activeStory.username} />
                <span>{activeStory.username}</span>
              </div>
              <button className="wa-stories__viewer-close" onClick={() => setActiveStory(null)}>✕</button>
            </div>

            {/* Content Box */}
            <div className="wa-stories__viewer-content">
              {activeStory.type === "image" ? (
                <div className="wa-stories__viewer-image-box">
                  <img src={activeStory.content} alt="Status Update" />
                  {activeStory.text && <p className="wa-stories__viewer-caption">{activeStory.text}</p>}
                </div>
              ) : (
                <div className="wa-stories__viewer-text-box">
                  <p>{activeStory.content}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stories;
