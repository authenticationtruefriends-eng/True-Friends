import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { useAuth } from '../context/AuthContext';

export function usePeer() {
    const [peer, setPeer] = useState(null);
    const [myPeerId, setMyPeerId] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [peerError, setPeerError] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // Sanitize ID for PeerJS (no spaces, lowercase)
        const sanitizedId = user.uid.replace(/\s+/g, '_').toLowerCase();

        const peerHost = window.location.hostname;
        // When using Vite proxy, we connect to the same port as the frontend
        const peerPort = window.location.port || (window.location.protocol === 'https:' ? 443 : 80);
        const peerSecure = window.location.protocol === 'https:';

        console.log(`usePeer: Initializing Peer for ${sanitizedId} on ${peerHost}:${peerPort}/peerjs`);

        const newPeer = new Peer(`truefriends-${sanitizedId}`, {
            host: peerHost,
            port: peerPort,
            path: '/peerjs',
            secure: peerSecure,
            debug: 3
        });

        newPeer.on('open', (id) => {
            console.log('✅ usePeer: Connected to signaling server. Peer ID:', id);
            setMyPeerId(id);
            setPeerError(null);
        });

        newPeer.on('call', (call) => {
            console.log('📞 usePeer: Incoming call from:', call.peer);
            setIncomingCall(call);
        });

        newPeer.on('error', (err) => {
            console.error('❌ usePeer: PeerJS Error:', err.type, err);
            setPeerError(err.type);
            // Types: 'peer-unavailable', 'network', 'browser-incompatible', etc.
        });

        setPeer(newPeer);

        return () => {
            console.log('usePeer: Destroying peer...');
            newPeer.destroy();
        };
    }, [user]);

    return { peer, myPeerId, incomingCall, setIncomingCall, peerError };
}
