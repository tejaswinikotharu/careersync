import { io } from "socket.io-client";
import authService from "./authService";

const SOCKET_URL = import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL.replace("/api", "") 
    : "http://localhost:5000";

let socket = null;

export const getSocket = () => {
    if (!socket && authService.isAuthenticated()) {
        const user = authService.getCurrentUser();
        if (user && user._id) {
            socket = io(SOCKET_URL, {
                withCredentials: true,
                transports: ["websocket", "polling"],
            });

            socket.on("connect", () => {
                console.log("Socket.IO client connected with ID:", socket.id);
                socket.emit("register", user._id);
            });
        }
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log("Socket.IO client disconnected.");
    }
};
