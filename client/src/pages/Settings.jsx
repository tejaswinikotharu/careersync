import { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import gmailService from "../services/gmailService";
import authService from "../services/authService";
import userService from "../services/userService";
import emailSourceService from "../services/emailSourceService";

function Settings() {
    const [gmailState, setGmailState] = useState("NOT_CONNECTED");
    const [gmailEmail, setGmailEmail] = useState("");
    const [syncRunning, setSyncRunning] = useState(false);
    const [lastVerified, setLastVerified] = useState(null);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState("");
    const [error, setError] = useState("");
    const [currentUser, setCurrentUser] = useState(null);

    // Settings preferences states
    const [aiAlerts, setAiAlerts] = useState(true);
    const [systemAlerts, setSystemAlerts] = useState(true);
    const [emailAlerts, setEmailAlerts] = useState(true);
    
    // Theme options
    const [activeTheme, setActiveTheme] = useState("dark");

    // Dynamic Email Sources states
    const [emailSources, setEmailSources] = useState([]);
    const [unknownSenders, setUnknownSenders] = useState([]);
    const [newEmail, setNewEmail] = useState("");
    const [newType, setNewType] = useState("placement");
    const [newPriority, setNewPriority] = useState(1);

    // Diagnostics / Modal states
    const [testingSource, setTestingSource] = useState(null);
    const [testMetrics, setTestMetrics] = useState(null);
    const [syncRunStats, setSyncRunStats] = useState(null);

    const refreshUser = () => {
        const user = authService.getCurrentUser();
        setCurrentUser(user);
    };

    const fetchGmailStatus = async () => {
        try {
            const res = await gmailService.getGmailStatus();
            if (res.success) {
                setGmailState(res.state || "NOT_CONNECTED");
                setGmailEmail(res.email || "");
                setSyncRunning(res.syncRunning || false);
                setLastVerified(res.lastVerified || null);
            }
        } catch (err) {
            console.error("Failed to load Gmail status:", err);
            setGmailState("TRANSIENT_ERROR");
        }
    };

    const fetchEmailSources = async () => {
        try {
            const res = await emailSourceService.getEmailSources();
            if (res.data && res.data.success) {
                setEmailSources(res.data.sources || []);
                setUnknownSenders(res.data.unknownSenders || []);
            }
        } catch (err) {
            console.error("Failed to load email sources:", err);
        }
    };

    useEffect(() => {
        refreshUser();
        fetchEmailSources();
        fetchGmailStatus();
    }, []);

    const handleAddSource = async (e) => {
        e.preventDefault();
        const email = newEmail.trim().toLowerCase();
        if (!email) return;

        setError("");
        setSyncMessage("");
        setSyncLoading(true);
        try {
            await emailSourceService.addEmailSource({
                email,
                type: newType,
                priority: Number(newPriority)
            });
            setNewEmail("");
            setNewPriority(1);
            setSyncMessage("Email source added successfully!");
            await fetchEmailSources();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to add email source.");
        } finally {
            setSyncLoading(false);
        }
    };

    const handleToggleActive = async (source) => {
        try {
            setError("");
            await emailSourceService.updateEmailSource(source._id, {
                isActive: !source.isActive
            });
            await fetchEmailSources();
        } catch (err) {
            setError("Failed to toggle email source status.");
        }
    };

    const handleUpdatePriority = async (sourceId, pVal) => {
        try {
            setError("");
            await emailSourceService.updateEmailSource(sourceId, {
                priority: Number(pVal)
            });
            await fetchEmailSources();
        } catch (err) {
            setError("Failed to update email source priority.");
        }
    };

    const handleRemoveSource = async (sourceId, email) => {
        if (!window.confirm(`Remove ${email} from email sources?`)) return;
        setError("");
        setSyncMessage("");
        try {
            await emailSourceService.deleteEmailSource(sourceId);
            setSyncMessage("Email source removed successfully.");
            await fetchEmailSources();
        } catch (err) {
            setError("Failed to remove email source.");
        }
    };

    const handleQuickCategorize = async (email, type) => {
        try {
            setError("");
            setSyncMessage("");
            await emailSourceService.addEmailSource({
                email,
                type,
                priority: 1
            });
            setSyncMessage(`Quick categorized "${email}" as ${type} source.`);
            await fetchEmailSources();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to categorize unknown sender.");
        }
    };

    const handleTestSource = async (source) => {
        setTestingSource(source);
        setTestMetrics(null);
        try {
            const res = await emailSourceService.testEmailSource(source._id);
            if (res.data && res.data.success) {
                setTestMetrics(res.data.metrics);
            }
        } catch (err) {
            console.error("Test source metrics query failed:", err);
        }
    };

    const handleSyncMail = async () => {
        if (syncRunning) return;
        setError("");
        setSyncMessage("");
        setSyncLoading(true);
        setSyncRunStats(null);

        try {
            const res = await gmailService.syncGmail();
            setSyncMessage(res.message || "Mailbox synchronized successfully!");
            if (res.success && res.data) {
                setSyncRunStats(res.data);
            }
            await fetchEmailSources();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || "Sync failed. Ensure Gmail is connected.");
        } finally {
            setSyncLoading(false);
            await fetchGmailStatus();
        }
    };

    const handleConnectGmail = () => {
        setError("");
        setSyncMessage("");

        if (!window.google) {
            setError("Google Identity Services script is not loaded yet. Please refresh the page.");
            return;
        }

        try {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (!clientId || clientId.includes("YOUR_GOOGLE_CLIENT_ID") || clientId.startsWith("dummy")) {
                setError("Google Client ID is not configured. Please check VITE_GOOGLE_CLIENT_ID in client/.env.");
                return;
            }
            
            const client = window.google.accounts.oauth2.initCodeClient({
                client_id: clientId,
                scope: "https://www.googleapis.com/auth/gmail.readonly",
                ux_mode: "popup",
                access_type: "offline",
                prompt: "consent",
                callback: async (response) => {
                    if (response.code) {
                        try {
                            setSyncLoading(true);
                            await gmailService.connectGmail(response.code);
                            
                            const updatedUser = { ...currentUser, googleTokens: { refresh_token: "present" } };
                            localStorage.setItem("user", JSON.stringify(updatedUser));
                            
                            setSyncMessage("Gmail connected successfully!");
                            refreshUser();
                            await fetchGmailStatus();
                        } catch (err) {
                            console.error(err);
                            setError(err.response?.data?.message || err.message || "Failed to link Gmail account");
                        } finally {
                            setSyncLoading(false);
                        }
                    }
                },
            });

            client.requestCode();
        } catch (err) {
            console.error("GIS error:", err);
            setError("Failed to initialize Google consent popup. Check client configuration.");
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("CRITICAL WARNING: This will permanently delete your account, credentials, and all placement trackers. This operation cannot be undone. Do you wish to continue?")) {
            return;
        }

        try {
            setSyncLoading(true);
            await userService.deleteAccount();
            window.location.href = "/";
        } catch (err) {
            setError("Failed to delete account. Try again later.");
            setSyncLoading(false);
        }
    };

    const handleDisconnectGmail = async () => {
        if (!window.confirm("Are you sure you want to disconnect your Google credentials?")) {
            return;
        }
        try {
            setSyncLoading(true);
            await gmailService.disconnectGmail();
            
            const updatedUser = { ...currentUser };
            delete updatedUser.googleTokens;
            localStorage.setItem("user", JSON.stringify(updatedUser));
            
            setSyncMessage("Google Account disconnected successfully.");
            refreshUser();
            await fetchGmailStatus();
        } catch (err) {
            setError("Disconnect action failed");
        } finally {
            setSyncLoading(false);
        }
    };

    // Filter email sources by category
    const placementSources = emailSources.filter(s => s.type === "placement");
    const studentUpdateSources = emailSources.filter(s => s.type === "update");
    const ignoredSources = emailSources.filter(s => s.type === "ignored");

    return (
        <DashboardLayout>
            <div className="pb-6 border-b border-slate-800">
                <h1 className="text-4xl font-extrabold tracking-tight text-white">
                    Settings
                </h1>
                <p className="text-slate-400 mt-2 text-lg">
                    Configure your placement account integrations and trusted email sources.
                </p>
            </div>

            {/* Sync Run Statistics Modal / Notification banner */}
            {syncRunStats && (
                <div className="max-w-2xl mt-6 p-5 bg-blue-950/20 border border-blue-500/30 text-slate-350 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-800/40 pb-2">
                        <h3 className="font-bold text-white text-base">📊 Sync Run Completed</h3>
                        <button onClick={() => setSyncRunStats(null)} className="text-xs text-blue-400 hover:text-blue-300">Dismiss</button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                        <div>
                            <span className="text-slate-400 block">Fetched</span>
                            <span className="text-base text-white">{syncRunStats.emailsFetched}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Processed</span>
                            <span className="text-base text-blue-400">{syncRunStats.emailsProcessed}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Workspaces Created</span>
                            <span className="text-base text-green-400">{syncRunStats.companiesCreated}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Workspaces Updated</span>
                            <span className="text-base text-cyan-400">{syncRunStats.companiesUpdated}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Updates Attached</span>
                            <span className="text-base text-indigo-400">{syncRunStats.studentUpdatesAdded}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Ignored</span>
                            <span className="text-base text-slate-500">{syncRunStats.ignoredEmails}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Duplicates Skipped</span>
                            <span className="text-base text-amber-500">{syncRunStats.duplicateEmails}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block">Errors</span>
                            <span className="text-base text-red-500">{syncRunStats.errors?.length || 0}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Metrics Modal */}
            {testingSource && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">🧪 Health Test Results</h3>
                            <span className="text-xs text-blue-400 font-semibold truncate max-w-[200px]">{testingSource.email}</span>
                        </div>
                        {!testMetrics ? (
                            <div className="py-8 flex justify-center">
                                <span className="animate-spin text-2xl text-blue-500">⏳</span>
                            </div>
                        ) : (
                            <div className="space-y-3.5 text-xs text-slate-350 font-semibold">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Total Emails Count:</span>
                                    <span className="text-white">{testMetrics.totalEmails}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Last Email Subject:</span>
                                    <span className="text-white text-right truncate max-w-[220px]" title={testMetrics.lastEmailSubject}>
                                        {testMetrics.lastEmailSubject}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Last Sync Time:</span>
                                    <span className="text-white">
                                        {testMetrics.lastSync ? new Date(testMetrics.lastSync).toLocaleString() : "N/A"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Companies Created:</span>
                                    <span className="text-green-400">{testMetrics.companiesCreated}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Companies Updated:</span>
                                    <span className="text-cyan-400">{testMetrics.companiesUpdated}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Errors Recorded:</span>
                                    <span className="text-red-400">{testMetrics.errors}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setTestingSource(null)}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-2xl mt-8 space-y-6">
                {/* Integrations Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/50 transition duration-300 shadow-md">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3 mb-4">
                        <span className="text-2xl">🔌</span>
                        <h2 className="text-xl font-bold text-white">Integrations</h2>
                    </div>

                    <div className="space-y-6 mt-4">
                        {/* Gmail Integration Section */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-850 rounded-xl">
                            <div>
                                <h3 className="font-bold text-white flex items-center gap-2 text-base">
                                    📧 Gmail Sync
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
                                    Link your student inbox to automatically read and organize campus placement invitations, mock test alerts, and coding schedule deadlines.
                                </p>
                                {gmailEmail && (
                                    <p className="text-xxs text-blue-400 font-mono mt-1">
                                        Active: {gmailEmail}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col items-stretch gap-2 shrink-0">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold text-center select-none ${
                                    gmailState === "CONNECTED" ? "bg-green-600/10 text-green-400 border border-green-500/20" :
                                    gmailState === "TRANSIENT_ERROR" ? "bg-yellow-600/10 text-yellow-450 border border-yellow-500/25" :
                                    gmailState === "RECONNECT_REQUIRED" ? "bg-red-600/10 text-red-400 border border-red-500/20" :
                                    "bg-slate-800 text-slate-400 border border-slate-700"
                                }`}>
                                    {gmailState === "CONNECTED" ? "🟢 Connected" :
                                     gmailState === "TRANSIENT_ERROR" ? "🟡 Temporary Issue" :
                                     gmailState === "RECONNECT_REQUIRED" ? "🔴 Reconnect Required" :
                                     "⚪ Not Connected"}
                                </span>

                                {gmailState === "NOT_CONNECTED" || gmailState === "RECONNECT_REQUIRED" ? (
                                    <button
                                        onClick={handleConnectGmail}
                                        disabled={syncLoading}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-md shadow-blue-500/10 text-center"
                                    >
                                        Connect Gmail
                                    </button>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={handleSyncMail}
                                            disabled={syncLoading || syncRunning}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-850 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold cursor-pointer text-center"
                                        >
                                            {syncRunning ? "Sync in progress..." : syncLoading ? "Syncing..." : "Sync Mail"}
                                        </button>
                                        <button
                                            onClick={handleDisconnectGmail}
                                            disabled={syncLoading}
                                            className="px-4 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-red-400 rounded-xl text-xs font-semibold cursor-pointer text-center"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-900/25 border border-red-500/30 text-red-400 rounded-xl text-xs">
                                {error}
                            </div>
                        )}

                        {syncMessage && (
                            <div className="p-3 bg-green-900/25 border border-green-500/30 text-green-400 rounded-xl text-xs font-semibold">
                                {syncMessage}
                            </div>
                        )}
                    </div>
                </div>

                {/* New Dynamic Email Sources Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/50 transition duration-300 shadow-md space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3 mb-2">
                        <span className="text-2xl">🎯</span>
                        <h2 className="text-xl font-bold text-white">Email Sources Manager</h2>
                    </div>

                    {/* Add Source Form */}
                    <form onSubmit={handleAddSource} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950 p-4 border border-slate-850 rounded-xl">
                        <div className="sm:col-span-2">
                            <label className="text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Sender Email</label>
                            <input
                                type="email"
                                required
                                placeholder="e.g. coordinator@gitam.in"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                            />
                        </div>
                        <div>
                            <label className="text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Category</label>
                            <select
                                value={newType}
                                onChange={(e) => setNewType(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
                            >
                                <option value="placement">Placement</option>
                                <option value="update">Student Update</option>
                                <option value="ignored">Ignored</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={syncLoading}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl text-xs font-bold transition cursor-pointer text-center"
                            >
                                Add Source
                            </button>
                        </div>
                    </form>

                    {/* Dynamic Sections */}
                    <div className="space-y-6">
                        
                        {/* Section 1: Placement Sources */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-green-400 flex items-center gap-2">
                                🟢 Placement Sources <span className="text-xxs bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">{placementSources.length}</span>
                            </h3>
                            <p className="text-xxs text-slate-400 leading-relaxed">
                                Senders authorized to **CREATE** new company workspaces as well as update existing ones.
                            </p>
                            {placementSources.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2 pl-2">No placement sources configured.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {placementSources.map(source => (
                                        <div key={source._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl gap-3">
                                            <div className="flex items-center gap-3 truncate">
                                                <input
                                                    type="checkbox"
                                                    checked={source.isActive}
                                                    onChange={() => handleToggleActive(source)}
                                                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-800 cursor-pointer"
                                                />
                                                <span className={`text-xs font-semibold truncate ${source.isActive ? "text-slate-200" : "text-slate-500 line-through"}`}>
                                                    {source.email}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3.5 shrink-0 self-end sm:self-auto">
                                                <div className="flex items-center gap-1.5 text-xxs font-bold text-slate-400">
                                                    <span>Priority:</span>
                                                    <select
                                                        value={source.priority}
                                                        onChange={(e) => handleUpdatePriority(source._id, e.target.value)}
                                                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xxs font-semibold cursor-pointer"
                                                    >
                                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={() => handleTestSource(source)}
                                                    className="text-blue-400 hover:text-blue-300 text-xxs font-bold uppercase cursor-pointer"
                                                >
                                                    Test
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveSource(source._id, source.email)}
                                                    className="text-red-400 hover:text-red-300 text-xxs font-bold uppercase cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Section 2: Student Update Sources */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                                🔵 Student Update Sources <span className="text-xxs bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">{studentUpdateSources.length}</span>
                            </h3>
                            <p className="text-xxs text-slate-400 leading-relaxed">
                                Senders restricted to enriching existing company workspaces. They **NEVER** create new companies.
                            </p>
                            {studentUpdateSources.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2 pl-2">No student update sources configured.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {studentUpdateSources.map(source => (
                                        <div key={source._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl gap-3">
                                            <div className="flex items-center gap-3 truncate">
                                                <input
                                                    type="checkbox"
                                                    checked={source.isActive}
                                                    onChange={() => handleToggleActive(source)}
                                                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-800 cursor-pointer"
                                                />
                                                <span className={`text-xs font-semibold truncate ${source.isActive ? "text-slate-200" : "text-slate-500 line-through"}`}>
                                                    {source.email}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3.5 shrink-0 self-end sm:self-auto">
                                                <div className="flex items-center gap-1.5 text-xxs font-bold text-slate-400">
                                                    <span>Priority:</span>
                                                    <select
                                                        value={source.priority}
                                                        onChange={(e) => handleUpdatePriority(source._id, e.target.value)}
                                                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xxs font-semibold cursor-pointer"
                                                    >
                                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </div>
                                                <button
                                                    onClick={() => handleTestSource(source)}
                                                    className="text-blue-400 hover:text-blue-300 text-xxs font-bold uppercase cursor-pointer"
                                                >
                                                    Test
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveSource(source._id, source.email)}
                                                    className="text-red-400 hover:text-red-300 text-xxs font-bold uppercase cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Section 3: Ignored Sources */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                ⚪ Ignored Sources <span className="text-xxs bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-500/20">{ignoredSources.length}</span>
                            </h3>
                            <p className="text-xxs text-slate-400 leading-relaxed">
                                Senders whose emails are completely skipped during sync.
                            </p>
                            {ignoredSources.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2 pl-2">No ignored sources configured.</p>
                            ) : (
                                <div className="space-y-2.5">
                                    {ignoredSources.map(source => (
                                        <div key={source._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl gap-3">
                                            <div className="flex items-center gap-3 truncate">
                                                <input
                                                    type="checkbox"
                                                    checked={source.isActive}
                                                    onChange={() => handleToggleActive(source)}
                                                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-800 cursor-pointer"
                                                />
                                                <span className={`text-xs font-semibold truncate ${source.isActive ? "text-slate-200" : "text-slate-500 line-through"}`}>
                                                    {source.email}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3.5 shrink-0 self-end sm:self-auto">
                                                <button
                                                    onClick={() => handleRemoveSource(source._id, source.email)}
                                                    className="text-red-400 hover:text-red-300 text-xxs font-bold uppercase cursor-pointer"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Auto-Discovered Unknown Senders Section */}
                    {unknownSenders.length > 0 && (
                        <div className="border-t border-slate-800/80 pt-5 space-y-3">
                            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                                ⚠️ Discovered Unknown Senders <span className="text-xxs bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{unknownSenders.length}</span>
                            </h3>
                            <p className="text-xxs text-slate-400 leading-relaxed">
                                Discovered placement emails from senders not yet configured. Categorize them below:
                            </p>
                            <div className="space-y-3">
                                {unknownSenders.map(s => (
                                    <div key={s.email} className="flex flex-col p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="text-xs font-semibold text-white truncate" title={s.rawSender}>{s.email}</span>
                                            <span className="text-xxs text-slate-500 shrink-0">Last: {s.lastReceivedAt ? new Date(s.lastReceivedAt).toLocaleDateString() : ""}</span>
                                        </div>
                                        <p className="text-xxs text-slate-400 italic truncate">Subject: {s.lastSubject}</p>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={() => handleQuickCategorize(s.email, "placement")}
                                                className="px-2.5 py-1 bg-green-950 border border-green-500/20 hover:bg-green-900 text-green-400 rounded-lg text-xxs font-bold transition cursor-pointer"
                                            >
                                                + Placement
                                            </button>
                                            <button
                                                onClick={() => handleQuickCategorize(s.email, "update")}
                                                className="px-2.5 py-1 bg-cyan-950 border border-cyan-500/20 hover:bg-cyan-900 text-cyan-400 rounded-lg text-xxs font-bold transition cursor-pointer"
                                            >
                                                + Update
                                            </button>
                                            <button
                                                onClick={() => handleQuickCategorize(s.email, "ignored")}
                                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg text-xxs font-bold transition cursor-pointer"
                                            >
                                                + Ignore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Gemini AI Status Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/50 transition duration-300 shadow-md">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3 mb-4">
                        <span className="text-2xl">🤖</span>
                        <h2 className="text-xl font-bold text-white">Gemini AI Diagnostics</h2>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-350">Gemini-2.5-Flash Core Model</p>
                            <p className="text-xs text-slate-500 mt-0.5">Used for structural parsing and recruitment analytics.</p>
                        </div>
                        <span className="px-3 py-1 bg-green-600/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold select-none">
                            ● Operational
                        </span>
                    </div>
                </div>

                {/* Notifications Preferences */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/50 transition duration-300 shadow-md">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3 mb-4">
                        <span className="text-2xl">🔔</span>
                        <h2 className="text-xl font-bold text-white">Notification Centers</h2>
                    </div>
                    <div className="space-y-4 mt-4 text-xs font-medium text-slate-300">
                        <div className="flex items-center justify-between">
                            <span>Enable AI summary tips notifications</span>
                            <input
                                type="checkbox"
                                checked={aiAlerts}
                                onChange={(e) => setAiAlerts(e.target.checked)}
                                className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Enable System notifications</span>
                            <input
                                type="checkbox"
                                checked={systemAlerts}
                                onChange={(e) => setSystemAlerts(e.target.checked)}
                                className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Enable Email synchronization events alerts</span>
                            <input
                                type="checkbox"
                                checked={emailAlerts}
                                onChange={(e) => setEmailAlerts(e.target.checked)}
                                className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-800 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Theme Configuration */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/50 transition duration-300 shadow-md">
                    <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3 mb-4">
                        <span className="text-2xl">🎨</span>
                        <h2 className="text-xl font-bold text-white">Theme options</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-xs font-semibold">
                        <button
                            onClick={() => setActiveTheme("dark")}
                            className={`p-3 border rounded-xl text-center cursor-pointer transition ${
                                activeTheme === "dark"
                                    ? "border-blue-500 bg-blue-600/15 text-blue-400"
                                    : "border-slate-800 bg-slate-950 text-slate-400"
                            }`}
                        >
                            🌙 Premium Dark (Active)
                        </button>
                        <button
                            onClick={() => alert("Light mode stylesheet is locked in premium developer builds")}
                            className="p-3 border border-slate-800 bg-slate-950 text-slate-500 text-center rounded-xl cursor-pointer hover:border-slate-700 transition"
                        >
                            ☀️ Light Mode (Locked)
                        </button>
                    </div>
                </div>

                {/* Risk Management Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/50 transition duration-300 shadow-md">
                    <div className="flex items-center gap-3 border-b border-slate-850 pb-3 mb-4 text-red-500">
                        <span className="text-2xl">⚠️</span>
                        <h2 className="text-xl font-bold">Danger Zones</h2>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-350">Delete Account</p>
                            <p className="text-xs text-slate-500 mt-0.5">Permanently delete your profile and database trackers.</p>
                        </div>
                        <button
                            onClick={handleDeleteAccount}
                            className="px-4 py-2 bg-red-950 border border-red-500/30 text-red-400 hover:bg-red-900 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default Settings;