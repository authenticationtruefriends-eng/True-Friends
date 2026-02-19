import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera } from "lucide-react";
import { getConstructedUrl, isExternalUrl } from "../../utils/urlHelper";

export default function CallModal({ call, peer, isIncoming, onClose, remoteUserId, isVideoCall = true, peerError, targetPeerId, callState }) {
    const [callStatus, setCallStatus] = useState(isIncoming ? "incoming" : "calling");
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(isVideoCall);
    const [isMinimized, setIsMinimized] = useState(false);
    const [actualVideoEnabled, setActualVideoEnabled] = useState(isVideoCall);
    const [mediaError, setMediaError] = useState(null);
    const [connectingAvatarError, setConnectingAvatarError] = useState(false); // Added

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const currentCallRef = useRef(call);
    const localStreamRef = useRef(null);
    const hasAnsweredRef = useRef(false);

    // Helper to start stream with Safer Mobile Constraints
    const startStream = async (forceAudioOnly = false) => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                },
                // REVERTED: Specific resolution causes "Sensor Zoom" (Crop) on Mobile.
                // Requesting just 'true' or basic facingMode gets the Native Aspect Ratio (4:3 usually).
                video: (isVideoCall && !forceAudioOnly) ? {
                    facingMode: "user"
                } : false
            };
            console.log("CallModal: Requesting stream with constraints:", constraints);

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            setActualVideoEnabled(isVideoCall && !forceAudioOnly);

            // Ensure local tracks are enabled
            stream.getTracks().forEach(t => t.enabled = true);
            setMediaError(null);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                // Important: Mute local video to prevent echo/feedback loop
                localVideoRef.current.muted = true;
                localVideoRef.current.play().catch(e => console.error("Local play error", e));
            }
            return stream;
        } catch (err) {
            console.error("Failed to get local stream", err);

            // Auto-fallback to audio only if camera is busy or denied
            if (isVideoCall && !forceAudioOnly) {
                console.warn("CallModal: Camera error detected. Falling back to Audio-Only.");
                return startStream(true);
            }
            // Logic for strict failure
            setMediaError(`Permission denied or device in use(${err.name}).`);
            return null;
        }
    };

    const toggleMic = () => {
        if (localStreamRef.current) {
            const newStatus = !isMicOn;
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = newStatus;
            });
            setIsMicOn(newStatus);
            console.log(`CallModal: Mic forced to ${newStatus} `);
        }
    };

    const toggleCam = () => {
        if (localStreamRef.current && actualVideoEnabled) {
            const newStatus = !isCamOn;
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = newStatus;
            });
            setIsCamOn(newStatus);
            console.log(`CallModal: Cam forced to ${newStatus} `);
        }
    };

    // --- SWITCH CAMERA LOGIC ---
    const [facingMode, setFacingMode] = useState('user'); // 'user' (front) or 'environment' (back)

    const handleSwitchCamera = async () => {
        try {
            const newMode = facingMode === 'user' ? 'environment' : 'user';
            console.log(`CallModal: Switching camera to ${newMode}...`);

            // 1. Get new stream with new constraint
            const constraints = {
                audio: false, // Don't touch audio
                video: {
                    // Remove ideal width/height to prevent zoom/crop
                    facingMode: { exact: newMode } // Force specific camera
                }
            };

            // Fallback if 'exact' is not supported (e.g. laptop)
            // But usually for mobile 'exact' is good for switching.

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newVideoTrack = newStream.getVideoTracks()[0];

            if (!newVideoTrack) {
                console.warn("CallModal: No video track found on switch.");
                return;
            }

            // 2. Replace track in Local Stream
            const oldStream = localStreamRef.current;
            if (oldStream) {
                const oldVideoTrack = oldStream.getVideoTracks()[0];
                if (oldVideoTrack) {
                    oldStream.removeTrack(oldVideoTrack);
                    oldVideoTrack.stop(); // Stop old camera
                }
                oldStream.addTrack(newVideoTrack);
            }

            // 3. Update Local Video Element
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
                localVideoRef.current.srcObject = oldStream;
                localVideoRef.current.play().catch(e => { });
            }

            // 4. Replace Track in PeerConnection (Hot Swap)
            if (currentCallRef.current && currentCallRef.current.peerConnection) {
                const sender = currentCallRef.current.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    console.log("CallModal: Replacing video sender track...");
                    await sender.replaceTrack(newVideoTrack);
                } else {
                    console.warn("CallModal: No video sender found to replace.");
                }
            }

            setFacingMode(newMode);

        } catch (err) {
            console.error("Failed to switch camera:", err);
            // Fallback: If 'exact' fails (e.g. on desktop), try just requesting without exact
            if (err.name === 'OverconstrainedError') {
                console.warn("CallModal: Exact facingMode failed. Camera might not exist.");
            }
        }
    };

    // Helper to attach stream to video element safely with Retries
    const attachRemoteStream = (stream) => {
        if (!stream) return;
        console.log("CallModal: Attaching remote stream...", stream.getTracks());

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null; // Reset first
            remoteVideoRef.current.srcObject = stream;

            // Mobile often requires explicit touch/interaction, but since we are in a call flow, it should work.
            // We use a retry mechanism for 'play()' just in case.
            const attemptPlay = () => {
                const videoEl = remoteVideoRef.current;
                if (!videoEl) return;

                videoEl.play()
                    .then(() => console.log("✅ Remote video playing successfully"))
                    .catch(e => {
                        console.error("❌ Remote play error (retrying):", e);
                        // Retry once after a short delay
                        setTimeout(() => videoEl.play().catch(e2 => console.error("❌ Retry failed:", e2)), 1000);
                    });
            };

            // Ensure playsInline is true (for iOS)
            remoteVideoRef.current.playsInline = true;
            attemptPlay();

            setCallStatus("ongoing");
        }
    };

    // State for Stream Readiness
    const [isStreamReady, setIsStreamReady] = useState(false);

    // 1. MEDIA INITIALIZATION EFFECT (Runs Once)
    useEffect(() => {
        let mounted = true;

        const initMedia = async () => {
            if (isStreamReady) return; // Prevent double init

            // If incoming, we might wait to answer? No, get stream immediately to be ready.
            // But usually we wait for "Accept" click? 
            // Current flow: We accept -> this Modal opens -> we get stream.
            // So yes, get stream immediately.

            try {
                const stream = await startStream();
                if (mounted && stream) {
                    setIsStreamReady(true);
                } else if (mounted && !stream) {
                    // Handle error handled in startStream
                }
            } catch (e) {
                console.error("Media Init Failed", e);
            }
        };

        initMedia();

        return () => {
            mounted = false;
            // Cleanup handled in mount cleanup or separate cleanup function
            // We'll keep localStreamRef cleanup in the main cleanup
        };
    }, []);

    // 2. DIALING / ANSWERING EFFECT (Runs when Stream + Dependencies are ready)
    useEffect(() => {
        if (!isStreamReady || !localStreamRef.current) return;
        if (!peer) return;

        // CASE A: OUTGOING CALL (Initiator)
        if (!isIncoming) {
            if (currentCallRef.current) return; // Already dialing/connected

            // Wait for Handshake
            if (!targetPeerId) {
                addLog("Waiting for PeerID handshake...");
                return;
            }

            addLog(`Handshake complete.Dialing ${targetPeerId}...`);
            try {
                const newCall = peer.call(targetPeerId, localStreamRef.current);
                if (!newCall) {
                    addLog("PeerJS Call returned null!");
                    return;
                }

                currentCallRef.current = newCall;

                // Listeners
                newCall.on("stream", (remoteStream) => {
                    addLog("Remote stream received");
                    attachRemoteStream(remoteStream);
                });

                newCall.on("close", () => {
                    addLog("Call closed");
                    onClose();
                });

                newCall.on("error", (e) => addLog(`Call Error: ${e} `));
            } catch (e) {
                addLog(`Dial Error: ${e} `);
            }
        }

        // CASE B: INCOMING CALL (Receiver)
        else {
            // We handle answering manually via UI button, which calls 'handleAnswer'
            // 'handleAnswer' will force-trigger the answer logic.
            // So we don't do anything here for incoming except maybe log.
        }

    }, [isStreamReady, targetPeerId, isIncoming, peer]);


    // Cleanup Effect
    useEffect(() => {
        return () => {
            // Stop Tracks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            // Close Call
            if (currentCallRef.current) {
                currentCallRef.current.close();
                currentCallRef.current = null;
            }
        };
    }, []);

    // Auto-answer REMOVED. 
    // We now wait for user interaction in the UI.

    // State to track if user clicked answer but call object wasn't ready yet
    const [answerPending, setAnswerPending] = useState(false);

    // Effect: Handle late-arriving call object if user already clicked answer
    useEffect(() => {
        if (answerPending && call && !hasAnsweredRef.current) {
            console.log("CallModal: Latent answer triggered for arrived call object");
            handleAnswer();
        }
    }, [call, answerPending]);

    // 3. LOGIC TO ATTACH LOCAL STREAM TO VIDEO ELEMENT
    // This handles the "Right now ref is null, but later it appears" case
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            // Only attach if not already attached to avoid flickering
            if (localVideoRef.current.srcObject !== localStreamRef.current) {
                console.log("CallModal: Re-attaching local stream to video element via Effect");
                localVideoRef.current.srcObject = localStreamRef.current;
                localVideoRef.current.muted = true;
                localVideoRef.current.play().catch(e => console.error("Local play error via effect", e));
            }
        }
    }, [isStreamReady, isCamOn, actualVideoEnabled, callStatus]); // Dependencies that might cause Video Element to remount

    // DEBUG: On-screen logs
    const [debugLogs, setDebugLogs] = useState([]);
    const addLog = (msg) => {
        console.log(msg);
        setDebugLogs(prev => [...prev.slice(-4), msg]); // Keep last 5 logs
    };

    const handleAnswer = async () => {
        if (hasAnsweredRef.current) return;

        if (!call) {
            addLog("Answer clicked but call missing.");
            setAnswerPending(true);
            setCallStatus("connecting");
            return;
        }

        hasAnsweredRef.current = true;
        setAnswerPending(false);

        // ANSWER FLOW:
        // 1. Get Stream
        // 2. Attach Stream logic handled by Effect
        // 3. User clicks -> we call 'answer'

        addLog("Getting local stream...");
        // Ensure stream is ready if not already
        if (!localStreamRef.current) {
            await startStream();
        }

        const stream = localStreamRef.current;
        if (!stream) {
            addLog("Failed to get stream for answer.");
            return;
        }

        try {
            addLog("Answering call...");
            currentCallRef.current = call;

            // Monitor underlying WebRTC connection
            const monitorConnection = () => {
                const pc = call.peerConnection;
                if (!pc) {
                    addLog("No PeerConnection found!");
                    return;
                }
                pc.onconnectionstatechange = () => addLog(`PC State: ${pc.connectionState} `);
                pc.oniceconnectionstatechange = () => addLog(`ICE State: ${pc.iceConnectionState} `);
            };
            monitorConnection();

            // CRITICAL: Listeners setup BEFORE answer
            call.on("stream", (remoteStream) => {
                addLog("Stream received!");
                attachRemoteStream(remoteStream);
            });

            call.on("close", () => {
                addLog("Call closed.");
                onClose();
            });

            call.on("error", (e) => addLog(`Call Error: ${e} `));

            call.answer(stream);
            setCallStatus("ongoing"); // Optimistically set ongoing to remove overlay, or wait for stream? 
            // Better to keep "Connecting" until stream arrives? 
            // User complained it was stuck. Let's force "ongoing" but show logs.

        } catch (error) {
            addLog(`Answer Error: ${error} `);
            onClose();
        }
    };

    // Effect to auto-close call if stuck in 'connecting' for too long
    useEffect(() => {
        setConnectingAvatarError(false);
    }, [remoteUserId]);

    const handleReject = () => {
        if (currentCallRef.current) currentCallRef.current.close();
        onClose();
    };

    // --- PIP DRAGGING LOGIC ---
    const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const handlePipMouseDown = (e) => {
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - pipPosition.x,
            y: e.clientY - pipPosition.y
        };
        e.stopPropagation(); // Don't bubble to overlay
    };

    const handlePipTouchStart = (e) => {
        const touch = e.touches[0];
        setIsDragging(true);
        dragStartRef.current = {
            x: touch.clientX - pipPosition.x,
            y: touch.clientY - pipPosition.y
        };
        e.stopPropagation();
    };

    const handleOverlayMouseMove = (e) => {
        if (!isDragging) return;
        setPipPosition({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleOverlayTouchMove = (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setPipPosition({
            x: touch.clientX - dragStartRef.current.x,
            y: touch.clientY - dragStartRef.current.y
        });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        // Optional: Snap to corners logic could go here
    };

    // --- VIDEO SWAP LOGIC ---
    const [isSwapped, setIsSwapped] = useState(false);

    // Helper to determine styles and handlers based on role (Main vs PiP)
    const renderVideoContainer = ({ isLocal, streamRef, videoRef }) => {
        // Determine if this specific video should be Main or PiP
        // Default (!swapped): Local is PiP, Remote is Main
        // Swapped: Local is Main, Remote is PiP
        const isPiP = isLocal ? !isSwapped : isSwapped;

        // Common Styles
        const baseStyle = {
            overflow: 'hidden',
            transition: isDragging ? 'none' : 'all 0.3s ease-in-out', // Smooth swap animation
        };

        // Main Style (Full Screen)
        const mainStyle = {
            ...baseStyle,
            position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'black' // Letterboxing for 'contain'
        };

        // PiP Style (Small, Floating)
        const pipStyle = {
            ...baseStyle,
            position: 'absolute',
            transform: `translate(${pipPosition.x}px, ${pipPosition.y}px)`,
            bottom: '20px', right: '20px',
            width: 'min(180px, 35%)',
            aspectRatio: '12/16', // More vertical for mobile portrait
            background: '#0a0a0a', borderRadius: '12px',
            border: '2px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 100,
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none'
        };

        // Handlers only for PiP
        const handlers = isPiP ? {
            onMouseDown: handlePipMouseDown,
            onTouchStart: handlePipTouchStart,
            onDoubleClick: (e) => { e.stopPropagation(); setIsSwapped(prev => !prev); }
        } : {
            // Allow double click on Main to swap back too? Sure.
            onDoubleClick: () => setIsSwapped(prev => !prev)
        };

        return (
            <div
                {...handlers}
                style={isPiP ? pipStyle : mainStyle}
            >
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal} // ALWAYS mute local to prevent echo
                    style={{
                        width: '100%', height: '100%',
                        // Force contain to prevent zoom/crop on mobile
                        objectFit: 'contain',
                        pointerEvents: 'none', // Pass clicks to container
                        transform: isLocal ? 'scaleX(-1)' : 'none', // Mirror local only
                        backgroundColor: '#000' // Letterboxing color
                    }}
                    // Ensure remote video plays when metadata loads
                    onLoadedMetadata={() => !isLocal && videoRef.current ? videoRef.current.play().catch(e => { }) : null}
                />
            </div>
        );
    };

    // UI Variants
    if (isMinimized) {
        return (
            <div
                className="minimized-call-bubble"
                onClick={() => setIsMinimized(false)}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px',
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                    border: '3px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 3000, boxShadow: '0 8px 24px rgba(102, 0, 153, 0.4)',
                    animation: isMicOn ? 'pulse-bubble 2s infinite' : 'none'
                }}
            >
                <img
                    src={getConstructedUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUserId || (call ? call.peer : 'Friend')}`)}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    alt="Call participant"
                    crossOrigin="anonymous"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentNode.querySelector('.avatar-fallback');
                        if (fallback) fallback.style.display = 'flex';
                    }}
                />
                < div className="avatar-fallback" style={{
                    display: 'none',
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: 'var(--primary)', color: 'white',
                    alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '1.5rem'
                }}>
                    {(remoteUserId || 'FR').substring(0, 2).toUpperCase()}
                </div >
            </div >
        );
    }

    // NEW: Compact Incoming Call Toast
    if (callStatus === 'incoming') {
        return (
            <div style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '95%',
                maxWidth: '400px',
                background: 'rgba(15, 23, 42, 0.9)', // Dark Premium BG
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                zIndex: 5000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                animation: 'slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src={getConstructedUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUserId}`)}
                            style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fff', border: '2px solid rgba(255,255,255,0.2)', objectFit: 'cover' }}
                            alt="Caller"
                            crossOrigin="anonymous"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = e.target.parentNode.querySelector('.avatar-fallback');
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                        <div className="avatar-fallback" style={{
                            display: 'none',
                            width: '48px', height: '48px', borderRadius: '50%',
                            background: 'var(--primary)', color: 'white',
                            alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold', fontSize: '1rem',
                            border: '2px solid rgba(255,255,255,0.2)'
                        }}>
                            {(remoteUserId || 'FR').substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: '12px', height: '12px', background: '#2ed573',
                            borderRadius: '50%', border: '2px solid #0f172a'
                        }} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '1rem', fontWeight: '600' }}>{remoteUserId}</h3>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {isVideoCall ? <Video size={12} /> : <Phone size={12} />}
                            Incoming {isVideoCall ? 'Video' : 'Audio'} Call...
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleReject}
                        style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: '#ff4757', border: 'none', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'transform 0.2s',
                            boxShadow: '0 4px 12px rgba(255, 71, 87, 0.3)'
                        }}
                        title="Decline"
                        className="hover-scale"
                    >
                        <PhoneOff size={18} />
                    </button>
                    <button
                        onClick={handleAnswer}
                        style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: '#2ed573',
                            border: 'none', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            boxShadow: '0 4px 12px rgba(46, 213, 115, 0.3)',
                            animation: 'pulse-green 2s infinite',
                            opacity: 1
                        }}
                        title="Answer"
                        className="hover-scale"
                    >
                        {/* Show Timer or Loading if waiting for Call Object */}
                        <Phone size={18} />
                    </button>
                </div>

                <style>{`
                    @keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
                    @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(46, 213, 115, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(46, 213, 115, 0); } 100% { box-shadow: 0 0 0 0 rgba(46, 213, 115, 0); } }
                    .hover-scale:hover { transform: scale(1.1); }
                    .hover-scale:active { transform: scale(0.95); }
                `}</style>
            </div>
        );
    }

    return (
        <div className="call-modal-overlay"
            onMouseMove={handleOverlayMouseMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchMove={handleOverlayTouchMove}
            onTouchEnd={handleDragEnd}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(135deg, rgba(0,0,0,0.95), rgba(30,0,50,0.95))',
                zIndex: 2000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', backdropFilter: 'blur(10px)',
                touchAction: 'none' // Important for touch drag
            }}
        >

            <button
                onClick={() => setIsMinimized(true)}
                style={{
                    position: 'absolute', top: '20px', right: '20px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white', padding: '10px 20px', borderRadius: '12px',
                    cursor: 'pointer', fontWeight: '600',
                    backdropFilter: 'blur(10px)'
                }}
            >
                Minimize
            </button>

            {/* Video Container */}
            <div style={{
                position: 'relative', width: '100%', maxWidth: '900px', height: '65vh',
                background: '#0a0a0a', borderRadius: '24px', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>

                {/* ERROR STATE */}
                {(peerError || mediaError) && (
                    <div style={{ textAlign: 'center', color: '#ff4757', padding: '20px', zIndex: 10 }}>
                        <PhoneOff size={48} />
                        <h3>Connection Failed</h3>
                        <p>{peerError || mediaError}</p>
                    </div>
                )}

                {/* REMOTE STREAM CONTAINER */}
                {/* Always render, just change styles */}
                {!(peerError || mediaError) && renderVideoContainer({
                    isLocal: false,
                    streamRef: null, // Remote doesn't use the simple streamRef logic
                    videoRef: remoteVideoRef
                })}

                {/* LOCAL STREAM CONTAINER */}
                {actualVideoEnabled && isCamOn && renderVideoContainer({
                    isLocal: true,
                    streamRef: localStreamRef,
                    videoRef: localVideoRef
                })}

                {/* WAITING OVERLAY */}
                {callStatus !== 'ongoing' && callStatus !== 'incoming' && !isSwapped && (
                    <div style={{ position: 'absolute', inset: 0, background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                        <div className="group-avatar-large" style={{ background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {!connectingAvatarError ? (
                                <img
                                    src={getConstructedUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${remoteUserId}`)}
                                    alt={remoteUserId}
                                    crossOrigin="anonymous"
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: connectingAvatarError ? 'none' : 'block' }}
                                    onError={() => setConnectingAvatarError(true)}
                                />
                            ) : null}
                            {connectingAvatarError && (
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)', background: 'var(--primary-soft)', width: '120px', height: '120px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {(remoteUserId || 'FR').substring(0, 2).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <h3 style={{ color: 'white', marginTop: '15px' }}>
                            {callState === 'ringing' ? 'Ringing...' : (callStatus === 'connecting' ? 'Connecting...' : 'Calling...')}
                        </h3>
                    </div>
                )}

                {/* DEBUG OVERLAY (Removed for Production) */}
                {/* {debugLogs.length > 0 && (
                    <div style={{
                        position: 'absolute', top: '20px', left: '20px',
                        background: 'rgba(0,0,0,0.7)', padding: '10px',
                        borderRadius: '8px', color: '#00ff00', fontSize: '12px',
                        fontFamily: 'monospace', zIndex: 50, maxWidth: '300px',
                        pointerEvents: 'none'
                    }}>
                        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                    </div>
                )} */}
            </div>

            {/* Controls */}
            <div style={{
                marginTop: '30px', display: 'flex', gap: '15px', alignItems: 'center',
                background: 'rgba(255,255,255,0.05)', padding: '15px 30px', borderRadius: '50px',
                backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <button
                    onClick={toggleMic}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: isMicOn ? 'rgba(255,255,255,0.1)' : '#ff4757',
                        border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                </button>

                {actualVideoEnabled && (
                    <button
                        onClick={toggleCam}
                        style={{
                            width: '56px', height: '56px', borderRadius: '50%',
                            background: isCamOn ? 'rgba(255,255,255,0.1)' : '#ff4757',
                            border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
                    </button>
                )}

                {/* SWITCH CAMERA (New) */}
                {actualVideoEnabled && isCamOn && (
                    <button
                        onClick={handleSwitchCamera}
                        style={{
                            width: '56px', height: '56px', borderRadius: '50%',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Switch Camera"
                    >
                        <SwitchCamera size={24} />
                    </button>
                )}

                <button
                    onClick={handleReject}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: '#ff4757', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <PhoneOff size={24} />
                </button>
            </div>
        </div>
    );
}
