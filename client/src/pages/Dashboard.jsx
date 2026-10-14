import { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import CompanyCard from "../components/dashboard/CompanyCard";
import WelcomeWizard from "../components/dashboard/WelcomeWizard";
import companyService from "../services/companyService";
import userCompanyService from "../services/userCompanyService";
import gmailService from "../services/gmailService";
import notificationService from "../services/notificationService";
import eventService from "../services/eventService";
import userService from "../services/userService";
import searchService from "../services/searchService";
import { getSocket } from "../services/socket";

function Dashboard() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    
    // Core data
    const [companyList, setCompanyList] = useState([]);
    const [filteredCompanies, setFilteredCompanies] = useState([]);
    const [recentEmails, setRecentEmails] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [liveEvents, setLiveEvents] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    
    // Status states
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [showWizard, setShowWizard] = useState(false);

    // Global Search states
    const [searchResults, setSearchResults] = useState({
        workspaces: [],
        emails: [],
        events: [],
        notifications: [],
        aiInsights: []
    });
    const [searchLoading, setSearchLoading] = useState(false);

    // Debounced search trigger
    useEffect(() => {
        const performSearch = async () => {
            if (!search.trim()) {
                setSearchResults({
                    workspaces: [],
                    emails: [],
                    events: [],
                    notifications: [],
                    aiInsights: []
                });
                return;
            }
            setSearchLoading(true);
            try {
                const res = await searchService.search(search);
                setSearchResults(res.data || {});
            } catch (err) {
                console.error("Search query failed:", err.message);
            } finally {
                setSearchLoading(false);
            }
        };

        const delayDebounce = setTimeout(() => {
            performSearch();
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [search]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fetchDashboardData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            setError("");

            // 1. Fetch User Profile
            const profileRes = await userService.getProfile();
            const profile = profileRes.data;
            setUserProfile(profile);

            // Show wizard if onboarding is incomplete
            if (profile && !profile.isOnboarded) {
                setShowWizard(true);
            }

            // 2. Fetch all global companies
            const companyRes = await companyService.getCompanies();
            const globalComps = companyRes.data || [];

            // 3. Fetch user tracked companies
            const userCompanyRes = await userCompanyService.getUserCompanies();
            const trackedComps = userCompanyRes.data || [];

            // 4. Fetch live events
            const eventsRes = await eventService.getEvents();
            const rawEvents = eventsRes.data || [];

            // Format events with time remaining
            const formattedEvents = rawEvents.map((e) => {
                const eventDate = new Date(e.date);
                eventDate.setHours(0, 0, 0, 0);
                const diffTime = eventDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return {
                    ...e,
                    daysRemaining: diffDays,
                };
            }).filter((e) => e.daysRemaining >= 0)
              .sort((a, b) => new Date(a.date) - new Date(b.date));

            setLiveEvents(formattedEvents);

            // 5. Fetch synced placement emails
            let liveEmails = [];
            try {
                const emailsRes = await gmailService.getEmails();
                liveEmails = (emailsRes.data || []).slice(0, 3);
            } catch (emailErr) {
                console.warn("Emails fetch failed:", emailErr.message);
            }
            setRecentEmails(liveEmails);

            // 6. Fetch AI notifications
            let alerts = [];
            try {
                const notRes = await notificationService.getNotifications();
                alerts = notRes.data || [];
            } catch (notErr) {
                console.warn("Notifications fetch failed:", notErr.message);
            }
            setNotifications(alerts);

            // Merge global and tracked details
            const merged = globalComps.map((company) => {
                const tracking = trackedComps.find(
                    (tc) => tc.companyId?._id === company._id || tc.companyId === company._id
                );

                const nextCompEvent = formattedEvents.find(
                    (e) => e.companyName?.toLowerCase() === company.name.toLowerCase()
                );

                return {
                    ...company,
                    trackingId: tracking?._id || null,
                    status: tracking?.status || "Pending",
                    notes: tracking?.notes || "",
                    currentRound: tracking?.currentRound || "",
                    progress: tracking?.progress || 0,
                    nextEvent: nextCompEvent ? `${nextCompEvent.title} (${nextCompEvent.date})` : "None scheduled",
                };
            });

            setCompanyList(merged);
        } catch (err) {
            console.error(err);
            if (!silent) setError(err.response?.data?.message || err.message || "Failed to load dashboard data");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();

        // Connect Socket and listen for events
        const socketInstance = getSocket();
        if (socketInstance) {
            socketInstance.on("email_analyzed", () => fetchDashboardData(true));
            socketInstance.on("event_created", () => fetchDashboardData(true));
            socketInstance.on("notification_received", () => fetchDashboardData(true));
        }

        return () => {
            if (socketInstance) {
                socketInstance.off("email_analyzed");
                socketInstance.off("event_created");
                socketInstance.off("notification_received");
            }
        };
    }, []);

    const [localSearch, setLocalSearch] = useState("");

    // Filter companies list locally based on search/status controls
    useEffect(() => {
        const filtered = companyList.filter((company) => {
            const matchesSearch = company.name.toLowerCase().includes(localSearch.toLowerCase());
            const matchesStatus = statusFilter === "All" || company.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
        setFilteredCompanies(filtered);
    }, [localSearch, statusFilter, companyList]);

    const handleQuickSync = async () => {
        setSyncing(true);
        try {
            await gmailService.syncGmail();
            fetchDashboardData(true);
        } catch (err) {
            alert(err.response?.data?.message || "Sync failed. Make sure Gmail is connected in Settings.");
        } finally {
            setSyncing(false);
        }
    };

    // Calculate Onboarding checklist values
    const getChecklistStatus = () => {
        if (!userProfile) return { list: [], pct: 0 };
        const list = [
            { id: 1, label: "Connect Gmail sync inbox in Settings", done: !!(userProfile.googleTokens?.refresh_token || userProfile.googleId) },
            { id: 2, label: "Add your first company workspace", done: companyList.some((c) => c.status !== "Pending") },
        ];
        const doneCount = list.filter((t) => t.done).length;
        const pct = Math.round((doneCount / list.length) * 100);
        return { list, pct };
    };

    const { list: checklist, pct: checklistProgress } = getChecklistStatus();
    const nextEvent = liveEvents[0];

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-lg font-medium animate-pulse">Loading CareerSync dashboard...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error) {
        return (
            <DashboardLayout>
                <div className="p-8 bg-red-950/20 border border-red-500/30 text-red-400 rounded-2xl text-center my-10 max-w-lg mx-auto shadow-lg">
                    <p className="text-lg font-bold">Error Loading Dashboard</p>
                    <p className="text-sm mt-2 text-red-400/80">{error}</p>
                    <button
                        onClick={() => fetchDashboardData()}
                        className="mt-5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
                    >
                        Retry Connection
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            {/* Header Greeting */}
            <div className="mb-6 border-b border-slate-800 pb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
                        Welcome Back {userProfile?.name || "Student"} <span className="animate-bounce">👋</span>
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">
                        Manage target placement goals and sync real-time alerts.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <input
                        type="text"
                        placeholder="🔍 Search workspaces, emails, events, alerts..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-full sm:w-64 font-semibold"
                    />
                    <button
                        onClick={handleQuickSync}
                        disabled={syncing}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                    >
                        {syncing ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Syncing...
                            </>
                        ) : (
                            <>🔄 Sync Inbox</>
                        )}
                    </button>
                </div>
            </div>

            {search.trim() !== "" ? (
                <div className="space-y-8 mt-6">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <h2 className="text-2xl font-extrabold text-white">🔍 Global Search Results</h2>
                        <button
                            onClick={() => setSearch("")}
                            className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                            Clear Search
                        </button>
                    </div>

                    {searchLoading ? (
                        <div className="text-center py-20 text-slate-500">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm animate-pulse">Searching workspaces...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* 1. Tracked Workspaces */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">🏢 Matching Workspaces ({searchResults.workspaces?.length || 0})</h3>
                                {searchResults.workspaces?.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No matching workspaces.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {searchResults.workspaces?.map(ws => (
                                            <div
                                                key={ws._id}
                                                onClick={() => window.location.href = `/company/${ws.slug}`}
                                                className="p-5 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl transition cursor-pointer flex justify-between items-center shadow-lg hover:shadow-blue-500/5 group"
                                            >
                                                <div>
                                                    <h4 className="text-base font-bold text-white capitalize group-hover:text-blue-400 transition">{ws.name}</h4>
                                                    <p className="text-xs text-slate-400 mt-1">Round: {ws.currentRound || "N/A"} | Status: {ws.status}</p>
                                                </div>
                                                <span className="text-xs font-bold text-blue-400 bg-blue-950/20 px-3 py-1 rounded-xl border border-blue-900/40">{ws.progress}% progress</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 2. Emails */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">📧 Synced Emails ({searchResults.emails?.length || 0})</h3>
                                {searchResults.emails?.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No matching emails.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {searchResults.emails?.map(email => (
                                            <div
                                                key={email._id}
                                                onClick={() => window.location.href = `/company/${email.companySlug}`}
                                                className="p-5 bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl transition cursor-pointer shadow-lg hover:shadow-blue-500/5 group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex justify-between items-start gap-3">
                                                        <h4 className="text-sm font-bold text-white leading-snug group-hover:text-blue-400 transition line-clamp-1">{email.subject}</h4>
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 font-semibold shrink-0">{new Date(email.receivedAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-1.5">{email.company}</p>
                                                    <p className="text-xs text-slate-400 mt-3 font-medium line-clamp-2 leading-relaxed">{email.body}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 3. Calendar Events */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">📅 Calendar Events ({searchResults.events?.length || 0})</h3>
                                {searchResults.events?.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No matching events.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {searchResults.events?.map(event => (
                                            <div key={event._id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center shadow-md">
                                                <div>
                                                    <h4 className="text-xs font-bold text-white">{event.title}</h4>
                                                    <p className="text-xxs text-slate-450 mt-1 capitalize font-semibold">{event.companyName} &bull; {event.type}</p>
                                                </div>
                                                <span className="text-xs font-semibold text-slate-300">📅 {event.date}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 4. Alerts & Reminders */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">🔔 Alerts & Reminders ({searchResults.notifications?.length || 0})</h3>
                                {searchResults.notifications?.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No matching notifications.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {searchResults.notifications?.map(not => (
                                            <div key={not._id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
                                                <h4 className="text-xs font-bold text-white">{not.title}</h4>
                                                <p className="text-xs text-slate-400 mt-1 leading-normal">{not.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 5. AI Insights */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">🤖 AI summaries & Strategies ({searchResults.aiInsights?.length || 0})</h3>
                                {searchResults.aiInsights?.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No matching prep summaries.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {searchResults.aiInsights?.map((insight, idx) => (
                                            <div key={idx} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
                                                <h4 className="text-sm font-bold text-white capitalize">{insight.companyName} Workspace Insight</h4>
                                                <p className="text-xs text-slate-350 italic mt-3.5 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-850">"{insight.summary}"</p>
                                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-800/60">
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Coding Prep</h5>
                                                        <p className="text-xs text-slate-400 mt-1.5 leading-normal">{insight.codingTopics.join(", ") || "No specific topics specified"}</p>
                                                    </div>
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Interview Prep</h5>
                                                        <p className="text-xs text-slate-400 mt-1.5 leading-normal">{insight.interviewTopics.join(", ") || "No specific topics specified"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Checklist Warning Widget (if not onboarded) */}
                    {userProfile && !userProfile.isOnboarded && (
                <div className="bg-slate-900 border border-yellow-500/20 rounded-2xl p-6 mb-8 hover:border-yellow-500/30 transition relative overflow-hidden">
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-yellow-500"></div>
                    <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
                        <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-500">⚠️</span>
                                <h3 className="text-lg font-bold text-white">Complete Onboarding Setup ({checklistProgress}%)</h3>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Complete these initial steps to unlock automated AI parsing, resume document management, and statistics.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                                {checklist.map((task) => (
                                    <div key={task.id} className="flex items-center gap-2 text-xs font-semibold">
                                        <span className={task.done ? "text-green-400" : "text-slate-600"}>
                                            {task.done ? "✓" : "○"}
                                        </span>
                                        <span className={task.done ? "text-slate-400 line-through" : "text-slate-350"}>
                                            {task.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setShowWizard(true)}
                            className="px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shrink-0 self-center"
                        >
                            Open Setup Wizard
                        </button>
                    </div>
                </div>
            )}



            {/* Second Row: Nearest Schedule (2/3) and AI Suggestions (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                {/* Left - Nearest upcoming event */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/60 hover:shadow-lg transition flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>

                    <div>
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                🔥 Next Upcoming Schedule
                            </h2>
                            {nextEvent && (
                                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold rounded-full uppercase tracking-wider animate-pulse">
                                    Nearest Event
                                </span>
                            )}
                        </div>

                        {nextEvent ? (
                            <div className="mt-6 space-y-4">
                                <div>
                                    <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Company</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">{nextEvent.companyName}</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Event Name</p>
                                        <p className="text-lg text-slate-200 font-semibold mt-1">{nextEvent.title}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Scheduled Date</p>
                                        <p className="text-lg text-slate-200 font-semibold mt-1">📅 {nextEvent.date}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-500 text-xs">
                                <span>No upcoming calendar events scheduled.</span>
                                <button
                                    onClick={() => (window.location.href = "/calendar")}
                                    className="mt-3 text-blue-400 hover:underline font-semibold"
                                >
                                    + Add Manual Event
                                </button>
                            </div>
                        )}
                    </div>

                    {nextEvent && (
                        <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                            <span className="text-slate-400 text-sm font-medium">Time remaining</span>
                            <span className="text-2xl font-extrabold text-blue-500">
                                {nextEvent.daysRemaining} {nextEvent.daysRemaining === 1 ? "day" : "days"} left
                            </span>
                        </div>
                    )}
                </div>

                {/* Right - AI Suggestions Widget */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/60 hover:shadow-lg transition flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 text-slate-800 font-extrabold text-[9px] uppercase tracking-widest">
                        Gemini Live
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                            🤖 AI Strategy Insights
                        </h2>

                        <div className="space-y-4">
                            {notifications.length > 0 ? (
                                <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-500/20">
                                    <p className="text-xs uppercase tracking-wider font-bold text-blue-400">AI Warning</p>
                                    <p className="text-sm font-semibold text-white mt-1">{notifications[0].title}</p>
                                    <p className="text-xs text-slate-400 mt-1">{notifications[0].message}</p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg bg-blue-950/10 border border-blue-500/20">
                                    <p className="text-xs uppercase tracking-wider font-bold text-blue-400">System Ready</p>
                                    <p className="text-sm font-semibold text-white mt-1">Inbox Analysed</p>
                                    <p className="text-xs text-slate-400 mt-1">Sync your inbox to generate tailored strategy tips automatically.</p>
                                </div>
                            )}

                            <div className="p-4 rounded-lg bg-slate-950 border border-slate-850">
                                <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Suggested Prep</p>
                                <ul className="text-xs text-slate-350 mt-2 space-y-2 list-disc list-inside">
                                    <li>Revise Dynamic Programming and Trees before Google tests.</li>
                                    <li>Prepare core Object Oriented Design concepts.</li>
                                    <li>Read system design guides.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Third Row: Companies Catalog (2/3) and Recent Emails (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                {/* Left - Tracked Target Companies */}
                <div className="lg:col-span-2">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            🏢 Placement Tracker List
                        </h2>

                        <div className="flex gap-2 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="🔍 Filter list by name..."
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 flex-1 md:flex-initial"
                            />

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-350 focus:outline-none cursor-pointer"
                            >
                                <option value="All">All statuses</option>
                                <option value="Active">Active</option>
                                <option value="Applied">Applied</option>
                                <option value="Completed">Completed</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Offer Received">Offer Received</option>
                                <option value="Pending">Not Tracked (Pending)</option>
                            </select>
                        </div>
                    </div>

                    {filteredCompanies.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-slate-850 rounded-2xl">
                            <p className="text-lg font-bold text-slate-400">No tracked companies found</p>
                            <p className="text-xs mt-1">Discover new target placements or adjust status filters.</p>
                            <button
                                onClick={() => (window.location.href = "/companies")}
                                className="mt-4 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-xl transition cursor-pointer"
                            >
                                Discover Companies
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredCompanies.map((company) => (
                                <CompanyCard key={company.name} company={company} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right - Recent Synced Emails */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/60 hover:shadow-lg transition flex flex-col justify-between shadow-md">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                            📧 Recent Sync Alerts
                        </h2>

                        {recentEmails.length > 0 ? (
                            <div className="space-y-4">
                                {recentEmails.map((email) => {
                                    const dateVal = email.receivedAt 
                                        ? new Date(email.receivedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) 
                                        : email.date || "N/A";
                                    
                                    return (
                                        <div
                                            key={email._id}
                                            className="p-4 rounded-lg bg-slate-950 border border-slate-850 hover:border-blue-500/20 transition duration-200 cursor-pointer"
                                            onClick={() => (window.location.href = `/company/${email.companySlug}`)}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <p className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{email.sender}</p>
                                                <span className="text-[9px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 shrink-0 font-medium">
                                                    {dateVal}
                                                </span>
                                            </div>
                                            <p className="text-xxs font-bold text-blue-400 mt-1 uppercase tracking-wider">{email.company}</p>
                                            <p className="text-xs text-slate-400 mt-2 font-medium line-clamp-1">{email.subject}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-500 text-xs italic">
                                No synced placement emails found.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            </>)}

            {/* Welcome Wizard Modal */}
            {showWizard && (
                <WelcomeWizard
                    onClose={() => setShowWizard(false)}
                    onComplete={() => {
                        setShowWizard(false);
                        fetchDashboardData();
                    }}
                />
            )}

        </DashboardLayout>
    );
}

export default Dashboard;