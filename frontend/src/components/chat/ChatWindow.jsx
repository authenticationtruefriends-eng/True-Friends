import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useCall } from "../../context/CallContextDefs";
import { ArrowLeft, Phone, Video, MoreVertical, MessageSquare, Trash2, Ban, Palette } from "lucide-react";
import GroupInfo from "../group/GroupInfo";
import ImageModal from "../common/ImageModal";
import ConfirmModal from "../common/ConfirmModal";
import { getConstructedUrl } from "../../utils/urlHelper";

export default function ChatWindow({ toUser, onBack, onProfileClick }) {
    const messagesEndRef = useRef(null);
    const { socket, onlineUsers } = useSocket();
    const { user } = useAuth();
    const { conversations, addMessage, markAsRead, groups, clearChat, toggleBlock, blockedUsers, setChatWallpaper, wallpapers, editMessage: contextEditMessage } = useChat();
    const { joinGroupCall, startCall } = useCall();

    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [headerAvatarError, setHeaderAvatarError] = useState(false);
    const [viewportHeight, setViewportHeight] = useState('100%');
    const [viewportTop, setViewportTop] = useState(0);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [isTyping, setIsTyping] = useState(false);



    // Mobile Keyboard Hardening...
    useEffect(() => {
        // Inject styles for typing animation
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes dotTyping {
                0% { opacity: 0.2; transform: translateY(0); }
                50% { opacity: 1; transform: translateY(-2px); }
                100% { opacity: 0.2; transform: translateY(0); }
            }
            .dot-typing {
                width: 6px;
                height: 6px;
                background: var(--primary);
                borderRadius: 50%;
                animation: dotTyping 1.4s infinite ease-in-out;
                display: inline-block;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    // MOBILE KEYBOARD HARDENING: Use VisualViewport API
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            // Force browser to reset its internal scroll pos
            window.scrollTo(0, 0);

            setViewportHeight(`${window.visualViewport.height}px`);
            setViewportTop(window.visualViewport.offsetTop);

            // Auto-scroll messages to bottom
            if (messagesEndRef.current) {
                setTimeout(() => {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 200);
            }
        };

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        handleResize();

        return () => {
            window.visualViewport.removeEventListener('resize', handleResize);
            window.visualViewport.removeEventListener('scroll', handleResize);
        };
    }, []);

    // Reset avatar error when toUser changes
    useEffect(() => {
        setHeaderAvatarError(false);
    }, [toUser]);

    // Data derivation
    const normalizedToUser = toUser.toLowerCase();
    const isGroup = toUser.startsWith("group_");
    const groupData = isGroup ? (groups || []).find(g => g.id === toUser) : null;
    const chatName = isGroup ? (groupData ? groupData.name : "Group Chat") : toUser;

    const isOnline = !isGroup && (onlineUsers || []).includes(normalizedToUser);
    const isBlocked = !isGroup && (blockedUsers || []).includes(normalizedToUser);
    const currentWallpaper = wallpapers ? wallpapers[normalizedToUser] : null;

    const conversation = conversations[normalizedToUser] || { messages: [] };
    const messages = conversation.messages;

    // Actions
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        markAsRead(toUser);
    }, [messages, toUser, markAsRead, isTyping]);

    useEffect(() => {
        const handleClickOutside = () => setShowMenu(false);
        if (showMenu) document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showMenu]);

    // AI Typing Simulator (Re-inserted in correct scope)
    useEffect(() => {
        if (toUser !== 'ai_friend') {
            setIsTyping(false);
            return;
        }

        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.fromMe) {
            setIsTyping(true);
            // Safety timeout
            const timeout = setTimeout(() => setIsTyping(false), 30000);
            return () => clearTimeout(timeout);
        } else {
            setIsTyping(false);
        }
    }, [messages, toUser]);

    const handleSendMessage = (msg) => {
        addMessage(toUser, { ...msg, fromMe: true }, true);
    };

    const doUpdateMessage = (newText) => {
        if (!editingMessage) return;
        contextEditMessage(toUser, editingMessage.msgId, newText);
        setEditingMessage(null);
    };

    const handleStartCall = (type) => {
        if (isGroup) joinGroupCall(toUser);
        else startCall(toUser, type);
    };

    const handleChangeWallpaper = () => {
        const color = prompt("Enter a CSS color or Image URL:", currentWallpaper || "");
        if (color !== null) setChatWallpaper(toUser, color);
    };

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div
            className="chat-window"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: isMobile ? viewportHeight : '100%',
                maxHeight: isMobile ? viewportHeight : '100%',
                background: 'var(--bg-color)',
                position: isMobile ? 'fixed' : 'relative',
                top: isMobile ? viewportTop : 0,
                left: 0,
                width: '100%',
                zIndex: isMobile ? 1000 : 1,
                overflow: 'hidden'
            }}
        >
            {/* Header */}
            <div className="chat-header glass-panel" style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 101,
                flexShrink: 0
            }}>
                <div
                    onClick={() => {
                        if (isGroup) setShowGroupInfo(!showGroupInfo);
                        else if (onProfileClick) onProfileClick();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', overflow: 'hidden' }}
                >
                    <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="icon-btn" style={{ marginRight: '4px', background: 'var(--primary-soft)', color: 'var(--primary)', width: '30px', height: '30px', flexShrink: 0 }}>
                        <ArrowLeft size={16} />
                    </button>

                    <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                        {isGroup ? (
                            <div style={{
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                                color: 'white', width: '38px', height: '38px', borderRadius: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', fontSize: '0.9rem', fontWeight: 'bold'
                            }}>
                                {chatName.substring(0, 2).toUpperCase()}
                            </div>
                        ) : (
                            <>
                                {!headerAvatarError ? (
                                    <img
                                        src={getConstructedUrl(conversation.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${toUser}`)}
                                        alt=""
                                        style={{ width: '38px', height: '38px', borderRadius: '12px', objectFit: 'cover', border: '2px solid white' }}
                                        onError={() => setHeaderAvatarError(true)}
                                    />
                                ) : (
                                    <div style={{
                                        background: 'var(--primary-soft)', color: 'var(--primary)', width: '38px', height: '38px',
                                        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', fontWeight: 'bold'
                                    }}>
                                        {chatName.substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                {isOnline && <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid white' }} />}
                            </>
                        )}
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{chatName}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: '500' }}>
                            {isGroup ? `${groupData?.members?.length || 0} members` : (isBlocked ? <span style={{ color: '#ef4444' }}>Blocked 🚫</span> : (isOnline ? <span style={{ color: '#10b981' }}>● Online</span> : <span style={{ color: 'var(--text-secondary)' }}>Offline</span>))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
                    {!isGroup && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); handleStartCall('audio'); }} className="icon-btn" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', width: '32px', height: '32px' }}><Phone size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleStartCall('video'); }} className="icon-btn" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', width: '32px', height: '32px' }}><Video size={14} /></button>
                        </>
                    )}
                    {isGroup && (
                        <button onClick={(e) => { e.stopPropagation(); joinGroupCall(toUser); }} className="icon-btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', width: '32px', height: '32px' }}><Video size={14} /></button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="icon-btn" style={{ background: 'transparent', color: 'var(--text-secondary)', width: '32px', height: '32px' }}><MoreVertical size={16} /></button>

                    {showMenu && (
                        <div className="dropdown-menu glass-panel" style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '8px', minWidth: '160px', borderRadius: '16px', padding: '6px', zIndex: 110,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', background: 'var(--bg-primary)'
                        }}>
                            <button onClick={() => { setShowMenu(false); handleChangeWallpaper(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '8px', fontSize: '0.85rem' }}>
                                <Palette size={14} /> <span>Wallpaper</span>
                            </button>
                            <button onClick={() => { setShowMenu(false); setShowClearConfirm(true); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem' }}>
                                <Trash2 size={14} /> <span>Clear Chat</span>
                            </button>
                            {!isGroup && (
                                <button onClick={() => { setShowMenu(false); toggleBlock(toUser); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '8px', color: isBlocked ? '#10b981' : '#ef4444', fontSize: '0.85rem' }}>
                                    <Ban size={14} /> <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Group Info Layer */}
            {showGroupInfo && isGroup && groupData && (
                <GroupInfo group={groupData} onClose={() => setShowGroupInfo(false)} currentUserId={user?.uid} />
            )}

            <ConfirmModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={() => { clearChat(toUser); setShowClearConfirm(false); }}
                title="Clear Chat?"
                message="This will permanently delete the conversation history for ALL participants. This cannot be undone."
                confirmText="Clear Everything"
                type="danger"
            />

            {/* Messages Area */}
            <div className="messages-area" style={{
                flex: 1, minHeight: 0, padding: '1rem', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                background: currentWallpaper?.startsWith('http') ? `url(${currentWallpaper}) center/cover` : (currentWallpaper || 'var(--bg-secondary)'),
                display: 'flex', flexDirection: 'column', gap: '6px'
            }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '3rem' }}>
                        <div style={{ background: 'var(--primary-soft)', padding: '1.5rem', borderRadius: '32px', display: 'inline-block', marginBottom: '1rem' }}>
                            <MessageSquare size={40} style={{ opacity: 0.3, color: 'var(--primary)' }} />
                        </div>
                        <p style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No messages yet.</p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    const isSystem = msg.isSystem;

                    // Date Separator Logic
                    let showDateHeader = false;
                    let dateLabel = '';

                    if (!isSystem) {
                        const currentMsgDate = new Date(msg.timestamp || Date.now());
                        const prevMsg = i > 0 ? messages[i - 1] : null;
                        const prevMsgDate = prevMsg ? new Date(prevMsg.timestamp || Date.now()) : null;

                        if (!prevMsg || prevMsgDate.toDateString() !== currentMsgDate.toDateString()) {
                            showDateHeader = true;
                            const today = new Date();
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);

                            if (currentMsgDate.toDateString() === today.toDateString()) {
                                dateLabel = 'Today';
                            } else if (currentMsgDate.toDateString() === yesterday.toDateString()) {
                                dateLabel = 'Yesterday';
                            } else {
                                dateLabel = currentMsgDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                            }
                        }
                    }

                    return (
                        <div key={msg.msgId || i}>
                            {showDateHeader && (
                                <div style={{
                                    textAlign: 'center',
                                    margin: '20px 0 10px 0',
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <span style={{
                                        background: 'var(--primary-soft)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}>
                                        {dateLabel}
                                    </span>
                                </div>
                            )}

                            {msg.isSystem ? (
                                <div style={{ textAlign: 'center', margin: '15px 0', color: 'var(--primary)', opacity: 0.6, fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase' }}>
                                    ✦ {msg.text} ✦
                                </div>
                            ) : (
                                <MessageBubble
                                    message={msg}
                                    isMine={msg.fromMe}
                                    chatId={toUser}
                                    onImageClick={setPreviewImage}
                                    onEdit={(m) => setEditingMessage(m)}
                                />
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
                {toUser === 'ai_friend' && (
                    <div style={{
                        opacity: isTyping ? 1 : 0,
                        transition: 'opacity 0.3s ease',
                        padding: '0 10px',
                        marginBottom: '10px',
                        display: isTyping ? 'block' : 'none'
                    }}>
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: '8px 16px',
                            borderRadius: '16px 16px 16px 0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            marginTop: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            <span className="dot-typing"></span>
                            <span className="dot-typing" style={{ animationDelay: '0.2s' }}></span>
                            <span className="dot-typing" style={{ animationDelay: '0.4s' }}></span>
                            <span style={{ marginLeft: '8px' }}>Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {previewImage && <ImageModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}

            {/* Input Area */}
            <div style={{ padding: '0 0.5rem 0.5rem 0.5rem', flexShrink: 0, background: 'var(--bg-color)' }}>
                {!isBlocked ? (
                    <ChatInput
                        toUser={toUser}
                        onSendMessage={handleSendMessage}
                        initialText={editingMessage?.text}
                        onUpdateMessage={doUpdateMessage}
                        onCancelEditing={() => setEditingMessage(null)}
                    />
                ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-primary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Ban size={18} style={{ marginBottom: '4px', opacity: 0.5, color: '#ef4444' }} />
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Contact Blocked</p>
                    </div>
                )}
            </div>
        </div>
    );
}
