import { useState, useEffect, useRef } from "react";
import authService from "../../services/authService";
import notificationService from "../../services/notificationService";
import { getSocket, disconnectSocket } from "../../services/socket";
import { useNavigate } from "react-router-dom";

function Navbar() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState("all"); // 'all', 'ai', 'calendar', 'gmail', 'system'
    const dropdownRef = useRef(null);

    const currentUser = authService.getCurrentUser();

    // Fetch initial notifications
    const fetchNotifications = async () => {
        try {
            if (authService.isAuthenticated()) {
                const res = await notificationService.getNotifications();
                setNotifications(res.data || []);
            }
        } catch (err) {
            console.warn("Failed to load notifications:", err.message);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Connect Socket and listen for events
        const socketInstance = getSocket();
        if (socketInstance) {
            socketInstance.on("notification_received", (newNotification) => {
                setNotifications((prev) => [newNotification, ...prev]);
            });
        }

        // Close dropdown when clicking outside
        const handleOutsideClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            disconnectSocket();
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, []);

    const handleLogout = () => {
        authService.logout();
        disconnectSocket();
        navigate("/");
    };

    const handleMarkAsRead = async (id) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
            );
        } catch (err) {
            console.error("Mark read failed:", err.message);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const unreads = notifications.filter((n) => !n.isRead);
            for (const n of unreads) {
                await notificationService.markAsRead(n._id);
            }
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch (err) {
            console.error("Mark all read failed:", err.message);
        }
    };

    // Calculate unread count
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    // Filter notifications list
    const filteredList = notifications.filter((n) => {
        if (filter === "all") return true;
        const titleLower = n.title.toLowerCase();
        
        if (filter === "ai") {
            return titleLower.includes("🎯") || titleLower.includes("🎤") || titleLower.includes("⏳") || titleLower.includes("ai");
        }
        if (filter === "calendar") {
            return titleLower.includes("test") || titleLower.includes("interview") || titleLower.includes("assessment") || titleLower.includes("event") || titleLower.includes("calendar");
        }
        if (filter === "gmail") {
            return titleLower.includes("email") || titleLower.includes("gmail") || titleLower.includes("inbox");
        }
        if (filter === "system") {
            return !titleLower.includes("🎯") && !titleLower.includes("🎤") && !titleLower.includes("⏳") && !titleLower.includes("test") && !titleLower.includes("interview") && !titleLower.includes("email");
        }
        return true;
    });

    return (
        <div className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950 relative z-40">
            <h2 className="text-xl font-bold text-white select-none">
                Dashboard
            </h2>

            <div className="flex gap-6 items-center">
                {/* Notification Dropdown Bell Icon */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="text-xl cursor-pointer hover:opacity-80 transition select-none flex items-center relative p-1 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700"
                        title="Notifications"
                    >
                        <span>🔔</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center animate-bounce shadow-md">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Dropdown Container */}
                    {isOpen && (
                        <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-200">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                <h3 className="font-bold text-white text-sm">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="text-[10px] text-blue-400 hover:underline cursor-pointer font-semibold uppercase tracking-wider"
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>

                            {/* Filters row */}
                            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800 bg-slate-950/40 text-[9px] font-bold uppercase tracking-wider overflow-x-auto select-none">
                                <button
                                    onClick={() => setFilter("all")}
                                    className={`px-2 py-0.5 rounded cursor-pointer ${filter === "all" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white"}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilter("ai")}
                                    className={`px-2 py-0.5 rounded cursor-pointer ${filter === "ai" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white"}`}
                                >
                                    AI
                                </button>
                                <button
                                    onClick={() => setFilter("calendar")}
                                    className={`px-2 py-0.5 rounded cursor-pointer ${filter === "calendar" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white"}`}
                                >
                                    Calendar
                                </button>
                                <button
                                    onClick={() => setFilter("gmail")}
                                    className={`px-2 py-0.5 rounded cursor-pointer ${filter === "gmail" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white"}`}
                                >
                                    Gmail
                                </button>
                                <button
                                    onClick={() => setFilter("system")}
                                    className={`px-2 py-0.5 rounded cursor-pointer ${filter === "system" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-white"}`}
                                >
                                    System
                                </button>
                            </div>

                            {/* Notifications List */}
                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-850">
                                {filteredList.length > 0 ? (
                                    filteredList.map((n) => (
                                        <div
                                            key={n._id}
                                            onClick={() => handleMarkAsRead(n._id)}
                                            className={`p-3 text-xs transition duration-200 cursor-pointer ${
                                                n.isRead ? "bg-slate-900/60 opacity-60" : "bg-slate-950/40 hover:bg-slate-950/70 border-l-2 border-blue-500"
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-1 font-semibold text-slate-100">
                                                <p>{n.title}</p>
                                                {!n.isRead && (
                                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-1"></span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-8 text-center text-slate-500 text-xs select-none">
                                        No notifications found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile Logout */}
                <button
                    onClick={handleLogout}
                    className="text-xl cursor-pointer hover:opacity-80 transition select-none p-1 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700"
                    title="Logout"
                >
                    👤
                </button>
            </div>
        </div>
    );
}

export default Navbar;