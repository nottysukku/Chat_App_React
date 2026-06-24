import React, { useEffect, useRef, useCallback, useState } from 'react';
import './callbox.css';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function randomID(len = 5) {
  const chars = '12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP';
  let result = '';
  const maxPos = chars.length;
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return result;
}

export function getUrlParams(url = window.location.href) {
  const urlStr = url.split('?')[1];
  return new URLSearchParams(urlStr);
}

const Callbox = ({ onClose, isVideoCall = true, onShareLink }) => {
  const initialRoomID = getUrlParams().get('roomID') || '';
  const [roomID, setRoomID] = useState(initialRoomID);
  const [username, setUsername] = useState('');
  const [isCustomRoomIDSet, setIsCustomRoomIDSet] = useState(false);
  const containerRef = useRef(null);
  const jitsiRef = useRef(null);

  useEffect(() => {
    if (!isCustomRoomIDSet || !roomID) return;

    // Load Jitsi Meet external API script dynamically
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    
    script.onload = () => {
      if (!containerRef.current) return;

      const domain = 'meet.jit.si';
      const options = {
        roomName: `ChatAppRoom_${roomID}`,
        width: '100%',
        height: '100%',
        parentNode: containerRef.current,
        userInfo: {
          displayName: username || `User_${randomID(4)}`
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: !isVideoCall,
          prejoinPageEnabled: false, // Skip prejoin page to connect instantly
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'embedmeeting', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security'
          ]
        }
      };

      try {
        const api = new window.JitsiMeetExternalAPI(domain, options);
        jitsiRef.current = api;

        api.addEventListener('videoConferenceLeft', () => {
          onClose();
        });
      } catch (err) {
        console.error("Jitsi Meet initialization failed:", err);
        toast.error("Failed to start the call. Please try again.");
      }
    };

    script.onerror = () => {
      toast.error("Failed to load call libraries. Check your internet connection.");
    };

    document.body.appendChild(script);

    return () => {
      if (jitsiRef.current && typeof jitsiRef.current.dispose === 'function') {
        jitsiRef.current.dispose();
      }
      script.remove();
    };
  }, [roomID, isVideoCall, onClose, isCustomRoomIDSet, username]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleShareLink = useCallback(() => {
    const generatedLink = `roomID=${roomID}`;
    onShareLink(generatedLink);
  }, [roomID, onShareLink]);

  const validateInput = () => {
    if (!roomID.trim()) {
      toast.warning('Please enter a valid room ID!');
      return false;
    }
    if (!username.trim()) {
      toast.warning('Please enter a username!');
      return false;
    }
    return true;
  };

  const handleConfirmRoomID = () => {
    if (validateInput()) {
      setIsCustomRoomIDSet(true);
      handleShareLink();
    }
  };

  const handleJoinRoom = () => {
    if (validateInput()) {
      setIsCustomRoomIDSet(true);
    }
  };

  return (
    <div className="call-modal-overlay call-box-container">
      <div className="call-modal-container">
        {!isCustomRoomIDSet ? (
          <div className="room-id-input-section">
            <input
              type="text"
              className="room-id-input"
              value={roomID}
              onChange={(e) => setRoomID(e.target.value)}
              placeholder="Enter room ID"
            />
            <input
              type="text"
              className="room-id-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{ marginTop: "10px" }}
            />
            <button 
              className="confirm-room-id-button" 
              style={{ marginLeft: "40px", marginTop: "10px" }} 
              onClick={handleConfirmRoomID}
            >
              Create and Share Room
            </button>
            <button 
              className="confirm-room-id-button" 
              style={{ marginLeft: "40px", marginTop: "10px" }} 
              onClick={handleJoinRoom}
            >
              Join Room
            </button>
            <div className="call-close-button" onClick={handleClose}>
              ✕
            </div>
          </div>
        ) : (
          <>
            <div className="share-link-section">
              <p>Room ID: {roomID} </p>
              <p style={{marginLeft:"10px"}}> Username: {username}</p>
            </div>
            <div className="call-close-button" onClick={handleClose}>
              ✕
            </div>
            <div className="myCallContainer" ref={containerRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default Callbox;