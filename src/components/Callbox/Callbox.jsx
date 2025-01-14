import React, { useEffect, useRef, useCallback, useState } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
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
  const zegoRef = useRef(null);

  useEffect(() => {
    if (!isCustomRoomIDSet || !roomID) return;

    const initCall = async () => {
      if (!containerRef.current) return;

      const appID = 61116413;
      const serverSecret = 'cbe97ba543eecb675f41548a17fcf6e7';
      const userID = randomID(5);
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        roomID,
        userID,
        username || `User_${userID}` // Use provided username or generate a default one
      );

      zegoRef.current = ZegoUIKitPrebuilt.create(kitToken);

      await zegoRef.current.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        showPreJoinView: true,
        showLeavingView: true,
        showRoomDetailsButton: true,
        showUserList: false,
        showLayoutButton: false,
        turnOnMicrophoneWhenJoining: true,
        turnOnCameraWhenJoining: isVideoCall,
        showMyCameraToggleButton: isVideoCall,
        showMyMicrophoneToggleButton: true,
        showAudioVideoSettingsButton: true,
        onLeaveRoom: () => {
          onClose();
        },
      });
    };

    initCall();

    return () => {
      if (zegoRef.current) {
        zegoRef.current.destroy();
      }
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
    <div className="call-modal-overlay">
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