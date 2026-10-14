const { Server } = require("socket.io");

let io = null;
const connectedUsers = new Map(); // Maps userId -> set of socketIds

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || "http://localhost:5173",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Register authenticated user
        socket.on("register", (userId) => {
            if (userId) {
                if (!connectedUsers.has(userId)) {
                    connectedUsers.set(userId, new Set());
                }
                connectedUsers.get(userId).add(socket.id);
                console.log(`User ${userId} registered with socket ${socket.id}`);
            }
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
            // Clean up mappings
            for (const [userId, sockets] of connectedUsers.entries()) {
                if (sockets.has(socket.id)) {
                    sockets.delete(socket.id);
                    if (sockets.size === 0) {
                        connectedUsers.delete(userId);
                    }
                    console.log(`Removed socket ${socket.id} for user ${userId}`);
                    break;
                }
            }
        });
    });

    return io;
};

// Send update to all active sockets of a user
const sendRealTimeUpdate = (userId, event, payload) => {
    if (!io) {
        console.warn("Socket.IO is not initialized yet.");
        return;
    }

    const sockets = connectedUsers.get(userId.toString());
    if (sockets && sockets.size > 0) {
        sockets.forEach((socketId) => {
            io.to(socketId).emit(event, payload);
        });
        console.log(`Dispatched real-time event "${event}" to user ${userId}`);
    }
};

module.exports = {
    initSocket,
    sendRealTimeUpdate,
};
