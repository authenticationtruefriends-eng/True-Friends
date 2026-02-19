import { useState, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useCall } from "../../context/CallContextDefs";
import {
  Users, MessageSquare, Phone, MoreVertical, LogOut, Check, ChevronDown, Video,
  MapPin, Settings, Search, Plus, X, Camera, Mic, Image as ImageIcon, Smile, Paperclip, PawPrint, Pin
} from "lucide-react";
import Skeleton from "../common/Skeleton";
import SettingsModal from "../settings/SettingsModal";
import CreateGroupModal from '../group/CreateGroupModal';
import { getConstructedUrl, isExternalUrl } from "../../utils/urlHelper";

function GroupItem({ group, isSelected, onSelect, lastMessage }) {
  const [imageError, setImageError] = useState(false);
  const photoUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}&backgroundColor=660099`;

  return (
    <div className={`user-item ${isSelected ? "selected" : ""}`} onClick={onSelect}>
      <div style={{ position: 'relative', width: '48px', height: '48px' }}>
        {!imageError ? (
          <img
            src={photoUrl}
            className="avatar-small"
            crossOrigin="anonymous"
            onError={() => setImageError(true)}
            style={{ display: imageError ? 'none' : 'block' }}
          />
        ) : null}
        {imageError && (
          <div className="avatar-fallback avatar-small" style={{
            display: 'flex', background: 'var(--primary)', color: 'white',
            alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}>
            {group.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="user-details">
        <span className="user-name">{group.name}</span>
        <span className="last-msg">
          {lastMessage ? (
            (lastMessage.type === 'image' || lastMessage.imageUrl) ? "📷 Photo" :
              (lastMessage.type === 'audio' || lastMessage.audioUrl || lastMessage.mimeType?.startsWith('audio') || lastMessage.fileName?.includes('voice-note')) ? "🎤 Audio" :
                (lastMessage.type === 'location') ? "📍 Location" :
                  (lastMessage.type === 'video') ? "🎥 Video" :
                    (lastMessage.type === 'file' || lastMessage.fileUrl) ? "📎 File" :
                      (lastMessage.text && lastMessage.text.startsWith('U2FsdGVkX1') ? "🔒 Encrypted Message" :
                        lastMessage.text && lastMessage.text.length > 30 ? lastMessage.text.substring(0, 30) + '...' : lastMessage.text)
          ) : "Group chat"}
        </span>
      </div>
    </div>
  );
}

export default function Sidebar({ onSelectUser, selectedUserId, onMyProfileClick }) {
  const { socket, onlineUsers, myFriendId } = useSocket();
  const { user, logout } = useAuth();
  const { conversations, groups: myGroups } = useChat();
  const { myPeerId, peer } = useCall();
  const [searchTerm, setSearchTerm] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [globalSearchResult, setGlobalSearchResult] = useState(null);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [userPhotoError, setUserPhotoError] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Reset search error when result changes
  useEffect(() => {
    setGlobalSearchError(false);
  }, [globalSearchResult]);

  const [pinnedUsers, setPinnedUsers] = useState(() => {
    const saved = localStorage.getItem("true_friends_pinned");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("true_friends_pinned", JSON.stringify(pinnedUsers));
  }, [pinnedUsers]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showProfileMenu && !e.target.closest('.icon-btn') && !e.target.closest('[data-profile-menu]')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showProfileMenu]);

  const handleProfileClick = () => {
    setShowProfileMenu(false);
    if (onMyProfileClick) {
      onMyProfileClick();
    }
  };

  const togglePin = (e, uid) => {
    e.stopPropagation();
    setPinnedUsers(prev => pinnedUsers.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  // Discovery Logic: Only show AI and people you have CHATTED with.
  // SORTING: Sort by lastMessage timestamp (Descending) to show latest messages at top
  const displayableUserList = Array.from(new Set([
    "ai_friend",
    ...Object.keys(conversations)
  ]))
    .filter(uid => uid !== user?.uid && !uid.toString().includes("group_") && uid !== "ai")
    .sort((a, b) => {
      const timeA = conversations[a]?.lastMessage?.timestamp || 0;
      const timeB = conversations[b]?.lastMessage?.timestamp || 0;
      return timeB - timeA;
    });

  // Improved filter: Matches against UID or FriendCode if known
  const filterUsers = (list) => list.filter(uid => {
    const term = searchTerm.toLowerCase();
    const isAi = uid === "ai_friend";
    if (isAi) return "ai friend".includes(term);

    // Check UID
    if (uid.toLowerCase().includes(term)) return true;

    // Check if we have this user's friendCode cached in conversations or elsewhere
    const conv = conversations[uid.toLowerCase()];
    if (conv?.friendCode?.toLowerCase().includes(term)) return true;

    return false;
  });

  const displayPinned = filterUsers(displayableUserList.filter(uid => pinnedUsers.includes(uid)));
  const displayRecent = filterUsers(displayableUserList.filter(uid => !pinnedUsers.includes(uid)));

  // Global Search Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasLocalMatch = [...displayPinned, ...displayRecent].length > 0;

      if (searchTerm.length >= 2 && !hasLocalMatch) {
        setIsSearchingGlobal(true);
        fetch("/api/user/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchTerm })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.results && data.results.length > 0) {
              const firstResult = data.results.find(r => r.uid !== user?.uid);
              setGlobalSearchResult(firstResult || null);
            } else {
              setGlobalSearchResult(null);
            }
            setIsSearchingGlobal(false);
          })
          .catch(err => {
            console.error("Manual Search Error:", err);
            setIsSearchingGlobal(false);
          });
      } else {
        setGlobalSearchResult(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, socket, displayableUserList, myFriendId, user]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="user-profile">
          <div style={{ position: 'relative', width: '48px', height: '48px' }}>
            {user?.photoURL && !userPhotoError ? (
              <img
                src={getConstructedUrl(user.photoURL)}
                alt="Me"
                className="avatar-small"
                crossOrigin={isExternalUrl(user.photoURL) ? "anonymous" : undefined}
                onError={() => setUserPhotoError(true)}
                style={{ display: userPhotoError ? 'none' : 'block' }}
              />
            ) : null}
            {(userPhotoError || !user?.photoURL) && (
              <div className="avatar-fallback avatar-small" style={{
                display: 'flex',
                background: 'var(--accent)',
                color: 'white',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                width: '100%',
                height: '100%'
              }}>
                {user?.displayName?.[0]?.toUpperCase() || user?.uid?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="status-dot online" />
          </div>
          <div className="user-info">
            <h3>{user?.displayName || user?.uid}</h3>
            <span className="id-tag-accent">
              {myFriendId || "@ID..."}
            </span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: myPeerId ? '#4cd137' : '#ff4757' }} />
            <button className="icon-btn" style={{ color: 'inherit' }} onClick={() => setShowProfileMenu(!showProfileMenu)}><MoreVertical size={20} /></button>

            {showProfileMenu && (
              <div
                data-profile-menu
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  minWidth: '180px',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}>
                <button
                  onClick={handleProfileClick}
                  onTouchEnd={handleProfileClick}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    transition: 'background 0.2s',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(102, 0, 153, 0.1)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  👤 Profile
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSettings(true);
                    setShowProfileMenu(false);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowSettings(true);
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    transition: 'background 0.2s',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(102, 0, 153, 0.1)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  ⚙️ Settings
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    logout();
                    setShowProfileMenu(false);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    logout();
                    setShowProfileMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: '#ff4757',
                    transition: 'background 0.2s',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 71, 87, 0.1)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 1.5rem 0' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'inherit' }}>Chats</h3>
          <button onClick={() => setShowCreateGroup(true)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><Plus size={20} /></button>
        </div>

        <div className="search-bar" style={{ position: 'relative' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Search friends or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {isSearchingGlobal && (
            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
              <div className="spinner-mini" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          )}
        </div>
      </div>

      <div className="users-list">
        {globalSearchResult && (
          <div className="list-section" style={{ background: 'var(--accent-soft)' }}>
            <h4 className="section-title" style={{ color: 'var(--accent)' }}>World Search</h4>
            <div className="user-item" onClick={() => { onSelectUser(globalSearchResult.uid); setSearchTerm(""); setGlobalSearchResult(null); }}>
              <div style={{ position: 'relative', width: '48px', height: '48px' }}>
                {!globalSearchError ? (
                  <img
                    src={getConstructedUrl(globalSearchResult.photoURL) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${globalSearchResult.uid}`}
                    className="avatar-small"
                    crossOrigin={isExternalUrl(globalSearchResult.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${globalSearchResult.uid}`) ? "anonymous" : undefined}
                    onError={() => setGlobalSearchError(true)}
                    style={{ display: globalSearchError ? 'none' : 'block' }}
                  />
                ) : null}
                {globalSearchError && (
                  <div className="avatar-fallback avatar-small" style={{
                    display: 'flex', background: 'var(--accent)', color: 'white',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                  }}>
                    {(globalSearchResult.displayName || globalSearchResult.uid).substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="user-details">
                <span className="user-name">{globalSearchResult.displayName || globalSearchResult.uid} {globalSearchResult.uid === user?.uid && "(You)"}</span>
                <span className="last-msg" style={{ color: 'var(--accent)' }}>
                  {globalSearchResult.friendCode || "@id_not_set"}
                </span>
              </div>
            </div>
          </div>
        )}

        {myGroups.length > 0 && (
          <div className="list-section">
            <h4 className="section-title">Groups</h4>
            {myGroups.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase())).map(group => (
              <GroupItem
                key={group.id}
                group={group}
                isSelected={selectedUserId === group.id}
                onSelect={() => onSelectUser(group.id)}
                lastMessage={conversations[group.id]?.lastMessage}
                unread={conversations[group.id]?.unread}
              />
            ))}
          </div>
        )}

        {displayPinned.length > 0 && (
          <div className="list-section">
            <h4 className="section-title">Pinned</h4>
            {displayPinned.map((uid) => (
              <UserItem key={uid} uid={uid} isSelected={selectedUserId === uid} isPinned={true} conversation={conversations[uid]} isOnline={onlineUsers.includes(uid)} onSelect={() => onSelectUser(uid)} onTogglePin={(e) => togglePin(e, uid)} />
            ))}
          </div>
        )}

        <div className="list-section">
          <h4 className="section-title">Recent</h4>
          {displayRecent.length === 0 && displayPinned.length === 0 && <p style={{ padding: '0 1.5rem', fontSize: '0.8rem', color: '#999' }}>No chats found.</p>}
          {displayRecent.map((uid) => (
            <UserItem key={uid} uid={uid} isSelected={selectedUserId === uid} isPinned={false} conversation={conversations[uid]} isOnline={onlineUsers.includes(uid)} onSelect={() => onSelectUser(uid)} onTogglePin={(e) => togglePin(e, uid)} />
          ))}
        </div>
      </div>


      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </aside>
  );
}

function UserItem({ uid, isSelected, isPinned, conversation, isOnline, onSelect, onTogglePin }) {
  const [imageError, setImageError] = useState(false);
  const photoUrl = conversation?.photoURL || (uid === "ai_friend" ? "https://api.dicebear.com/7.x/bottts/svg?seed=ai_friend" : `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`);

  return (
    <div className={`user-item ${isSelected ? "selected" : ""}`} onClick={onSelect}>
      <div style={{ position: 'relative', width: '48px', height: '48px' }}>
        {!imageError ? (
          <img
            src={getConstructedUrl(photoUrl)}
            className="avatar-small"
            crossOrigin={isExternalUrl(photoUrl) ? "anonymous" : undefined}
            onError={() => setImageError(true)}
            style={{ display: imageError ? 'none' : 'block' }}
          />
        ) : null}
        {imageError && (
          <div className="avatar-fallback avatar-small" style={{
            display: 'flex',
            background: 'var(--primary)',
            color: 'white',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '0.8rem',
            width: '100%',
            height: '100%'
          }}>
            {uid?.substring(0, 2).toUpperCase()}
          </div>
        )}
        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
      </div>
      <div className="user-details">
        <div className="user-row-top">
          <span className="user-name">{uid === "ai_friend" ? "Ai Friend" : uid}</span>
          <span className="msg-time">{conversation?.lastMessage?.time}</span>
        </div>
        <div className="user-row-bottom">
          <span className="last-msg">
            {conversation?.lastMessage?.fromMe ? "You: " : ""}
            {conversation?.lastMessage ? (
              (conversation.lastMessage.type === 'image' || conversation.lastMessage.imageUrl) ? "📷 Photo" :
                (conversation.lastMessage.type === 'audio' || conversation.lastMessage.audioUrl || conversation.lastMessage.mimeType?.startsWith('audio') || conversation.lastMessage.fileName?.includes('voice-note')) ? "🎤 Audio" :
                  (conversation.lastMessage.type === 'location') ? "📍 Location" :
                    (conversation.lastMessage.type === 'video') ? "🎥 Video" :
                      (conversation.lastMessage.type === 'file' || conversation.lastMessage.fileUrl) ? "📎 File" :
                        (conversation.lastMessage.text && conversation.lastMessage.text.startsWith('U2FsdGVkX1') ?
                          (conversation.lastMessage.text.length > 200 ? "📷 Photo" : "🔒 Message") :
                          conversation.lastMessage.text && conversation.lastMessage.text.length > 30 ? conversation.lastMessage.text.substring(0, 30) + '...' : conversation.lastMessage.text)
            ) : <span style={{ fontStyle: 'italic', opacity: 0.7 }}>New contact</span>}
          </span>
          {/* Unread Badge */}
          {(conversation?.unread > 0) && (
            <span style={{
              background: '#00cc66',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              minWidth: '20px',
              height: '20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '8px',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {conversation.unread}
            </span>
          )}
          <button className={`pin-btn ${isPinned ? 'active' : ''}`} onClick={onTogglePin}><Pin size={14} fill={isPinned ? "#666" : "none"} /></button>
        </div>
      </div>
    </div>
  );
}
