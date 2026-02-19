import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";
import { encryptMessage, decryptMessage, encryptStorage, decryptStorage, decryptMessageObject } from "../utils/encryption";

const ChatContext = createContext();

export function ChatProvider({ children }) {
    const { user } = useAuth();
    const { socket } = useSocket();
    // Structure: { [userId]: { messages: [], unread: 0, lastMessage: { text, time } } }
    const [conversations, setConversations] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);
    const [groups, setGroups] = useState([]);
    const [replyStates, setReplyStates] = useState({}); // { chatId: messageObject }
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [wallpapers, setWallpapers] = useState({});
    const [toast, setToast] = useState(null);

    // Load extra settings (Blocks, Wallpapers) - NOW ENCRYPTED
    useEffect(() => {
        if (user?.uid) {
            const savedSettings = localStorage.getItem(`true_friends_settings_${user.uid}`);
            if (savedSettings) {
                try {
                    const parsed = decryptStorage(savedSettings); // Decrypt!
                    if (parsed) {
                        setBlockedUsers(parsed.blockedUsers || []);
                        setWallpapers(parsed.wallpapers || {});
                    }
                } catch (e) {
                    console.error("Failed to load settings (decryption error)", e);
                }
            }
        }
    }, [user?.uid]);

    // Save extra settings - NOW ENCRYPTED
    useEffect(() => {
        if (user?.uid) {
            const dataToSave = { blockedUsers, wallpapers };
            localStorage.setItem(`true_friends_settings_${user.uid}`, encryptStorage(dataToSave)); // Encrypt!
        }
    }, [blockedUsers, wallpapers, user?.uid]);

    const toggleBlock = useCallback((userIdToBlock) => {
        const normalized = userIdToBlock.toLowerCase();
        setBlockedUsers(prev => {
            if (prev.includes(normalized)) {
                return prev.filter(id => id !== normalized);
            } else {
                return [...prev, normalized];
            }
        });
    }, []);

    const setChatWallpaper = useCallback((chatId, wallpaper) => {
        setWallpapers(prev => ({ ...prev, [chatId.toLowerCase()]: wallpaper }));
    }, []);

    const showToast = useCallback((message, duration = 3000) => {
        setToast(message);
        setTimeout(() => setToast(null), duration);
    }, []);

    // 1. Load from LOCAL storage on mount - NOW ENCRYPTED
    useEffect(() => {
        if (user?.uid) {
            const saved = localStorage.getItem(`true_friends_chats_${user.uid}`);
            if (saved) {
                try {
                    const parsed = decryptStorage(saved); // Decrypt!
                    if (parsed) setConversations(parsed);
                } catch (e) {
                    console.error("Failed to load local chats (decryption error)", e);
                }
            } else {
                setConversations({});
            }
            // Definitively prevent saving until the next tick
            setTimeout(() => setIsLoaded(true), 100);
        } else {
            setIsLoaded(false);
            setConversations({});
        }
    }, [user?.uid]);

    // 2. Fetch from SERVER on socket connect (Source of Truth) - DECRYPT INCOMING
    useEffect(() => {
        if (socket && user?.uid && isLoaded) {
            socket.emit("get-chat-history", { userId: user.uid }, (res) => {
                if (res.success && res.history) {
                    setConversations(prev => {
                        const merged = { ...prev };
                        Object.entries(res.history).forEach(([friendId, data]) => {
                            const normalizedId = friendId.toLowerCase();
                            const existing = merged[normalizedId] || { messages: [], unread: 0 };

                            // Merge messages, filtering out duplicates
                            const existingIds = new Set(existing.messages.map(m => (m.msgId || m.timestamp || m.id)?.toString()));
                            const newMessages = (data.messages || [])
                                .map(m => {
                                    const decrypted = decryptMessageObject(m);
                                    return {
                                        ...decrypted,
                                        fromMe: m.from === user?.uid
                                    };
                                })
                                .filter(m => {
                                    const mId = (m.msgId || m.timestamp || m.id)?.toString();
                                    if (existingIds.has(mId)) return false;
                                    const contentMatch = existing.messages.some(ex => ex.text === m.text && ex.time === m.time);
                                    return !contentMatch;
                                });

                            if (newMessages.length > 0) {
                                merged[normalizedId] = {
                                    ...existing,
                                    messages: [...existing.messages, ...newMessages],
                                    lastMessage: {
                                        ...newMessages[newMessages.length - 1],
                                        fromMe: newMessages[newMessages.length - 1].from === user?.uid
                                    }
                                };
                            }

                            // Recalculate unread count
                            const unreadCount = (merged[normalizedId]?.messages || []).filter(m => !m.fromMe && !m.seen).length;
                            if (merged[normalizedId]) {
                                merged[normalizedId].unread = unreadCount;
                            }
                        });
                        return merged;
                    });
                }
            });
        }
    }, [socket, user?.uid, isLoaded]);

    // 3. Save to local storage on change (ONLY after loaded) - NOW ENCRYPTED
    useEffect(() => {
        if (user?.uid && isLoaded) {
            try {
                localStorage.setItem(`true_friends_chats_${user.uid}`, encryptStorage(conversations)); // Encrypt!
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    console.warn("⚠️ Chat history is too large for LocalStorage. History is still safe on the server!");
                } else {
                    console.error("LocalStorage Save Error:", e);
                }
            }
        }
    }, [conversations, user?.uid, isLoaded]);



    // Request Notification Permission on Mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const addMessage = useCallback((otherUserId, message, isFromMe) => {
        const normalizedId = otherUserId?.toLowerCase();

        // 🚫 BLOCK CHECK: If receiving message from blocked user, IGNORE it.
        if (!isFromMe && blockedUsers.includes(normalizedId)) {
            console.log(`BLOCKED message from ${normalizedId}`);
            return;
        }

        // 🔔 Play Notification Sound & System Notification
        if (!isFromMe) {
            try {
                const audio = new Audio("/sounds/ringtone.mp3");
                audio.play().catch(e => console.warn("Audio play blocked:", e));

                // 🔔 System Notification (Only if tab is hidden or user receives it)
                if ("Notification" in window && Notification.permission === "granted") {
                    if (document.visibilityState === "hidden") {
                        const notification = new Notification(`New message from ${normalizedId}`, {
                            body: message.text || "Sent a photo/file",
                            icon: "/icon.png", // Ensure you have an icon or use default
                            tag: normalizedId // Prevents notification spam, updates existing one
                        });

                        notification.onclick = () => {
                            window.focus();
                            notification.close();
                        };
                    }
                }

            } catch (err) {
                console.error("Notification setup error:", err);
            }
        }

        setConversations((prev) => {
            const existing = prev[normalizedId] || { messages: [], unread: 0 };

            // Use the msgId provided by the sender/socket, or fallback to deterministic ID
            const finalMsgId = (message.msgId || message.timestamp || message.id)?.toString();
            // console.log(`[ChatContext] Adding message for ${otherUserId}:`, { finalMsgId, text: message.text, isFromMe });

            // Prevent duplicate messages (especially useful for multi-tab sync)
            // Use msgId as the unique key if available, otherwise fallback to index/text check for safety
            const isDuplicate = existing.messages.some(m => {
                const mId = (m.msgId || m.timestamp || m.id)?.toString();
                if (mId === finalMsgId) return true;
                // If no msgId, avoid duplicates based on exact text and time (brute force fallback)
                if (!message.msgId && m.text === message.text && m.time === message.time) return true;
                return false;
            });
            if (isDuplicate) return prev;

            const newMsg = {
                ...message,
                msgId: finalMsgId,
                fromMe: isFromMe,
                time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: Number(message.timestamp || Date.now()),
                seen: message.seen || false,
                reactions: message.reactions || {},
                replyTo: message.replyTo || null
            };

            const updatedMessages = [...existing.messages, newMsg];

            // Fix unread logic: Only increment if NOT from me
            const unreadCount = (!isFromMe) ? (existing.unread || 0) + 1 : existing.unread;

            return {
                ...prev,
                [normalizedId]: {
                    messages: updatedMessages,
                    unread: unreadCount,
                    lastMessage: newMsg
                }
            };
        });
    }, [blockedUsers]);

    const markAsRead = useCallback((otherUserId) => {
        const normalizedId = otherUserId?.toLowerCase();
        if (socket && user?.uid) {
            // Backend expects 'groupId' as the target Chat ID
            socket.emit("message-seen", { groupId: normalizedId, from: user.uid });
        }

        setConversations((prev) => {
            if (!prev[normalizedId] || prev[normalizedId].unread === 0) return prev;
            return {
                ...prev,
                [normalizedId]: {
                    ...prev[normalizedId],
                    unread: 0
                }
            };
        });
    }, [socket, user?.uid]);

    const setSeenByOthers = useCallback((otherUserId) => {
        const normalizedId = otherUserId?.toLowerCase();
        setConversations(prev => {
            const existing = prev[normalizedId];
            if (!existing || existing.messages.length === 0) return prev;

            // Mark ALL messages from me as seen (since the user opened the chat)
            const updatedMessages = existing.messages.map(m => {
                if (m.fromMe && !m.seen) {
                    return { ...m, seen: true };
                }
                return m;
            });

            return {
                ...prev,
                [normalizedId]: {
                    ...existing,
                    messages: updatedMessages
                }
            };
        });
    }, []);

    const setReplyTo = useCallback((chatId, message) => {
        setReplyStates(prev => ({ ...prev, [chatId.toLowerCase()]: message }));
    }, []);

    const clearReplyTo = useCallback((chatId) => {
        setReplyStates(prev => {
            const newState = { ...prev };
            delete newState[chatId.toLowerCase()];
            return newState;
        });
    }, []);

    const clearChat = useCallback((otherUserId) => {
        const normalizedId = otherUserId?.toLowerCase();
        console.log("🚀 Emitting clear-chat for:", normalizedId);
        if (socket && user) {
            socket.emit("clear-chat", { chatId: normalizedId, from: user.uid });
        } else {
            console.error("❌ Cannot clear chat: socket or user missing", { socket: !!socket, user: !!user });
        }
    }, [socket, user]);

    const addReaction = useCallback((chatId, messageId, emoji) => {
        const normalizedId = chatId.toLowerCase();
        if (!socket || !user) return;
        socket.emit("add-reaction", { chatId: normalizedId, messageId, emoji, from: user.uid });

        setConversations(prev => {
            const existing = prev[normalizedId];
            if (!existing) return prev;
            const targetIdStr = messageId?.toString();
            const updatedMessages = existing.messages.map(m => {
                const messageIds = [m.msgId, m.timestamp?.toString(), m.id?.toString()].filter(Boolean);
                if (messageIds.includes(targetIdStr)) {
                    const reactions = { ...m.reactions };
                    if (!reactions[emoji]) reactions[emoji] = [];
                    if (!reactions[emoji].includes(user.uid)) {
                        reactions[emoji] = [...reactions[emoji], user.uid];
                    }
                    return { ...m, reactions };
                }
                return m;
            });
            return {
                ...prev,
                [normalizedId]: { ...existing, messages: updatedMessages }
            };
        });
    }, [socket, user]);


    const deleteMessage = useCallback((chatId, messageId, deleteType = 'everyone') => {
        const normalizedId = chatId.toLowerCase();
        if (!user) return;

        if (deleteType === 'local') {
            // Delete for Me - remove from local state only
            const targetIdStr = messageId?.toString();
            console.log(`[ChatContext] deleteMessage (local) for ${normalizedId}, targetId: ${targetIdStr}`);
            setConversations(prev => {
                const existing = prev[normalizedId];
                if (!existing || !existing.messages) return prev;

                const updatedMessages = existing.messages.filter(m => {
                    const messageIds = [m.msgId?.toString(), m.timestamp?.toString(), m.id?.toString()].filter(Boolean);
                    const match = messageIds.includes(targetIdStr);
                    if (match) console.log(`  -> Removing message (local):`, m.text);
                    return !match;
                });

                // Update last message if needed
                const lastMsgObj = updatedMessages[updatedMessages.length - 1];
                const lastMsg = lastMsgObj || { text: '', timestamp: Date.now() };

                return {
                    ...prev,
                    [normalizedId]: {
                        ...existing,
                        messages: updatedMessages,
                        lastMessage: lastMsg
                    }
                };
            });
        } else if (deleteType === 'everyone') {
            // Delete for Everyone - emit socket event and update locally
            if (!socket) return;
            const targetIdStr = messageId?.toString();
            console.log(`[ChatContext] deleteMessage (everyone) for ${normalizedId}, targetId: ${targetIdStr}`);
            socket.emit("delete-message", { chatId: normalizedId, messageId: targetIdStr, from: user.uid });

            setConversations(prev => {
                const existing = prev[normalizedId];
                if (!existing || !existing.messages) return prev;

                const updatedMessages = existing.messages.map(m => {
                    const messageIds = [
                        m.msgId?.toString(),
                        m.timestamp?.toString(),
                        m.id?.toString()
                    ].filter(Boolean);
                    if (messageIds.includes(targetIdStr)) {
                        console.log(`  -> Match found! Marking as deleted locally.`, { text: m.text, ids: messageIds });
                        return { ...m, text: "🚫 This message was deleted", isDeleted: true, reactions: {} };
                    }
                    return m;
                });

                // If the deleted message was the last one, update the lastMessage snippet
                const lastMsgObj = existing.messages[existing.messages.length - 1];
                const lastMsgIdArray = lastMsgObj ? [lastMsgObj.msgId, lastMsgObj.timestamp?.toString(), lastMsgObj.id?.toString()].filter(Boolean) : [];
                const isLast = lastMsgIdArray.includes(targetIdStr);
                const lastMsg = isLast ? { ...existing.lastMessage, text: "🚫 This message was deleted" } : existing.lastMessage;

                return {
                    ...prev,
                    [normalizedId]: {
                        ...existing,
                        messages: updatedMessages,
                        lastMessage: lastMsg
                    }
                };
            });
        }
    }, [socket, user]);


    const editMessage = useCallback((chatId, messageId, newText) => {
        if (!socket || !user?.uid) return;
        console.log(`[ChatContext] Editing message ${messageId} in ${chatId} with: ${newText}`);

        // Optimistic UI Update
        const normalizedId = chatId.toLowerCase();
        const targetIdStr = messageId?.toString();
        setConversations(prev => {
            const existing = prev[normalizedId];
            if (!existing || !existing.messages) return prev;
            const updatedMessages = existing.messages.map(m => {
                const messageIds = [m.msgId?.toString(), m.timestamp?.toString(), m.id?.toString()].filter(Boolean);
                if (messageIds.includes(targetIdStr)) {
                    return { ...m, text: newText, isEdited: true };
                }
                return m;
            });
            // Update lastMessage if it was the one edited
            const lastMsgObj = existing.messages[existing.messages.length - 1];
            const lastMsgIdArray = lastMsgObj ? [lastMsgObj.msgId, lastMsgObj.timestamp?.toString(), lastMsgObj.id?.toString()].filter(Boolean) : [];
            const isLast = lastMsgIdArray.includes(targetIdStr);
            const lastMsg = isLast ? { ...existing.lastMessage, text: newText } : existing.lastMessage;
            return {
                ...prev,
                [normalizedId]: { ...existing, messages: updatedMessages, lastMessage: lastMsg }
            };
        });

        socket.emit("edit-message", {
            chatId: chatId.toLowerCase(),
            messageId: messageId?.toString(),
            newText: encryptMessage(newText), // ENCRYPT OUTGOING
            from: user.uid
        });
    }, [socket, user]);

    // --- GLOBAL SOCKET LISTENER ---

    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (msg) => {
            console.log("Receiving message:", msg);
            // If it's from me (relayed from another tab), the chat key should be the recipient 'to'
            // otherwise it's the sender 'from'
            const chatKey = msg.fromMe ? msg.to : msg.from;

            // DECRYPT INCOMING
            const decryptedMsg = decryptMessageObject(msg);

            addMessage(chatKey, decryptedMsg);
        };


        const handleReceiveGroupMessage = ({ groupId, message }) => {
            const normalizedId = groupId.toLowerCase();
            const isMe = message.from === user?.uid;
            // Allow if it's from someone else OR if it's from me but relayed from another tab
            if (isMe && !message.fromMe) return;
            console.log("Global Group Message Received:", normalizedId, message);

            // DECRYPT INCOMING
            const decryptedMsg = { ...decryptMessageObject(message), fromMe: isMe };

            addMessage(normalizedId, decryptedMsg, false); // Force fromMe check
        };


        const handleMyGroups = (fetchedGroups) => {
            console.log("Global Context: Groups fetched", fetchedGroups);
            setGroups(fetchedGroups);

            // Populating conversations with group messages if not already present or for sync
            setConversations(prev => {
                const newState = { ...prev };
                fetchedGroups.forEach(group => {
                    const normalizedGroupId = group.id.toLowerCase();
                    const normalizedGroupMessages = (group.messages || []).map(m => ({
                        ...decryptMessageObject(m), // DECRYPT HERE
                        fromMe: m.from === user?.uid
                    }));

                    newState[normalizedGroupId] = {
                        messages: normalizedGroupMessages,
                        unread: (prev[normalizedGroupId]?.unread || 0),
                        lastMessage: normalizedGroupMessages.length > 0 ? {
                            text: normalizedGroupMessages[normalizedGroupMessages.length - 1].text,
                            time: normalizedGroupMessages[normalizedGroupMessages.length - 1].time,
                            fromMe: normalizedGroupMessages[normalizedGroupMessages.length - 1].from === user?.uid
                        } : (prev[normalizedGroupId]?.lastMessage || null)
                    };
                });
                return newState;
            });
        };

        const handleGroupCreated = (newGroup) => {
            console.log("📥 Received handleGroupCreated:", newGroup);
            const normalizedGroupId = newGroup.id.toLowerCase();
            const normalizedGroupMessages = (newGroup.messages || []).map(m => ({
                ...decryptMessageObject(m), // DECRYPT HERE
                fromMe: m.from === user?.uid
            }));

            setGroups(prev => [...prev, newGroup]);
            setConversations(prev => ({
                ...prev,
                [normalizedGroupId]: {
                    messages: normalizedGroupMessages,
                    unread: 0,
                    lastMessage: null
                }
            }));
        };

        const handleMessageSeen = (data) => {
            console.log("Global Seen Event:", data);
            const targetId = (data.groupId || data.from)?.toLowerCase();
            setSeenByOthers(targetId);
        };

        const handleChatCleared = ({ chatId }) => {
            const normalizedId = chatId.toLowerCase();
            console.log("🗑️ Chat Cleared Event Received for:", normalizedId);
            setConversations(prev => {
                const newState = { ...prev };
                if (newState[normalizedId]) {
                    newState[normalizedId] = {
                        ...newState[normalizedId],
                        messages: [],
                        lastMessage: null
                    };
                } else {
                    // Initialize if missing
                    newState[normalizedId] = { messages: [], unread: 0, lastMessage: null };
                }
                return newState;
            });
        };



        const handleReceiveReaction = ({ chatId, messageId, emoji, from }) => {
            const normalizedId = chatId.toLowerCase();
            console.log("Global Reaction Received:", { normalizedId, messageId, emoji, from });
            setConversations(prev => {
                const existing = prev[normalizedId];
                if (!existing || !existing.messages) return prev;

                const targetIdStr = messageId?.toString();
                const updatedMessages = existing.messages.map(m => {
                    const messageIds = [
                        m.msgId?.toString(),
                        m.timestamp?.toString(),
                        m.id?.toString()
                    ].filter(Boolean);
                    if (messageIds.includes(targetIdStr)) {
                        const reactions = m.reactions ? { ...m.reactions } : {};
                        if (!reactions[emoji]) reactions[emoji] = [];
                        if (!reactions[emoji].includes(from)) {
                            reactions[emoji] = [...reactions[emoji], from];
                        }
                        return { ...m, reactions };
                    }
                    return m;
                });
                return {
                    ...prev,
                    [normalizedId]: { ...existing, messages: updatedMessages }
                };
            });
        };



        const handleMessageDeleted = ({ chatId, messageId }) => {
            const normalizedId = chatId.toLowerCase();
            const targetIdStr = messageId?.toString();
            console.log(`[ChatContext] Incoming Global Delete from ${normalizedId}, targetId: ${targetIdStr}`);

            setConversations(prev => {
                const existing = prev[normalizedId];
                if (!existing || !existing.messages) {
                    console.log(`  -> No conversation found for ${normalizedId}`);
                    return prev;
                }

                let found = false;
                const updatedMessages = existing.messages.map(m => {
                    const messageIds = [
                        m.msgId?.toString(),
                        m.timestamp?.toString(),
                        m.id?.toString()
                    ].filter(Boolean);
                    if (messageIds.includes(targetIdStr)) {
                        found = true;
                        console.log(`  -> Match found! Deleting message.`, { text: m.text, ids: messageIds });
                        return { ...m, text: "🚫 This message was deleted", isDeleted: true, reactions: {} };
                    }
                    return m;
                });

                if (!found) console.log(`  -> Message ID ${targetIdStr} NOT found in conversation with ${normalizedId}`);

                // Update lastMessage if it was the one deleted
                const lastMsgObj = existing.messages[existing.messages.length - 1];
                const lastMsgIdArray = lastMsgObj ? [lastMsgObj.msgId, lastMsgObj.timestamp?.toString(), lastMsgObj.id?.toString()].filter(Boolean) : [];
                const isLast = lastMsgIdArray.includes(targetIdStr);
                const lastMsg = isLast ? { ...existing.lastMessage, text: "🚫 This message was deleted" } : existing.lastMessage;

                return {
                    ...prev,
                    [normalizedId]: {
                        ...existing,
                        messages: updatedMessages,
                        lastMessage: lastMsg
                    }
                };
            });
        };


        const handleMessageEdited = ({ chatId, messageId, newText, updatedMsg }) => {
            console.log(`[ChatContext] INCOMING EDIT: from=${chatId}, msgId=${messageId}, text=${newText}`);
            const normalizedId = chatId.toLowerCase();
            const targetIdStr = messageId?.toString();

            // DECRYPT INCOMING EDIT
            const decryptedNewText = decryptMessage(newText);
            const decryptedUpdatedMsg = updatedMsg ? { ...updatedMsg, text: decryptMessage(updatedMsg.text) } : null;

            setConversations(prev => {
                const existing = prev[normalizedId];
                if (!existing) {
                    console.log(`  -> No conversation found for ${normalizedId}`);
                    return prev;
                }
                if (!existing.messages) {
                    console.log(`  -> No messages in conversation ${normalizedId}`);
                    return prev;
                }

                let found = false;
                const updatedMessages = existing.messages.map(m => {
                    const messageIds = [
                        m.msgId?.toString(),
                        m.timestamp?.toString(),
                        m.id?.toString()
                    ].filter(Boolean);
                    if (messageIds.includes(targetIdStr)) {
                        found = true;
                        console.log(`  -> Match found! IDs:`, messageIds);
                        // Re-calculate fromMe here too!
                        return { ...m, ...decryptedUpdatedMsg, text: decryptedNewText, isEdited: true, fromMe: m.from === user?.uid };
                    }
                    return m;
                });

                if (!found) {
                    console.log(`  -> ❌ NO MATCH for msgId ${targetIdStr} in ${existing.messages.length} messages.`);
                }

                // Update lastMessage if it was the one edited
                const lastMsgObj = existing.messages[existing.messages.length - 1];
                const lastMsgIdArray = lastMsgObj ? [lastMsgObj.msgId, lastMsgObj.timestamp?.toString(), lastMsgObj.id?.toString()].filter(Boolean) : [];
                const isLast = lastMsgIdArray.includes(targetIdStr);
                const lastMsg = isLast ? { ...existing.lastMessage, text: decryptedNewText } : existing.lastMessage;

                return {
                    ...prev,
                    [normalizedId]: {
                        ...existing,
                        messages: updatedMessages,
                        lastMessage: lastMsg
                    }
                };
            });
        };

        const handleMessageDelivered = ({ chatId, messageId }) => {
            const normalizedId = chatId.toLowerCase();
            console.log(`🚚 Message Delivered: ${messageId} to ${normalizedId}`);

            setConversations(prev => {
                const existing = prev[normalizedId];
                if (!existing || !existing.messages) return prev;

                const targetIdStr = messageId?.toString();
                const updatedMessages = existing.messages.map(m => {
                    const messageIds = [m.msgId?.toString(), m.timestamp?.toString()].filter(Boolean);
                    if (messageIds.includes(targetIdStr)) {
                        return { ...m, delivered: true };
                    }
                    return m;
                });

                return {
                    ...prev,
                    [normalizedId]: {
                        ...existing,
                        messages: updatedMessages
                    }
                };
            });
        };

        socket.on("receive-message", handleReceiveMessage);
        socket.on("receive-group-message", handleReceiveGroupMessage);
        socket.on("my-groups", handleMyGroups);
        socket.on("group-created", handleGroupCreated);
        socket.on("message-delivered", handleMessageDelivered); // Register listener
        socket.on("message-seen", handleMessageSeen);
        socket.on("receive-reaction", handleReceiveReaction);
        socket.on("message-deleted", handleMessageDeleted);
        socket.on("message-edited", handleMessageEdited);
        socket.on("chat-cleared", handleChatCleared);

        return () => {
            socket.off("receive-message", handleReceiveMessage);
            socket.off("receive-group-message", handleReceiveGroupMessage);
            socket.off("my-groups", handleMyGroups);
            socket.off("group-created", handleGroupCreated);
            socket.off("message-delivered", handleMessageDelivered); // Unregister listener
            socket.off("message-seen", handleMessageSeen);
            socket.off("receive-reaction", handleReceiveReaction);
            socket.off("message-deleted", handleMessageDeleted);
            socket.off("message-edited", handleMessageEdited);
            socket.off("chat-cleared", handleChatCleared);
        };
    }, [socket, addMessage, user?.uid]);

    return (
        <ChatContext.Provider value={{
            conversations,
            groups,
            addMessage,
            markAsRead,
            clearChat,
            addReaction,
            deleteMessage,
            editMessage,
            replyStates,
            setReplyTo,
            clearReplyTo,
            blockedUsers,
            toggleBlock,
            wallpapers,
            setChatWallpaper,
            showToast
        }}>
            {children}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '100px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(26, 26, 26, 0.95)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '50px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    zIndex: 10000,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    animation: 'toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                    {toast}
                </div>
            )}
            <style>{`
                @keyframes toastIn {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
        </ChatContext.Provider>
    );
}

export const useChat = () => useContext(ChatContext);
