import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import ChatWindow from "../components/chat/ChatWindow";
import CallModal from "../components/chat/CallModal";
import ProfileDrawer from "../components/profile/ProfileDrawer";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const location = useLocation();
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (location.state?.startChat) {
      setSelectedUser(location.state.startChat.toLowerCase());
      // Clear state after reading to prevent re-opening on every render
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const [showProfile, setShowProfile] = useState(false);

  const handleToggleProfile = () => {
    setShowProfile(prev => !prev);
  };

  return (
    <div className={`app-layout ${selectedUser ? 'chat-active' : ''} ${showProfile ? 'profile-active' : ''}`} style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Sidebar
        onSelectUser={(uid) => {
          setSelectedUser(uid?.toLowerCase());
          setShowProfile(false);
        }}
        selectedUserId={selectedUser}
        onMyProfileClick={() => {
          setSelectedUser(null);
          setShowProfile(true);
        }}
      />

      <div className="main-area" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {selectedUser ? (
            <ChatWindow
              toUser={selectedUser}
              onBack={() => setSelectedUser(null)}
              onProfileClick={handleToggleProfile}
            />
          ) : (
            !showProfile && (
              <div className="empty-chat-state" style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'var(--text-secondary)',
                background: 'var(--bg-color)'
              }}>
                <h1 style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '1rem', fontWeight: '800' }}>True Friends</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Select a friend to start chatting!</p>
              </div>
            )
          )}
        </div>

        {showProfile && (
          <ProfileDrawer
            userId={selectedUser || user?.uid}
            isMe={!selectedUser}
            onClose={() => setShowProfile(false)}
          />
        )}
      </div>
    </div>
  );
}
