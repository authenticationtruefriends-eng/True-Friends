import { useState, useEffect } from "react";
import { X, MapPin, Star, Bell, Image, Shield, Copy, Mail, Calendar, Settings, User, LogOut, CheckCircle, Globe, Edit2, Check, AlertCircle, Phone, Camera } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useChat } from "../../context/ChatContext";
import { getConstructedUrl, isExternalUrl } from "../../utils/urlHelper";

export default function ProfileDrawer({ userId, onClose, isMe }) {
    const { user, logout, updateUserProfile } = useAuth();
    const { socket, myFriendId, isConnected } = useSocket();
    const { showToast } = useChat();
    const [friendCode, setFriendCode] = useState(isMe ? myFriendId : "");

    useEffect(() => {
        if (isMe && myFriendId) setFriendCode(myFriendId);
    }, [isMe, myFriendId]);

    // Manual ID Editing State
    const [isEditingId, setIsEditingId] = useState(false);
    const [newIdInput, setNewIdInput] = useState("");
    const [idError, setIdError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const [profile, setProfile] = useState({
        bio: "",
        location: "",
        mood: "Happy",
        phoneNumber: "",
        birthdate: "",
        gender: "Not specified",
        website: "",
        displayName: "",
        photoURL: ""
    });

    const [photoError, setPhotoError] = useState(false);

    useEffect(() => {
        setPhotoError(false);
    }, [userId, profile.photoURL]);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ ...profile });

    // Fetch Profile Data
    const fetchProfile = async (targetId) => {
        try {
            const res = await fetch(`/api/user/profile/${targetId}`);
            const data = await res.json();
            if (data.success && data.user) {
                const user = data.user;
                const newProfile = {
                    bio: user.bio || "Living in the moment. 🌟",
                    location: user.location || "Earth",
                    mood: user.mood || "Happy",
                    phoneNumber: user.phoneNumber || "Not set",
                    birthdate: user.birthdate || "",
                    gender: user.gender || "Not specified",
                    website: user.website || "",
                    displayName: user.displayName || user.uid,
                    photoURL: user.photoURL || "",
                    joinedDate: (() => {
                        try {
                            if (!user.joinedAt) return "Joined recently";
                            const date = new Date(user.joinedAt);
                            // Invalid Date check for mobile safety
                            if (isNaN(date.getTime())) return "Joined recently";
                            return date.toLocaleDateString();
                        } catch (e) {
                            return "Joined recently";
                        }
                    })(),
                    email: user.email || (isMe ? user?.email : "Private")
                };
                setProfile(newProfile);
                setEditForm(newProfile);
                setFriendCode(user.friendCode);
            }
        } catch (e) {
            console.error("Profile Fetch Error:", e);
        }
    };

    useEffect(() => {
        const uid = isMe ? user?.uid : userId;
        if (uid) {
            fetchProfile(uid);
        }
    }, [isMe, userId, user?.uid]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/user/update-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user?.uid,
                    profile: editForm
                })
            });
            const data = await res.json();
            if (data.success) {
                setProfile(editForm);
                setIsEditing(false);
                showToast("✅ Profile updated successfully!");
                // sync with socket for real-time mood/name updates if needed
                if (socket) socket.emit("update-profile", { profile: editForm });
            } else {
                showToast("❌ Update failed: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            console.error("Update Profile Error:", err);
            showToast("❌ Connection error.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveId = () => {
        if (!newIdInput.trim()) return;

        setIsSaving(true);
        setIdError("");

        let formattedId = newIdInput.trim();
        if (!formattedId.startsWith("@")) formattedId = "@" + formattedId;

        // Try REST API first (Most robust over tunnels)
        fetch("/api/user/update-friend-id", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user?.uid, newId: formattedId })
        })
            .then(res => res.json())
            .then(data => {
                setIsSaving(false);
                if (data.success) {
                    setIsEditingId(false);
                    setFriendCode(formattedId);
                    // Also notify socket if connected to update other clients
                    if (socket && isConnected) {
                        socket.emit("update-friend-id", { newId: formattedId });
                    }
                    showToast("✅ ID Updated Successfully!");
                } else {
                    setIdError(data.error || "Update failed");
                }
            })
            .catch(err => {
                setIsSaving(false);
                setIdError("Connection error. Try again.");
                console.error("ID Update Error:", err);
            });
    };

    const MoodOption = ({ emoji, label }) => {
        const isActive = isEditing ? editForm.mood === label : profile.mood === label;
        return (
            <button
                className={`mood-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                    if (!isMe) return;
                    if (isEditing) {
                        setEditForm(prev => ({ ...prev, mood: label }));
                    } else {
                        // Quick update
                        setProfile(prev => ({ ...prev, mood: label }));
                        fetch("/api/user/update-profile", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: user?.uid, profile: { mood: label } })
                        });
                    }
                }}
                title={label}
                disabled={!isMe}
            >
                {emoji}
            </button>
        );
    };

    return (
        <div className="profile-drawer">
            <div className="profile-header shadow-sm">
                <button className="close-btn" onClick={onClose}>
                    <X size={20} />
                </button>
                <span className="header-title">{isMe ? "My Account" : "User Profile"}</span>
                {isMe && (
                    <button
                        className="edit-toggle-btn"
                        onClick={() => {
                            if (isEditing) handleSaveProfile();
                            else setIsEditing(true);
                        }}
                        disabled={isSaving}
                        style={{ background: 'none', border: 'none', color: '#660099', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}
                    >
                        {isEditing ? (isSaving ? 'Saving...' : 'Save') : 'Edit'}
                        {isEditing ? <Check size={18} /> : <Edit2 size={16} />}
                    </button>
                )}
                {!isMe && <div style={{ width: 20 }}></div>}
            </div>

            <div className="profile-content">
                <div className="avatar-section">
                    <div className="avatar-wrapper">
                        <input
                            type="file"
                            ref={(ref) => window.fileInput = ref}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;

                                // Optimistic update
                                const objectUrl = URL.createObjectURL(file);
                                setProfile(prev => ({ ...prev, photoURL: objectUrl }));
                                setEditForm(prev => ({ ...prev, photoURL: objectUrl }));

                                const formData = new FormData();
                                formData.append("image", file);

                                try {
                                    setIsSaving(true);
                                    const res = await fetch("/api/upload", {
                                        method: "POST",
                                        body: formData
                                    });
                                    const data = await res.json();

                                    if (data.success) {
                                        const newPhotoURL = data.url;
                                        setProfile(prev => ({ ...prev, photoURL: newPhotoURL }));
                                        setEditForm(prev => ({ ...prev, photoURL: newPhotoURL }));

                                        // Auto-save the profile with new image
                                        await fetch("/api/user/update-profile", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                userId: user?.uid,
                                                profile: { photoURL: newPhotoURL }
                                            })
                                        });

                                        // SYNC GLOBAL STATE (Sidebar update)
                                        if (updateUserProfile) {
                                            updateUserProfile({ photoURL: newPhotoURL });
                                        }

                                        if (socket) socket.emit("update-profile", { profile: { photoURL: newPhotoURL } });
                                        showToast("✅ Profile picture updated!");
                                    } else {
                                        showToast("❌ Upload failed");
                                    }
                                } catch (err) {
                                    console.error("Upload error", err);
                                    showToast("❌ Upload error");
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                        />
                        {!photoError ? (
                            <img
                                src={getConstructedUrl(profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`)}
                                alt={userId}
                                className="profile-avatar border-glow"
                                crossOrigin={isExternalUrl(profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`) ? "anonymous" : undefined}
                                onError={() => setPhotoError(true)}
                                style={{ display: photoError ? 'none' : 'block' }}
                            />
                        ) : null}
                        {photoError && (
                            <div className="avatar-fallback profile-avatar border-glow" style={{
                                display: 'flex',
                                background: 'var(--primary)',
                                color: 'white',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '2rem'
                            }}>
                                {(profile.displayName || userId).substring(0, 2).toUpperCase()}
                            </div>
                        )}

                        {isMe && (
                            <div
                                className="avatar-edit-overlay"
                                onClick={() => window.fileInput && window.fileInput.click()}
                                title="Change Profile Picture"
                            >
                                <Camera size={24} color="white" />
                            </div>
                        )}

                        <div className="mood-badge">
                            {profile.mood === "Happy" && "😊"}
                            {profile.mood === "Busy" && "👨‍💻"}
                            {profile.mood === "Chilling" && "☕"}
                            {profile.mood === "Love" && "🥰"}
                        </div>
                    </div>
                    <h2 className="profile-user-name">
                        {isEditing ? (
                            <input
                                className="edit-name-input"
                                value={editForm.displayName}
                                onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                                placeholder="Display Name"
                            />
                        ) : (profile.displayName || userId)}
                    </h2>

                    <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
                        <span className="status-dot"></span>
                        {profile.mood || (isConnected ? 'active' : 'connecting...')}
                    </div>

                    {/* BIO SECTION */}
                    <div className="bio-section card" style={{ width: '90%', marginTop: '10px' }}>
                        <h4 className="section-label">Bio</h4>
                        {isEditing ? (
                            <textarea
                                className="edit-bio-input"
                                value={editForm.bio}
                                onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                                placeholder="Tell us about yourself..."
                                rows={3}
                            />
                        ) : (
                            <p className="bio-text">{profile.bio}</p>
                        )}
                    </div>

                    {/* ID BADGE - Clear, Copyable, and EDITABLE */}
                    {(isMe || friendCode) && (
                        <div className="id-container" style={{ marginTop: '10px' }}>
                            {!isEditingId ? (
                                <div
                                    className="id-copy-badge"
                                    onClick={() => {
                                        if (friendCode) {
                                            navigator.clipboard.writeText(friendCode);
                                            showToast("ID Copied: " + friendCode);
                                        } else if (isMe) {
                                            setIsEditingId(true);
                                        }
                                    }}
                                >
                                    <div className="id-text-group">
                                        <span className="label">USERNAME ID</span>
                                        <strong className={!friendCode ? "pulse-text" : ""}>
                                            {friendCode || "@fetching..."}
                                        </strong>
                                    </div>
                                    <div className="id-actions">
                                        {isMe && <Edit2 size={14} className="edit-icon" onClick={(e) => { e.stopPropagation(); setIsEditingId(true); }} />}
                                        {friendCode && <Copy size={14} className="copy-icon" />}
                                    </div>
                                </div>
                            ) : (
                                <div className="id-edit-box">
                                    <input
                                        type="text"
                                        value={newIdInput}
                                        onChange={(e) => setNewIdInput(e.target.value)}
                                        placeholder="@yourname"
                                        autoFocus
                                    />
                                    <div className="edit-btns">
                                        <button className="cancel-id-btn" onClick={() => setIsEditingId(false)} disabled={isSaving}>Cancel</button>
                                        <button
                                            className={`save-id-btn ${isSaving ? 'loading' : ''}`}
                                            onClick={handleSaveId}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? <Settings size={16} className="spin-icon" /> : <Check size={16} />}
                                        </button>
                                    </div>
                                    {idError && <p className="id-error-text"><AlertCircle size={12} /> {idError}</p>}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="location-row" style={{ marginTop: '10px' }}>
                        <MapPin size={12} />
                        {isEditing ? (
                            <input
                                className="edit-inline-input"
                                value={editForm.location}
                                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                                placeholder="Location"
                            />
                        ) : profile.location}
                    </div>
                </div>

                {isMe && (
                    <div className="section card">
                        <h4 className="section-label">Your Mood</h4>
                        <div className="mood-grid">
                            <MoodOption emoji="😊" label="Happy" />
                            <MoodOption emoji="👨‍💻" label="Busy" />
                            <MoodOption emoji="☕" label="Chilling" />
                            <MoodOption emoji="🥰" label="Love" />
                        </div>
                    </div>
                )}

                <div className="section card">
                    <h4 className="section-label">Identity & Contact</h4>
                    <div className="info-list">
                        <div className="info-item">
                            <Mail size={16} />
                            <div className="info-body">
                                <label>Official Email</label>
                                <span>{profile.email}</span>
                            </div>
                        </div>
                        <div className="info-item">
                            <Calendar size={16} />
                            <div className="info-body">
                                <label>Birthday</label>
                                {isEditing ? (
                                    <input
                                        type="date"
                                        className="edit-date-input"
                                        value={editForm.birthdate}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, birthdate: e.target.value }))}
                                    />
                                ) : (
                                    <span>{profile.birthdate || "Not set"}</span>
                                )}
                            </div>
                        </div>
                        <div className="info-item">
                            <Phone size={16} />
                            <div className="info-body">
                                <label>Phone</label>
                                {isEditing ? (
                                    <input
                                        className="edit-inline-input"
                                        value={editForm.phoneNumber}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                        placeholder="Phone Number"
                                    />
                                ) : (
                                    <span>{profile.phoneNumber}</span>
                                )}
                            </div>
                        </div>
                        <div className="info-item">
                            <CheckCircle size={16} />
                            <div className="info-body">
                                <label>Joined</label>
                                <span>{profile.joinedDate}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {isMe && (
                    <div className="section card">
                        <h4 className="section-label">Account Options</h4>
                        <div className="settings-stack">
                            <button className="settings-list-btn logout-item" onClick={logout}>
                                <div className="btn-start">
                                    <LogOut size={18} />
                                    <span>Disconnect / Logout</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .profile-content { padding: 1.5rem; background: #fcfcfc; }
                .card { background: white; border-radius: 16px; padding: 1.2rem; border: 1px solid #f0f0f0; margin-bottom: 1.2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
                .section-label { font-size: 0.75rem; color: #a0a0a0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; margin-top: 0; }
                
                .status-indicator { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; margin-bottom: 15px; font-weight: 500; justify-content: center; }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
                .online { color: #4caf50; }
                .online .status-dot { background: #4caf50; box-shadow: 0 0 10px rgba(76, 175, 80, 0.4); }
                .offline { color: #ff9800; }
                .offline .status-dot { background: #ff9800; animation: flash 1s infinite; }
                @keyframes flash { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

                .id-container { margin: 10px 0 20px 0; width: 100%; display: flex; justify-content: center; }
                .id-copy-badge {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 12px 20px; background: var(--accent-soft); color: var(--accent);
                    border-radius: 14px; border: 1px dashed var(--accent);
                    min-width: 240px; cursor: pointer; transition: all 0.2s;
                }
                .id-copy-badge:hover { background: #fff8e1; transform: scale(1.02); }
                .id-text-group { display: flex; flex-direction: column; align-items: flex-start; }
                .id-text-group .label { font-size: 0.65rem; font-weight: 700; opacity: 0.7; margin-bottom: 2px; }
                .id-text-group strong { font-family: monospace; font-size: 1.1rem; letter-spacing: 1px; color: #333; }
                .id-actions { display: flex; gap: 12px; opacity: 0.6; }
                .id-actions svg:hover { opacity: 1; color: var(--primary); }

                .id-edit-box { display: flex; flex-direction: column; gap: 10px; width: 100%; background: #fff; border: 1px solid var(--primary); padding: 10px; border-radius: 12px; }
                .id-edit-box input { border: 1px solid #ddd; padding: 8px 12px; border-radius: 8px; font-family: monospace; font-size: 1rem; }
                .edit-btns { display: flex; gap: 8px; }
                .save-id-btn { flex: 1; background: var(--primary); color: white; border: none; padding: 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
                .cancel-id-btn { flex: 1; background: #f0f0f0; border: none; padding: 8px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; }
                .id-error-text { color: red; font-size: 0.75rem; margin: 0; display: flex; align-items: center; gap: 4px; }

                .pulse-text { animation: pulse_gray 1.5s infinite; color: #999; }
                @keyframes pulse_gray { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

                .settings-stack { display: flex; flex-direction: column; gap: 8px; }
                .settings-list-btn {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 15px; background: #fafafa; border: 1px solid #eee;
                    border-radius: 12px; cursor: pointer; width: 100%; text-align: left;
                }
                .logout-item:hover { background: #fff5f5; border-color: #ff4757; color: #ff4757; }
                .avatar-wrapper { margin-bottom: 1.5rem; position: relative; cursor: pointer; }
                .avatar-edit-overlay {
                    position: absolute; inset: 0; background: rgba(0,0,0,0.5); border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; transition: opacity 0.2s;
                }
                .avatar-wrapper:hover .avatar-edit-overlay { opacity: 1; }
                .border-glow { border: 4px solid white; box-shadow: 0 0 20px rgba(0,0,0,0.08); }

                /* Profile Edit Styles */
                .edit-name-input {
                    border: 1px solid #ddd; padding: 5px 10px; border-radius: 8px;
                    font-size: 1.5rem; font-weight: bold; width: 80%; text-align: center;
                    color: var(--primary); outline: none;
                }
                .edit-bio-input {
                    width: 100%; border: 1px solid #eee; border-radius: 8px;
                    padding: 8px; font-size: 0.9rem; font-family: inherit;
                    color: #555; outline: none; resize: none; margin-top: 5px;
                }
                .bio-text { font-size: 0.9rem; color: #666; font-style: italic; line-height: 1.4; margin: 5px 0 0 0; }
                .edit-inline-input {
                    border: 1px solid #eee; padding: 4px 8px; border-radius: 6px;
                    font-size: 0.85rem; color: #333; outline: none; margin-left: 5px;
                }
                .edit-date-input {
                    border: 1px solid #eee; padding: 4px 8px; border-radius: 6px;
                    font-size: 0.85rem; color: #333; outline: none; display: block; width: 100%; margin-top: 5px;
                }
                .location-row { display: flex; align-items: center; justify-content: center; gap: 5px; color: #888; font-size: 0.85rem; }
                .mood-badge {
                    position: absolute; bottom: 0; right: 0; background: white;
                    width: 32px; height: 32px; border-radius: 50%; display: flex;
                    align-items: center; justify-content: center; font-size: 1.2rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #fff;
                }
                .mood-grid { display: flex; gap: 10px; justify-content: start; }
                .mood-btn {
                    font-size: 1.5rem; background: #f8f9fa; border: 2px solid transparent;
                    width: 45px; height: 45px; border-radius: 12px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .mood-btn:hover { background: #e9ecef; transform: translateY(-2px); }
                .mood-btn.active { background: var(--primary-soft); border-color: var(--primary); }
                .edit-toggle-btn:hover { opacity: 0.8; }
            `}</style>
        </div>
    );
}
