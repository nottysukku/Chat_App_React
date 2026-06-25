import React, { useEffect, useRef, useCallback, useState } from 'react';
import './callbox.css';
import { toast } from 'react-toastify';
import { decrypt, getChatKey } from '../../lib/encryption';

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

const Callbox = ({ 
  onClose, 
  isVideoCall = true, 
  onShareLink, 
  roomId = '', 
  chatId = '',
  isHost: isHostProp = null,
  localUser = null,
  remoteUser = null,
  onSendMessage = null,
  messages = []
}) => {
  const initialRoomID = roomId || getUrlParams().get('roomID') || '';
  const [roomID, setRoomID] = useState(initialRoomID);
  const [username, setUsername] = useState(localUser?.username || '');
  const [isCustomRoomIDSet, setIsCustomRoomIDSet] = useState(isHostProp !== null || !!roomId);
  const [isHost, setIsHost] = useState(isHostProp !== null ? isHostProp : false);
  const [callStatus, setCallStatus] = useState('Initializing Media Devices...');
  
  // Call Controls States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideoCall);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  
  // Mobile / Autoplay States
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(null);

  // Mesh Network Streams State
  // Array of { peerId, stream, name, avatar, isMuted, isVideoOff }
  const [remoteFeeds, setRemoteFeeds] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  // HTML5 Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({}); // Map of peerId -> HTML5 Video element
  
  // WebRTC refs
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraVideoTrackRef = useRef(null);
  const screenStreamRef = useRef(null);
  
  // Mesh connection tracking refs
  const activeCallsRef = useRef([]);        // Array of MediaConnection
  const dataConnectionsRef = useRef([]);    // Array of DataConnection
  const activeParticipantsRef = useRef([]); // Array of peerIds
  
  // Stabilize callbacks
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const onSendMessageRef = useRef(onSendMessage);
  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  // Handle remote disconnect timer
  useEffect(() => {
    if (disconnectCountdown === null) return;
    if (disconnectCountdown <= 0) {
      onCloseRef.current();
      return;
    }
    const timer = setTimeout(() => {
      setDisconnectCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [disconnectCountdown]);

  // Sync P2P state packets to all active data channels
  const broadcastP2PState = useCallback((isMutedState, isVideoOffState) => {
    dataConnectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({
          type: 'status',
          isMuted: isMutedState,
          isVideoOff: isVideoOffState
        });
      }
    });
  }, []);

  // WebRTC Setup Effect
  useEffect(() => {
    if (!isCustomRoomIDSet || !roomID) return;

    let peerTimeout = null;
    let localStream = null;

    const setupDataConnectionListeners = (conn) => {
      conn.on('open', () => {
        console.log('P2P Data Connection open with:', conn.peer);
        // Sync our current mute/video state upon connection opening
        conn.send({
          type: 'status',
          isMuted,
          isVideoOff,
          name: localUser?.username || username,
          avatar: localUser?.avatar || './avatar2.png'
        });

        // Host coordinates participant mesh
        if (isHost && !activeParticipantsRef.current.includes(conn.peer)) {
          activeParticipantsRef.current.push(conn.peer);
          
          // Send current participant list to new joiner
          conn.send({
            type: 'mesh-participants',
            list: activeParticipantsRef.current.filter(id => id !== conn.peer)
          });

          // Broadcast new joiner to existing connections
          dataConnectionsRef.current.forEach((c) => {
            if (c.peer !== conn.peer && c.open) {
              c.send({
                type: 'new-participant',
                peerId: conn.peer
              });
            }
          });
        }
      });

      conn.on('data', (data) => {
        console.log('Received P2P data:', data);
        if (data.type === 'status') {
          setRemoteFeeds(prev => prev.map(feed => {
            if (feed.peerId === conn.peer) {
              return {
                ...feed,
                isMuted: data.isMuted,
                isVideoOff: data.isVideoOff,
                name: data.name || feed.name,
                avatar: data.avatar || feed.avatar
              };
            }
            return feed;
          }));
        } else if (data.type === 'mesh-participants') {
          // Joiner connects to all other peers in the mesh
          data.list.forEach((targetPeerId) => {
            if (peerRef.current && !activeParticipantsRef.current.includes(targetPeerId)) {
              console.log('Connecting mesh link to peer:', targetPeerId);
              activeParticipantsRef.current.push(targetPeerId);
              
              // Call Media
              const call = peerRef.current.call(targetPeerId, localStreamRef.current);
              if (call) {
                setupMediaCallListeners(call);
                activeCallsRef.current.push(call);
              }

              // Call Data
              const dataConn = peerRef.current.connect(targetPeerId);
              if (dataConn) {
                setupDataConnectionListeners(dataConn);
                dataConnectionsRef.current.push(dataConn);
              }
            }
          });
        } else if (data.type === 'new-participant') {
          // Register participant ID so we answer when they call
          if (!activeParticipantsRef.current.includes(data.peerId)) {
            activeParticipantsRef.current.push(data.peerId);
          }
        }
      });

      conn.on('close', () => {
        console.log('P2P Data Connection closed with:', conn.peer);
        dataConnectionsRef.current = dataConnectionsRef.current.filter(c => c.peer !== conn.peer);
        activeParticipantsRef.current = activeParticipantsRef.current.filter(id => id !== conn.peer);
      });
    };

    const setupMediaCallListeners = (call) => {
      call.on('stream', (remoteStream) => {
        console.log('Received remote stream from peer:', call.peer);
        setCallStatus('Connected!');
        setDisconnectCountdown(null); // Clear countdown if reconnects

        // Add to remote feeds array
        setRemoteFeeds(prev => {
          if (prev.some(f => f.peerId === call.peer)) {
            return prev.map(f => f.peerId === call.peer ? { ...f, stream: remoteStream } : f);
          }
          return [...prev, {
            peerId: call.peer,
            stream: remoteStream,
            name: remoteUser?.username || 'Participant',
            avatar: remoteUser?.avatar || './avatar2.png',
            isMuted: false,
            isVideoOff: false
          }];
        });

        // Trigger mobile-safe play validation
        setTimeout(() => {
          const videoElement = remoteVideoRefs.current[call.peer];
          if (videoElement) {
            videoElement.srcObject = remoteStream;
            videoElement.play().catch((err) => {
              console.warn("Autoplay blocked for remote stream:", err);
              setAutoplayBlocked(true);
            });
          }
        }, 300);
      });

      call.on('close', () => {
        console.log('Media Connection closed from peer:', call.peer);
        setRemoteFeeds(prev => prev.filter(f => f.peerId !== call.peer));
        activeCallsRef.current = activeCallsRef.current.filter(c => c.peer !== call.peer);
        
        // Show disconnect status and set auto-close timer if no active feeds remain
        if (activeCallsRef.current.length === 0) {
          setCallStatus('Participant disconnected.');
          setDisconnectCountdown(10);
        }
      });
    };

    const initializePeer = async () => {
      try {
        // Request camera and microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoCall,
          audio: true
        });
        localStreamRef.current = stream;
        localStream = stream;
        cameraVideoTrackRef.current = stream.getVideoTracks()[0];
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.log('Local autoplay block bypass:', e));
        }

        setCallStatus('Setting up Peer connection...');

        peerTimeout = setTimeout(() => {
          const hostId = `chatapp_room_${roomID.trim()}`;
          const guestId = `chatapp_guest_${currentUserGuestId()}_${randomID(3)}`;
          
          const peer = new window.Peer(isHost ? hostId : guestId);
          peerRef.current = peer;

          peer.on('open', (id) => {
            console.log('Registered Peer ID:', id);
            if (isHost) {
              setCallStatus('Waiting for other participant to join...');
            } else {
              setCallStatus('Connecting to call room host...');
              
              // Joiner calls Host Media
              const call = peer.call(hostId, stream);
              if (call) {
                setupMediaCallListeners(call);
                activeCallsRef.current.push(call);
              }

              // Joiner connects Host Data Channel
              const dataConn = peer.connect(hostId);
              if (dataConn) {
                setupDataConnectionListeners(dataConn);
                dataConnectionsRef.current.push(dataConn);
              }
            }
          });

          // Listen for incoming calls (both host and mesh joiners)
          peer.on('call', (incomingCall) => {
            console.log('Answering incoming call from:', incomingCall.peer);
            incomingCall.answer(localStreamRef.current);
            setupMediaCallListeners(incomingCall);
            activeCallsRef.current.push(incomingCall);
          });

          // Listen for incoming data connections (both host and mesh joiners)
          peer.on('connection', (conn) => {
            console.log('Answering incoming data connection from:', conn.peer);
            setupDataConnectionListeners(conn);
            dataConnectionsRef.current.push(conn);
          });

          peer.on('error', (err) => {
            console.error('Peer error:', err);
            if (err.type === 'id-taken') {
              toast.error("Room ID already in use! Try joining the room or use a different room ID.");
            } else {
              toast.error("Call connection error occurred.");
            }
            onCloseRef.current();
          });
        }, 500); // 500ms delay to resolve StrictMode double-mount collisions

      } catch (err) {
        console.error("WebRTC getUserMedia access failed:", err);
        toast.error("Failed to access camera/microphone! Please check browser permissions.");
        onCloseRef.current();
      }
    };

    if (window.Peer) {
      initializePeer();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
      script.async = true;
      script.onload = initializePeer;
      script.onerror = () => {
        toast.error("Failed to load WebRTC libraries. Check your connection.");
        onCloseRef.current();
      };
      document.body.appendChild(script);

      return () => {
        if (peerTimeout) clearTimeout(peerTimeout);
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
        activeCallsRef.current.forEach(c => c.close());
        dataConnectionsRef.current.forEach(c => c.close());
        if (peerRef.current) peerRef.current.destroy();
        script.remove();
      };
    }

    return () => {
      if (peerTimeout) clearTimeout(peerTimeout);
      if (localStream) localStream.getTracks().forEach(t => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
      activeCallsRef.current.forEach(c => c.close());
      dataConnectionsRef.current.forEach(c => c.close());
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [roomID, isVideoCall, isCustomRoomIDSet, isHost]);

  const currentUserGuestId = () => {
    return localUser?.id || randomID(5);
  };

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
      toast.warning('Please enter your name!');
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

  // Toggle Mute Audio Track
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        broadcastP2PState(!audioTrack.enabled, isVideoOff);
      }
    }
  };

  // Toggle Camera Video Track
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        broadcastP2PState(isMuted, !videoTrack.enabled);
      }
    }
  };

  // Screen Share Toggle
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop Screen Share and restore camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      screenStreamRef.current = null;
      setIsScreenSharing(false);

      if (cameraVideoTrackRef.current && localStreamRef.current) {
        // Restore local track reference
        const localVideoSender = localStreamRef.current.getVideoTracks()[0];
        if (localVideoSender) {
          localStreamRef.current.removeTrack(localVideoSender);
        }
        localStreamRef.current.addTrack(cameraVideoTrackRef.current);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Replace tracks in WebRTC Peer senders
        activeCallsRef.current.forEach((call) => {
          const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraVideoTrackRef.current);
          }
        });
      }
    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Listen for user stopping screen share via browser bar
        screenTrack.onended = () => {
          toggleScreenShare();
        };

        if (localStreamRef.current) {
          const localVideoSender = localStreamRef.current.getVideoTracks()[0];
          if (localVideoSender) {
            localStreamRef.current.removeTrack(localVideoSender);
          }
          localStreamRef.current.addTrack(screenTrack);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          // Replace track in WebRTC Peer senders
          activeCallsRef.current.forEach((call) => {
            const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          });
        }
      } catch (err) {
        console.error("Screen sharing activation failed:", err);
        toast.warning("Screen sharing cancelled or unsupported on this device.");
      }
    }
  };

  // Bypass browser audio/video autoplay locks on click
  const bypassAutoplayBlocks = () => {
    setAutoplayBlocked(false);
    remoteFeeds.forEach((feed) => {
      const el = remoteVideoRefs.current[feed.peerId];
      if (el) el.play().catch(e => console.error("Manual play override block:", e));
    });
  };

  // Post a message in the active chat thread
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (onSendMessageRef.current) {
      onSendMessageRef.current(chatInput);
      setChatInput('');
    }
  };

  return (
    <div className={`call-modal-overlay call-box-container ${isMinimized ? 'call-modal-overlay--minimized' : ''}`}>
      <div className={`call-modal-container call-modal-container--pure-webrtc ${isMinimized ? 'call-modal-container--minimized' : ''}`}>
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
          <div className={`webrtc-call__screen ${showChatPanel ? 'webrtc-call__screen--with-chat' : ''}`}>
            
            {/* Secure Context Warnings */}
            {!window.isSecureContext && (
              <div className="webrtc-call__warning-banner">
                ⚠️ Camera/Mic access requires a secure connection (HTTPS) on mobile devices.
              </div>
            )}

            {/* Mobile Autoplay Override banner */}
            {autoplayBlocked && (
              <div className="webrtc-call__autoplay-overlay" onClick={bypassAutoplayBlocks}>
                <div className="webrtc-call__autoplay-box">
                  <span>🔊 Autoplay Blocked</span>
                  <p>Click here to enable sound and video streams.</p>
                </div>
              </div>
            )}

            {/* Call HUD Overlay */}
            {!isMinimized && (
              <div className="webrtc-call__hud">
                <span className="webrtc-call__room-hud">Room: {roomID}</span>
                <span className="webrtc-call__status-hud">
                  {disconnectCountdown !== null ? `Disconnecting in ${disconnectCountdown}s` : callStatus}
                </span>
              </div>
            )}

            {/* Video Grid Layout */}
            <div className={`webrtc-call__video-grid ${isMinimized ? 'minimized' : ''} grid-${Math.max(1, remoteFeeds.length)}`}>
              
              {/* Remote Streams Grid */}
              {remoteFeeds.length > 0 ? (
                remoteFeeds.map((feed) => (
                  <div key={feed.peerId} className="webrtc-call__video-wrapper remote">
                    <video
                      ref={el => remoteVideoRefs.current[feed.peerId] = el}
                      autoPlay
                      playsInline
                      className="webrtc-call__video"
                      style={{ display: feed.isVideoOff ? 'none' : 'block' }}
                    />
                    {feed.isVideoOff && (
                      <div className="webrtc-call__avatar-placeholder remote">
                        <img src={feed.avatar || './avatar2.png'} alt="Avatar" />
                        <span className="webrtc-call__status-tag">Camera Off</span>
                      </div>
                    )}
                    {feed.isMuted && (
                      <div className="webrtc-call__mute-indicator">🎙️❌ Muted</div>
                    )}
                    <span className="webrtc-call__participant-name">{feed.name}</span>
                  </div>
                ))
              ) : (
                /* Waiting Room Placeholder background */
                <div className="webrtc-call__video-wrapper remote placeholder">
                  <div className="webrtc-call__waiting-indicator">
                    <div className="webrtc-call__spinner"></div>
                    <p>{callStatus}</p>
                  </div>
                  {remoteUser && (
                    <div className="webrtc-call__avatar-placeholder remote big">
                      <img src={remoteUser.avatar || './avatar2.png'} alt="Avatar" />
                      <span className="webrtc-call__remote-username">{remoteUser.username}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Local Video Overlay (floating box) */}
              <div className="webrtc-call__video-wrapper local" style={{ display: isMinimized ? 'none' : 'block' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="webrtc-call__video"
                  style={{ display: isVideoOff ? 'none' : 'block' }}
                />
                {isVideoOff && (
                  <div className="webrtc-call__avatar-placeholder local">
                    <img src={localUser?.avatar || './avatar2.png'} alt="Avatar" />
                  </div>
                )}
                {isMuted && (
                  <div className="webrtc-call__mute-indicator local">🎙️❌</div>
                )}
                <span className="webrtc-call__name-tag">{username} (You)</span>
              </div>
            </div>

            {/* In-Call Chat Slide-Out Panel */}
            {showChatPanel && !isMinimized && (
              <div className="webrtc-call__chat-panel">
                <div className="webrtc-call__chat-header">
                  <span>Chat Thread</span>
                  <button className="webrtc-call__chat-close" onClick={() => setShowChatPanel(false)}>✕</button>
                </div>
                <div className="webrtc-call__chat-messages">
                  {messages.map((msg, i) => {
                    const isOwn = msg.senderId === currentUserGuestId();
                    const senderName = isOwn ? 'You' : (remoteUser?.username || 'Participant');
                    return (
                      <div key={i} className={`webrtc-call__chat-bubble-wrapper ${isOwn ? 'own' : ''}`}>
                        <span className="webrtc-call__chat-sender">{senderName}</span>
                        <div className="webrtc-call__chat-bubble">
                          <p>{decrypt(msg.text, getChatKey(chatId))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form className="webrtc-call__chat-form" onSubmit={handleSendChatMessage}>
                  <input
                    type="text"
                    placeholder="Type message..."
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                  />
                  <button type="submit">Send</button>
                </form>
              </div>
            )}

            {/* Controls HUD Panel */}
            <div className={`webrtc-call__controls ${isMinimized ? 'minimized' : ''}`}>
              {!isMinimized && (
                <>
                  <button
                    className={`webrtc-call__btn ${isMuted ? 'active' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {isMuted ? '🎙️❌' : '🎙️'}
                  </button>
                  <button
                    className={`webrtc-call__btn ${isVideoOff ? 'active' : ''}`}
                    onClick={toggleCamera}
                    title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                  >
                    {isVideoOff ? '📷❌' : '📷'}
                  </button>
                  {navigator.mediaDevices.getDisplayMedia && (
                    <button
                      className={`webrtc-call__btn ${isScreenSharing ? 'active' : ''}`}
                      onClick={toggleScreenShare}
                      title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                    >
                      {isScreenSharing ? '🖥️❌' : '🖥️'}
                    </button>
                  )}
                  <button
                    className={`webrtc-call__btn ${showChatPanel ? 'active' : ''}`}
                    onClick={() => setShowChatPanel(prev => !prev)}
                    title="Toggle Chat"
                  >
                    💬
                  </button>
                </>
              )}
              <button
                className="webrtc-call__btn webrtc-call__btn--minimize"
                onClick={() => setIsMinimized(prev => !prev)}
                title={isMinimized ? 'Expand Call' : 'Minimize Call'}
                style={{ fontSize: isMinimized ? '16px' : '18px' }}
              >
                {isMinimized ? '🗖 Expand' : '🗗'}
              </button>
              <button
                className="webrtc-call__btn webrtc-call__btn--end"
                onClick={handleClose}
                title="Hang Up"
              >
                📞 {isMinimized ? '' : 'Hang Up'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Callbox;