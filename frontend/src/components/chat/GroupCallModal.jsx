import { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";

// Simple Mesh P2P Group Call Modal
export default function GroupCallModal({ groupId, onClose }) {
    const context = useSocket();
    const socket = context?.socket;
    const { user } = useAuth();
    const currentUserId = user?.uid;

    const [peers, setPeers] = useState([]); // Array of { userId, stream }
    const [localStream, setLocalStream] = useState(null);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const [error, setError] = useState(null); // Track initialization errors

    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null); // Fix: Add missing ref
    const peersRef = useRef({}); // { [userId]: RTCPeerConnection }
    const streamsRef = useRef({}); // { [userId]: MediaStream }

    // Debug logging
    console.log("GroupCallModal Render. Socket:", !!socket, "User:", currentUserId);

    if (!context) return <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'red', color: 'white', zIndex: 9999, padding: 50 }}>CRITICAL ERROR: Socket Context Missing</div>;

    if (!socket) return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'black', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <h2>Connecting to server...</h2>
            <button onClick={onClose} style={{ marginTop: 20, padding: '10px 20px', background: '#333', color: 'white', border: '1px solid #555', cursor: 'pointer' }}>Cancel</button>
        </div>
    );

    if (!currentUserId) return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'black', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            Loading user profile...
        </div>
    );

    if (error) return (
        <div style={{ position: 'fixed', inset: 0, background: 'black', color: 'red', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <h3>Call Error</h3>
            <p>{error}</p>
            <button onClick={onClose} style={{ padding: '10px 20px', marginTop: 10 }}>Close</button>
        </div>
    );

    // ICE Servers (STUN only for dev; TURN needed for production)
    const rtcConfig = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" }
        ]
    };

    useEffect(() => {
        let mounted = true;

        const initCall = async () => {
            try {
                if (!socket) return;
                console.log("🚀 Starting Group Call Init...");

                // 1. Get Local Stream
                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                } catch (mediaErr) {
                    console.error("Media Access Failed:", mediaErr);
                    setError(`Camera/Mic blocked: ${mediaErr.name}. Please ensure you are using HTTPS or Localhost and have allowed permissions.`);
                    return;
                }

                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                setLocalStream(stream);
                localStreamRef.current = stream; // Fix: Assign to ref
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                // 2. Join Room
                socket.emit("join-call", { groupId, userId: currentUserId });

                // 3. Listen for Signaling
                socket.on("all-users-in-call", (usersInRoom) => {
                    console.log("👥 Existing users in call:", usersInRoom);
                    // If we are the first one, RING people!
                    if (usersInRoom.length === 0) {
                        console.log("🔔 Emitting ring-group for", groupId);
                        socket.emit("ring-group", { groupId, from: currentUserId });
                    }

                    // Create peers for existing users (We are the Initiator)
                    usersInRoom.forEach(userId => {
                        createPeer(userId, stream, true); // true = initiator
                    });
                });

                socket.on("user-connected", (userId) => {
                    console.log("👤 New user joined:", userId);
                    // Create peer for new user (They are initiator, we just wait? NO. In mesh, usually new joiner initiates? 
                    // Actually, established strategy: Existing users initiate to new joiner? 
                    // Let's stick to: "user-connected" means WE initiate offer to THEM. 
                    // Wait, if we use "all-users-in-call", valid logic determines who initiates. 
                    // Simple logic: "user-connected" -> We create peer (initiator=false, wait for offer? Or initiator=true?)

                    // CORRECTION: Standard Mesh
                    // A joins. A gets list [B, C]. A sends Offer to B, Offer to C.
                    // B receives offer from A.
                    // C receives offer from A.

                    // So "all-users-in-call" (A receives) -> A creates Peer (Init=true) for B & C.
                    // "user-connected" is NOT used for initiation if we rely on "all-users-in-call" providing list.
                    // BUT, B needs to create a peer implementation to RECEIVE A.

                    // Let's use standard logic: 
                    // A emits join. Server tells B "user-connected A". 
                    // B creates Peer for A (initiator=true? No, usually A initiates to everyone).

                    // Let's swap:
                    // A joins. Server gives A list of [B, C].
                    // A initiates offers to B and C.
                    // B receives Offer from A. B creates Peer(init=false) and Answers.
                });

                // Listen for Offer (from new joiner)
                socket.on("offer", handleReceiveOffer);

                // Listen for Answer
                socket.on("answer", handleReceiveAnswer);

                // Listen for ICE
                socket.on("ice-candidate", handleReceiveIce);

                // User Disconnected
                socket.on("user-disconnected", (userId) => {
                    console.log("✌ User left:", userId);
                    if (peersRef.current[userId]) {
                        peersRef.current[userId].close();
                        delete peersRef.current[userId];
                    }
                    delete streamsRef.current[userId];
                    setPeers(prev => prev.filter(p => p.userId !== userId));
                });

            } catch (err) {
                console.error("❌ Failed to start call:", err);
                alert("Could not access camera/microphone.");
                onClose();
            }
        };

        const createPeer = (targetUserId, stream, initiator) => {
            if (peersRef.current[targetUserId]) return peersRef.current[targetUserId];

            const peer = new RTCPeerConnection(rtcConfig);
            peersRef.current[targetUserId] = peer;

            // Add local tracks
            stream.getTracks().forEach(track => peer.addTrack(track, stream));

            // Handle ICE
            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("ice-candidate", {
                        to: targetUserId,
                        candidate: event.candidate,
                        from: currentUserId
                    });
                }
            };

            // Handle Remote Stream
            peer.ontrack = (event) => {
                streamsRef.current[targetUserId] = event.streams[0];
                setPeers(prev => {
                    if (prev.find(p => p.userId === targetUserId)) return prev;
                    return [...prev, { userId: targetUserId, stream: event.streams[0] }];
                });
            };

            // If Initiator, create Offer
            if (initiator) {
                peer.createOffer()
                    .then(offer => peer.setLocalDescription(offer))
                    .then(() => {
                        socket.emit("offer", {
                            to: targetUserId,
                            offer: peer.localDescription,
                            from: currentUserId
                        });
                    })
                    .catch(e => console.error("Offer Error", e));
            }

            return peer;
        };

        const handleReceiveOffer = async ({ offer, from }) => {
            // We are receiving an offer (likely we are B, from is A)
            // Create peer (initiator = false)
            const peer = createPeer(from, localStreamRef.current || localVideoRef.current.srcObject, false);
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            socket.emit("answer", {
                to: from,
                answer,
                from: currentUserId
            });
        };

        const handleReceiveAnswer = async ({ answer, from }) => {
            const peer = peersRef.current[from];
            if (peer) {
                await peer.setRemoteDescription(new RTCSessionDescription(answer));
            }
        };

        const handleReceiveIce = async ({ candidate, from }) => {
            const peer = peersRef.current[from];
            if (peer) {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            }
        };

        initCall();

        return () => {
            // Cleanup
            socket.off("all-users-in-call");
            socket.off("user-connected");
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
            socket.off("user-disconnected");
            socket.emit("leave-call", { groupId, userId: currentUserId });

            Object.values(peersRef.current).forEach(p => p.close());
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []); // Run once on mount

    const toggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMicOn(!isMicOn);
        }
    };

    const toggleCam = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsCamOn(!isCamOn);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: '#1a1a1a', zIndex: 3000,
            display: 'flex', flexDirection: 'column', color: 'white'
        }}>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Group Call ({peers.length + 1})</h3>
                <div style={{ background: 'red', borderRadius: '5px', padding: '5px 10px', fontSize: '0.8rem' }}>Live</div>
            </div>

            <div style={{
                flex: 1, display: 'grid',
                gridTemplateColumns: peers.length >= 1 ? '1fr 1fr' : '1fr',
                gap: '10px', padding: '10px', autoRows: '1fr'
            }}>
                {/* Local User */}
                <div style={{ position: 'relative', background: '#333', borderRadius: '10px', overflow: 'hidden' }}>
                    <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '5px' }}>
                        You {isMicOn ? '' : '🔇'}
                    </div>
                </div>

                {/* Remote Users */}
                {peers.map(p => (
                    <RemoteVideo key={p.userId} stream={p.stream} userId={p.userId} />
                ))}
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '20px', background: 'rgba(255,255,255,0.05)' }}>
                <button onClick={toggleMic} style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', background: isMicOn ? 'gray' : 'red', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isMicOn ? <Mic /> : <MicOff />}
                </button>
                <button onClick={toggleCam} style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', background: isCamOn ? 'gray' : 'red', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isCamOn ? <Video /> : <VideoOff />}
                </button>
                <button onClick={onClose} style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', background: '#ff4757', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PhoneOff />
                </button>
            </div>
        </div>
    );
}

const RemoteVideo = ({ stream, userId }) => {
    const ref = useRef();
    useEffect(() => {
        if (ref.current) ref.current.srcObject = stream;
    }, [stream]);

    return (
        <div style={{ position: 'relative', background: '#333', borderRadius: '10px', overflow: 'hidden' }}>
            <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '5px' }}>
                {userId}
            </div>
        </div>
    );
};
