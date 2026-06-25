import React, { useEffect, useRef, useCallback, useState } from 'react';
import './callbox.css';
import { toast } from 'react-toastify';

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

const Callbox = ({ onClose, isVideoCall = true, onShareLink, roomId = '', isHost: isHostProp = null }) => {
  const initialRoomID = roomId || getUrlParams().get('roomID') || '';
  const [roomID, setRoomID] = useState(initialRoomID);
  const [username, setUsername] = useState('');
  const [isCustomRoomIDSet, setIsCustomRoomIDSet] = useState(isHostProp !== null || !!roomId);
  const [isHost, setIsHost] = useState(isHostProp !== null ? isHostProp : false);
  const [callStatus, setCallStatus] = useState('Initializing Media Devices...');
  
  // Call States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoCall);

  // Refs for HTML5 Video tags
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  // WebRTC refs
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const activeCallRef = useRef(null);

  // Stabilize onClose callback to prevent effect tear-down/setup cycles on re-renders
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isCustomRoomIDSet || !roomID) return;

    // Load PeerJS external library dynamically
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
    script.async = true;
    
    script.onload = async () => {
      try {
        // Request camera and microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoCall,
          audio: true
        });
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setCallStatus('Setting up Peer connection...');

        if (isHost) {
          // Register room Peer ID on public PeerJS server
          const peer = new window.Peer(`chatapp_room_${roomID.trim()}`);
          peerRef.current = peer;

          peer.on('open', (id) => {
            console.log('Host registered with Peer ID:', id);
            setCallStatus('Waiting for other participant to join...');
          });

          peer.on('call', (incomingCall) => {
            console.log('Answering incoming call...');
            setCallStatus('Connected!');
            activeCallRef.current = incomingCall;
            
            incomingCall.answer(stream);
            incomingCall.on('stream', (remoteStream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
            });

            incomingCall.on('close', () => {
              toast.info("Call ended by participant.");
              onCloseRef.current();
            });
          });

          peer.on('error', (err) => {
            console.error('Peer host error:', err);
            if (err.type === 'id-taken') {
              toast.error("Room ID already in use! Try joining the room or use a different room ID.");
            } else {
              toast.error("Call setup error. Please try again.");
            }
            onCloseRef.current();
          });

        } else {
          // Joiner registers with a random guest ID
          const peer = new window.Peer(`chatapp_guest_${randomID(5)}`);
          peerRef.current = peer;

          peer.on('open', (id) => {
            console.log('Guest registered with Peer ID:', id);
            setCallStatus('Connecting to call room host...');
            
            // Call the host room ID
            const outgoingCall = peer.call(`chatapp_room_${roomID.trim()}`, stream);
            activeCallRef.current = outgoingCall;

            outgoingCall.on('stream', (remoteStream) => {
              setCallStatus('Connected!');
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
            });

            outgoingCall.on('close', () => {
              toast.info("Call ended by host.");
              onCloseRef.current();
            });
          });

          peer.on('error', (err) => {
            console.error('Peer guest error:', err);
            toast.error("Could not find or connect to the call. Make sure the Host has created and shared the Room ID first!");
            onCloseRef.current();
          });
        }

      } catch (err) {
        console.error("WebRTC getUserMedia media device access failed:", err);
        toast.error("Failed to access camera/microphone! Please check permissions.");
        onCloseRef.current();
      }
    };

    script.onerror = () => {
      toast.error("Failed to load WebRTC libraries. Check your connection.");
      onCloseRef.current();
    };

    document.body.appendChild(script);

    return () => {
      // Clean up hardware streams and peer connections
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (activeCallRef.current) {
        activeCallRef.current.close();
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      script.remove();
    };
  }, [roomID, isVideoCall, isCustomRoomIDSet, isHost]);

  const handleClose = useCallback(() => {
    onCloseRef.current();
  }, []);

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

  const handleCreateRoom = () => {
    if (validateInput()) {
      setIsHost(true);
      setIsCustomRoomIDSet(true);
      handleShareLink();
    }
  };

  const handleJoinRoom = () => {
    if (validateInput()) {
      setIsHost(false);
      setIsCustomRoomIDSet(true);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="call-modal-overlay call-box-container">
      <div className="call-modal-container call-modal-container--pure-webrtc">
        {!isCustomRoomIDSet ? (
          <div className="room-id-input-section">
            <h3 style={{ color: "#fff", marginBottom: "20px", textAlign: "center" }}>
              ⚡ Peer-to-Peer Secure Call (WebRTC)
            </h3>
            <input
              type="text"
              className="room-id-input"
              value={roomID}
              onChange={(e) => setRoomID(e.target.value)}
              placeholder="Enter Room ID"
            />
            <input
              type="text"
              className="room-id-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your Name"
              style={{ marginTop: "10px" }}
            />
            <button 
              className="confirm-room-id-button" 
              style={{ width: "80%", margin: "15px auto 0 auto", display: "block" }} 
              onClick={handleCreateRoom}
            >
              Create and Share Room
            </button>
            <button 
              className="confirm-room-id-button confirm-room-id-button--join" 
              style={{ width: "80%", margin: "10px auto 0 auto", display: "block" }} 
              onClick={handleJoinRoom}
            >
              Join Room
            </button>
            <div className="call-close-button" onClick={handleClose}>
              ✕
            </div>
          </div>
        ) : (
          <div className="webrtc-call__screen">
            {/* Call Info HUD */}
            <div className="webrtc-call__hud">
              <span className="webrtc-call__room-hud">Room: {roomID}</span>
              <span className="webrtc-call__status-hud">{callStatus}</span>
            </div>

            {/* Video Streams Display */}
            <div className="webrtc-call__video-grid">
              {/* Remote Video (takes up background/fullscreen) */}
              <div className="webrtc-call__video-wrapper remote">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="webrtc-call__video"
                />
                {callStatus !== 'Connected!' && (
                  <div className="webrtc-call__waiting-indicator">
                    <div className="webrtc-call__spinner"></div>
                    <p>{callStatus}</p>
                  </div>
                )}
              </div>

              {/* Local Video Overlay (floating box) */}
              {!isVideoOff && (
                <div className="webrtc-call__video-wrapper local">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="webrtc-call__video"
                  />
                  <span className="webrtc-call__name-tag">{username} (You)</span>
                </div>
              )}
            </div>

            {/* Futuristic Glassmorphic Controls Bar */}
            <div className="webrtc-call__controls">
              <button
                className={`webrtc-call__btn ${isMuted ? 'active' : ''}`}
                onClick={toggleMute}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? '🎤❌' : '🎤'}
              </button>
              <button
                className={`webrtc-call__btn ${isVideoOff ? 'active' : ''}`}
                onClick={toggleCamera}
                title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
              >
                {isVideoOff ? '📷❌' : '📷'}
              </button>
              <button
                className="webrtc-call__btn webrtc-call__btn--end"
                onClick={handleClose}
                title="Hang Up"
              >
                📞 Hang Up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Callbox;