import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getApiBase } from "../utils/apiConfig";

const API_BASE = getApiBase();


const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [myFriendId, setMyFriendId] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            // Connect via Vite Proxy (Required for HTTPS/SSL to work)
            // This goes to https://host:5173/socket.io -> http://localhost:5000/socket.io
            // Connect via Absolute URL in production
            const socketUrl = API_BASE || "/";

            console.log(`🔌 Connecting socket to: ${socketUrl}`);
            const newSocket = io(socketUrl, {
                query: { userId: user.uid },
                reconnection: true,
                reconnectionAttempts: 20,
                timeout: 30000,
                transports: ['polling', 'websocket'], // Polling first is safer over tunnels
                forceNew: true
            });

            // 1. Attach listeners
            newSocket.on("online-users", (users) => {
                setOnlineUsers(users);
            });

            newSocket.on("my-profile", (data) => {
                console.log("💾 Received my-profile:", data);
                if (data.friendCode) {
                    setMyFriendId(data.friendCode);
                }
            });

            newSocket.on("connect", () => {
                console.log("✅ Socket Connected successfully:", newSocket.id);
                setIsConnected(true);

                // Fetch profile and join
                const profilePayload = {
                    userId: user.uid,
                    displayName: user.displayName || user.email?.split('@')[0] || user.uid
                };

                newSocket.emit("join", profilePayload);
                newSocket.emit("get-my-profile", profilePayload);
            });

            newSocket.on("disconnect", () => {
                console.warn("🔌 Socket Disconnected");
                setIsConnected(false);
            });

            newSocket.on("connect_error", (err) => {
                console.error("❌ Socket Connection Error:", err.message);
                setIsConnected(false);
            });

            setSocket(newSocket);

            return () => newSocket.close();
        } else {
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
    }, [user?.uid]);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers, myFriendId, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
}
