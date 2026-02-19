import { useState, useEffect } from 'react';
import { X, Ban, User, Copy } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useChat } from '../../context/ChatContext';
import { getConstructedUrl, isExternalUrl } from "../../utils/urlHelper";

export default function FriendInfo({ userId, onClose }) {
    const { socket } = useSocket();
    const { toggleBlock, blockedUsers } = useChat();
    const [friendData, setFriendData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [photoError, setPhotoError] = useState(false);

    const isBlocked = blockedUsers?.includes(userId?.toLowerCase());

    useEffect(() => {
        setPhotoError(false);
    }, [userId]);

    useEffect(() => {
        if (!socket || !userId) return;

        setLoading(true);
        // Reuse search-friend to get details by username (userId)
        socket.emit("search-friend", { query: userId }, (response) => {
            if (response.success) {
                setFriendData(response.user);
            }
            setLoading(false);
        });

    }, [socket, userId]);

    if (!userId) return null;

    return (
        <div className="group-info-overlay">
            <div className="group-info-container">
                <div className="group-info-header">
                    <h3>Contact Info</h3>
                    <button onClick={onClose} className="close-btn"><X size={24} /></button>
                </div>

                <div className="group-profile">
                    <div className="group-avatar-large" style={{ background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {friendData?.photoURL && !photoError ? (
                            <img
                                src={getConstructedUrl(friendData.photoURL)}
                                alt={userId}
                                crossOrigin={isExternalUrl(friendData.photoURL) ? "anonymous" : undefined}
                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: photoError ? 'none' : 'block' }}
                                onError={() => setPhotoError(true)}
                            />
                        ) : null}
                        {(photoError || !friendData?.photoURL) && (
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', background: 'var(--primary-soft)', width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {(friendData?.displayName || userId).substring(0, 2).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <h2>{friendData?.displayName || userId}</h2>
                    <p className="group-meta">
                        {isBlocked ? 'Blocked' : 'Friend'}
                    </p>
                </div>

                {/* Friend Code Section */}
                {friendData?.friendCode && (
                    <div style={{ margin: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Friend Code</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#660099', margin: '5px 0' }}>{friendData.friendCode}</div>
                        <button
                            onClick={() => navigator.clipboard.writeText(friendData.friendCode)}
                            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '100%' }}
                        >
                            <Copy size={14} /> Copy Code
                        </button>
                    </div>
                )}

                <div className="group-actions" style={{ marginTop: 'auto' }}>
                    <button
                        className="action-btn"
                        onClick={() => toggleBlock(userId)}
                        style={{ background: isBlocked ? '#4cd137' : '#ff4757' }}
                    >
                        <Ban size={20} />
                        {isBlocked ? 'Unblock User' : 'Block User'}
                    </button>

                    <button className="action-btn" onClick={onClose} style={{ background: 'transparent', color: '#666', border: '1px solid #ddd' }}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
