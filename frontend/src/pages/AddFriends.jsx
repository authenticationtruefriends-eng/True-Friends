import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, Check, ArrowRight, Copy } from "lucide-react";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { getConstructedUrl, isExternalUrl } from "../utils/urlHelper";

export default function AddFriends() {
    const navigate = useNavigate();
    const { socket, myFriendId } = useSocket();
    const { user, finishOnboarding } = useAuth();

    // State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResult, setSearchResult] = useState(null);
    const [error, setError] = useState(null);
    const [searchPhotoError, setSearchPhotoError] = useState(false);

    useEffect(() => {
        setSearchPhotoError(false);
    }, [searchResult]);


    const handleSearch = () => {
        if (!searchTerm || !socket) return;
        setError(null);
        setSearchResult(null);

        socket.emit("search-friend", { query: searchTerm }, (response) => {
            if (response.success) {
                setSearchResult(response.user);
            } else {
                setError("User not found. Check the code.");
            }
        });
    };

    const startChat = (targetUid) => {
        // Navigate to chat
        navigate("/", { state: { startChat: targetUid } });
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h2>Find Your Crew</h2>
                    <p className="subtitle">Connect using your unique Friend Code.</p>
                </div>

                {/* My Code Section */}
                <div style={{
                    background: '#f0f0f0', padding: '15px', borderRadius: '12px',
                    marginBottom: '2rem', textAlign: 'center', border: '1px solid #ddd'
                }}>
                    <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Your Friend Code
                    </div>
                    <div style={{
                        fontSize: '1.8rem', fontWeight: 'bold', color: '#660099',
                        margin: '5px 0', letterSpacing: '2px', fontFamily: 'monospace'
                    }}>
                        {myFriendId || "Loading..."}
                    </div>
                    <button
                        onClick={() => navigator.clipboard.writeText(myFriendId)}
                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '100%' }}
                    >
                        <Copy size={14} /> Copy Code
                    </button>
                </div>

                {/* Search */}
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                    <Search size={20} color="#999" />
                    <input
                        type="text"
                        placeholder="Enter Friend Code (e.g. A7X92B)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button onClick={handleSearch} style={{ background: '#660099', color: 'white', border: 'none', padding: '0 15px', borderRadius: '0 8px 8px 0', cursor: 'pointer', fontWeight: 'bold' }}>
                        Find
                    </button>
                </div>

                {/* Search Result */}
                {error && <div style={{ color: '#ff4757', textAlign: 'center', marginBottom: '1rem' }}>{error}</div>}

                {searchResult && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '15px', background: '#e8f5e9', borderRadius: '12px',
                        marginBottom: '2rem', border: '1px solid #4cd137'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', width: '45px', height: '45px' }}>
                            {!searchPhotoError ? (
                                <img
                                    src={getConstructedUrl(searchResult.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${searchResult.uid}`)}
                                    style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'white', objectFit: 'cover', display: searchPhotoError ? 'none' : 'block' }}
                                    crossOrigin={isExternalUrl(searchResult.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${searchResult.uid}`) ? "anonymous" : undefined}
                                    onError={() => setSearchPhotoError(true)}
                                />
                            ) : null}
                            {searchPhotoError && (
                                <div className="avatar-fallback" style={{
                                    display: 'flex',
                                    width: '45px', height: '45px', borderRadius: '50%',
                                    background: 'var(--primary)', color: 'white',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', fontSize: '1rem'
                                }}>
                                    {searchResult.displayName?.substring(0, 2).toUpperCase() || searchResult.uid?.substring(0, 2).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600 }}>{searchResult.displayName}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{searchResult.friendCode}</div>
                        </div>
                        <button
                            onClick={() => startChat(searchResult.uid)}
                            style={{
                                border: 'none', background: '#4cd137', color: 'white',
                                padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                        >
                            <UserPlus size={16} /> Chat
                        </button>
                    </div>
                )}

                <div style={{ borderTop: '1px solid #eee', margin: '20px 0' }} />

                <button
                    onClick={() => {
                        finishOnboarding(); // Mark onboarding as complete to prevent redirect loop
                        navigate("/");
                    }}
                    className="login-btn"
                    style={{ background: '#333' }}
                >
                    Go to Home
                </button>
            </div>
        </div>
    );
}
