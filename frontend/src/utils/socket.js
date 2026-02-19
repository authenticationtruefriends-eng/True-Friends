// src/socket.js
import { io } from "socket.io-client";

// Uses Vite proxy (your vite.config proxies /socket.io to :5000)
export const socket = io("/", {
  path: "/socket.io",
  transports: ["websocket"],
});
