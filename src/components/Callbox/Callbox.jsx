import React, { useEffect, useRef } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import './callbox.css';

function randomID(len = 5) {
  let result = '';
  const chars = '12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP';
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

const Callbox = ({ onClose, isVideoCall = true }) => {
  const roomID = getUrlParams().get('roomID') || randomID(5);
  const containerRef = useRef(null);
  const zegoRef = useRef(null);

  useEffect(() => {
    const initCall = async () => {
      if (!containerRef.current) return;

      const appID = 61116413;
      const serverSecret = "cbe97ba543eecb675f41548a17fcf6e7";
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID, 
        serverSecret, 
        roomID, 
        randomID(5),  // userID
        randomID(5)   // userName
      );

      zegoRef.current = ZegoUIKitPrebuilt.create(kitToken);

      // Start the call
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
        }
      });
    };

    initCall();

    // Cleanup function
    return () => {
      if (zegoRef.current) {
        zegoRef.current.destroy();
      }
    };
  }, [roomID, isVideoCall, onClose]);

  const handleClose = () => {
   
    onClose();
  };

  return (
    <div className="call-modal-overlay">
      
      <div className="call-modal-container">
        <button className="call-close-button" onClick={handleClose}>
          ✕
        </button>
        
        <div
          className="myCallContainer"
          ref={containerRef}
        />
        
      </div>
    </div>
  );
};

export default Callbox;