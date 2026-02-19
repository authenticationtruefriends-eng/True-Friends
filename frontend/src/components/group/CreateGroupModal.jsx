import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { getConstructedUrl, isExternalUrl } from '../../utils/urlHelper';

export default function CreateGroupModal({ onClose }) {
    const { socket, onlineUsers } = useSocket();
    const { user } = useAuth();
    const [groupName, setGroupName] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);

    // In a real app, we'd fetch ALL users, not just online ones. 
    // For this demo, we'll use onlineUsers + maybe hardcoded recent chats?
    // Let's rely on the `onlineUsers` list from SocketContext for now as "Friends available"

    const handleToggleUser = (uid) => {
        if (selectedUsers.includes(uid)) {
            setSelectedUsers(prev => prev.filter(id => id !== uid));
        } else {
            setSelectedUsers(prev => [...prev, uid]);
        }
    };

    const handleCreate = () => {
        if (!groupName.trim() || selectedUsers.length === 0) return;

        if (socket) {
            console.log("🔍 Testing connection (diagnostic-ping)...");
            socket.emit("diagnostic-ping", (resp) => {
                console.log("🏓 Diagnostic Response:", resp);
                if (resp !== "pong") {
                    alert("⚠️ Server is not responding to pings. Connection might be unstable.");
                    return;
                }

                console.log("📤 Emitting create-group:", { name: groupName, members: selectedUsers, createdBy: user.uid, socketId: socket.id });
                socket.emit("create-group", {
                    name: groupName,
                    members: selectedUsers,
                    createdBy: user.uid
                }, (res) => {
                    console.log("📥 create-group response:", res);
                    if (res?.success) {
                        onClose();
                    } else {
                        alert("❌ Error: " + (res?.error || "Failed to create group"));
                    }
                });
            });
        } else {
            alert("❌ Socket not initialized!");
        }
    };

    // Filter to hide self and entries starting with '@' (friend codes)
    const otherUsers = onlineUsers.filter(uid =>
        uid !== user.uid &&
        uid.toLowerCase() !== user.uid.toLowerCase() &&
        !uid.startsWith("@")
    );

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div className="glass-panel" style={{
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '2rem',
                borderRadius: '24px',
                width: '420px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--glass-border)',
                animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>Create Group</h2>
                    <button onClick={onClose} className="icon-btn" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Group Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Dream Team 🚀"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        style={{
                            width: '100%', padding: '12px 16px',
                            borderRadius: '12px', border: '2px solid var(--primary-soft)',
                            fontSize: '1rem', fontWeight: '600', outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--primary-soft)'}
                    />
                </div>

                <h4 style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>Select Members</h4>
                <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '4px' }}>
                    {onlineUsers.filter(u => u !== user.uid).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            No friends online right now.
                        </div>
                    )}
                    {onlineUsers.filter(u => u !== user.uid).map(uid => (
                        <UserSelectItem
                            key={uid}
                            uid={uid}
                            isSelected={selectedUsers.includes(uid)}
                            onToggle={() => handleToggleUser(uid)}
                        />
                    ))}
                </div>

                <button
                    onClick={handleCreate}
                    disabled={!groupName.trim() || selectedUsers.length === 0}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '16px',
                        fontSize: '1rem',
                        fontWeight: '700',
                        cursor: (!groupName.trim() || selectedUsers.length === 0) ? 'not-allowed' : 'pointer',
                        opacity: (!groupName.trim() || selectedUsers.length === 0) ? 0.6 : 1,
                        boxShadow: '0 10px 15px -3px rgba(var(--primary-h), 50%, 30%, 0.3)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (!e.target.disabled) e.target.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; }}
                >
                    Create Group
                </button>
            </div>
        </div>
    );
}

function UserSelectItem({ uid, isSelected, onToggle }) {
    const [imageError, setImageError] = useState(false);

    return (
        <div
            onClick={onToggle}
            style={{
                padding: '10px 14px',
                borderRadius: '12px',
                cursor: 'pointer',
                background: isSelected ? 'var(--primary-soft)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '6px',
                transition: 'all 0.2s',
                border: '1px solid transparent',
                borderColor: isSelected ? 'var(--primary-light)' : 'transparent'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', width: '36px', height: '36px' }}>
                {!imageError ? (
                    <img
                        src={getConstructedUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`)}
                        style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'white', display: imageError ? 'none' : 'block' }}
                        crossOrigin="anonymous"
                        onError={() => setImageError(true)}
                    />
                ) : null}
                {imageError && (
                    <div style={{
                        display: 'flex',
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'var(--primary)', color: 'white',
                        alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '0.8rem'
                    }}>
                        {uid.substring(0, 2).toUpperCase()}
                    </div>
                )}
                <span style={{ fontWeight: '600', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', marginLeft: '12px', whiteSpace: 'nowrap' }}>{uid}</span>
            </div>
            <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                border: '2px solid',
                borderColor: isSelected ? 'var(--primary)' : '#ddd',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? 'var(--primary)' : 'transparent',
                transition: 'all 0.2s'
            }}>
                {isSelected && <Check size={14} color="white" strokeWidth={3} />}
            </div>
        </div>
    );
}
