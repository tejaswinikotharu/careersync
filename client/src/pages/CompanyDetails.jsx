import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

import DashboardLayout from "../layouts/DashboardLayout";
import Emails from "../components/company/Emails";

import companyService from "../services/companyService";
import userCompanyService from "../services/userCompanyService";
import aiService from "../services/aiService";

function CompanyDetails() {
    const { companyName } = useParams(); // URL parameter matches the company slug
    const [company, setCompany] = useState(null);
    const [userCompany, setUserCompany] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // AI Summary & FAQ states
    const [aiSummary, setAiSummary] = useState(null);

    // Tracking states
    const [trackingStatus, setTrackingStatus] = useState("Pending");
    const [currentRound, setCurrentRound] = useState("");
    const [progress, setProgress] = useState(0);
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [companyEmails, setCompanyEmails] = useState([]);
    const [calendarData, setCalendarData] = useState([]);
    const [refreshingIntel, setRefreshingIntel] = useState(false);

    const handleRefreshIntelligence = async () => {
        setRefreshingIntel(true);
        try {
            await companyService.refreshCompanyIntelligence(companyName);
            // Re-fetch after 3 seconds to get the completed background profile updates
            setTimeout(async () => {
                try {
                    const compRes = await companyService.getCompanyBySlug(companyName);
                    const workspaceData = compRes.data;
                    const companyData = workspaceData.company || workspaceData;
                    setCompany(companyData);
                    setUserCompany(workspaceData.userCompany);
                } catch (e) {
                    console.error("Polling refresh failed:", e);
                } finally {
                    setRefreshingIntel(false);
                }
            }, 3500);
        } catch (err) {
            console.error("Failed to refresh company intelligence:", err);
            alert("Failed to trigger intelligence refresh: " + (err.response?.data?.message || err.message));
            setRefreshingIntel(false);
        }
    };

    useEffect(() => {
        const fetchWorkspaceData = async () => {
            try {
                setLoading(true);
                setError("");

                // Fetch global company details and workspace by slug
                const compRes = await companyService.getCompanyBySlug(companyName);
                const workspaceData = compRes.data;
                
                const companyData = workspaceData.company || workspaceData;
                setCompany(companyData);

                const trackingRecord = workspaceData.userCompany;
                setUserCompany(trackingRecord);
                setTrackingStatus(trackingRecord.status || "Pending");
                setCurrentRound(trackingRecord.currentRound || "");
                setProgress(trackingRecord.progress || 0);
                setNotes(trackingRecord.notes || "");

                // Set emails and AI summary immediately
                if (workspaceData.emails) {
                    setCompanyEmails(workspaceData.emails);
                }
                if (workspaceData.aiSummary) {
                    setAiSummary(workspaceData.aiSummary);
                }
                if (workspaceData.calendarData) {
                    setCalendarData(workspaceData.calendarData);
                }
            } catch (err) {
                console.error("Workspace loading failed:", err);
                setError(err.response?.data?.message || err.message || "Failed to load workspace data");
            } finally {
                setLoading(false);
            }
        };

        if (companyName) {
            fetchWorkspaceData();
        }
    }, [companyName]);

    const handleTrackingUpdate = async (field, value) => {
        if (!userCompany) return;

        setSaving(true);
        setSaveSuccess(false);

        try {
            const updatePayload = {
                status: field === "status" ? value : trackingStatus,
                currentRound: field === "currentRound" ? value : currentRound,
                progress: field === "progress" ? value : progress,
                notes: field === "notes" ? value : notes,
            };

            const updateRes = await userCompanyService.updateTracking(userCompany._id, updatePayload);
            const updatedRecord = updateRes.data;
            
            setUserCompany(updatedRecord);
            if (field === "status") setTrackingStatus(updatedRecord.status);
            if (field === "currentRound") setCurrentRound(updatedRecord.currentRound);
            if (field === "progress") setProgress(updatedRecord.progress);
            if (field === "notes") setNotes(updatedRecord.notes);
            
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Failed to save tracking progress");
        } finally {
            setSaving(false);
        }
    };

    // Checklist togglers
    const handleToggleDocument = async (docId, completedStatus) => {
        if (!userCompany) return;
        try {
            const updatedDocs = userCompany.requiredDocuments.map(d => 
                d._id === docId ? { ...d, completed: completedStatus } : d
            );
            const res = await userCompanyService.updateTracking(userCompany._id, {
                requiredDocuments: updatedDocs
            });
            setUserCompany(res.data);
        } catch (err) {
            console.error("Failed to toggle document:", err);
        }
    };

    const handleToggleMockTest = async (testId, completedStatus) => {
        if (!userCompany) return;
        try {
            const updatedMockTests = userCompany.mockTests.map(t => 
                t._id === testId ? { ...t, completed: completedStatus } : t
            );
            const res = await userCompanyService.updateTracking(userCompany._id, {
                mockTests: updatedMockTests
            });
            setUserCompany(res.data);
        } catch (err) {
            console.error("Failed to toggle mock test:", err);
        }
    };

    const handleTogglePrepKit = async (kitId, completedStatus) => {
        if (!userCompany) return;
        try {
            const updatedKits = userCompany.prepKits.map(k => 
                k._id === kitId ? { ...k, completed: completedStatus } : k
            );
            const res = await userCompanyService.updateTracking(userCompany._id, {
                prepKits: updatedKits
            });
            setUserCompany(res.data);
        } catch (err) {
            console.error("Failed to toggle prep kit:", err);
        }
    };

    const handleToggleTraining = async (sessionId, completedStatus) => {
        if (!userCompany) return;
        try {
            const updatedSessions = userCompany.trainingSessions.map(s => 
                s._id === sessionId ? { ...s, completed: completedStatus } : s
            );
            const res = await userCompanyService.updateTracking(userCompany._id, {
                trainingSessions: updatedSessions
            });
            setUserCompany(res.data);
        } catch (err) {
            console.error("Failed to toggle training session:", err);
        }
    };

    const handleToggleAssessment = async (assessmentId, completedStatus) => {
        if (!userCompany) return;
        try {
            const updatedAssessments = userCompany.assessments.map(a => 
                a._id === assessmentId ? { ...a, completed: completedStatus } : a
            );
            const res = await userCompanyService.updateTracking(userCompany._id, {
                assessments: updatedAssessments
            });
            setUserCompany(res.data);
        } catch (err) {
            console.error("Failed to toggle assessment:", err);
        }
    };

    const handleToggleInterview = async (interviewId, completedStatus) => {
        if (!userCompany) return;
        try {
            const updatedInterviews = userCompany.interviews.map(i => 
                i._id === interviewId ? { ...i, completed: completedStatus } : i
            );
            const res = await userCompanyService.updateTracking(userCompany._id, {
                interviews: updatedInterviews
            });
            setUserCompany(res.data);
        } catch (err) {
            console.error("Failed to toggle interview:", err);
        }
    };

    const getNextAction = () => {
        if (!userCompany || !userCompany.timeline || userCompany.timeline.length === 0) {
            return "No upcoming events scheduled. Sync your inbox to populate workspace.";
        }
        const upcoming = userCompany.timeline.find(item => item.status === "current" || item.status === "upcoming");
        if (!upcoming) return "Recruitment drive completed successfully! 🎉";
        
        let txt = `${upcoming.title}`;
        if (upcoming.date) txt += ` (Scheduled on ${upcoming.date})`;
        if (upcoming.time) txt += ` at ${upcoming.time}`;
        return txt;
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-lg font-medium animate-pulse">Loading Workspace CRM...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !company) {
        return (
            <DashboardLayout>
                <div className="p-8 bg-red-950/20 border border-red-500/30 text-red-400 rounded-2xl text-center my-10 max-w-lg mx-auto shadow-lg shadow-red-500/5">
                    <p className="text-lg font-bold">Workspace Unavailable</p>
                    <p className="text-sm mt-2 text-red-400/80">{error || "Company not found"}</p>
                    <button 
                        onClick={() => window.history.back()} 
                        className="mt-5 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
                    >
                        Go Back
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            {/* Header Title Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-4">
                    <span className="text-4xl p-3 bg-slate-900 border border-slate-850 rounded-2xl shadow-inner">🏢</span>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-white capitalize flex items-center gap-2">
                            {company.name} Workspace
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Company Workspace Manager &bull; Target Dashboard
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {company.website && (
                        <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold rounded-xl text-xs transition shadow-inner cursor-pointer"
                        >
                            Visit Site 🌐
                        </a>
                    )}
                    <span className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                        trackingStatus === "Offer Received" 
                            ? "bg-green-950/40 text-green-400 border-green-900/60" 
                            : trackingStatus === "Rejected"
                                ? "bg-red-950/40 text-red-400 border-red-900/60"
                                : "bg-blue-950/40 text-blue-400 border-blue-900/60"
                    }`}>
                        Status: {trackingStatus}
                    </span>
                </div>
            </div>

            {/* Current Status Prominent Header Widget */}
            <div className="mt-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 text-[9px] font-black text-slate-750 uppercase tracking-widest">
                    Real-time status
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div>
                        <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">Latest Stage Round</p>
                        <h3 className="text-2xl font-black text-white mt-1.5 flex items-center gap-2 capitalize">
                            🎯 {userCompany?.currentRound || "Registration"}
                        </h3>
                    </div>
                    <div>
                        <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">Next Action Item</p>
                        <p className="text-sm font-bold text-blue-400 mt-1.5 leading-snug">
                            ➔ {getNextAction()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabbed Navigation Menu */}
            <div className="flex border-b border-slate-800 mt-8 overflow-x-auto no-scrollbar gap-1">
                {[
                    { id: "overview", label: "Overview 📖" },
                    { id: "recruitment", label: "Recruitment 📝" },
                    { id: "resources", label: "Resources 📋" },
                    { id: "calendar", label: "Calendar 📅" },
                    { id: "emails", label: "Emails 📧" },
                    { id: "ai", label: "AI Insights 🤖" },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-3 text-xs font-bold transition duration-200 border-b-2 shrink-0 cursor-pointer ${
                            activeTab === tab.id
                                ? "border-blue-500 text-white bg-slate-900/40"
                                : "border-transparent text-slate-450 hover:text-white hover:bg-slate-950/20"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Tabs Container */}
            <div className="mt-8">
                
                {/* 1. OVERVIEW TAB */}
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Company Profile Details */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
                                <h2 className="text-xl font-bold text-white mb-4">🏢 Stable Company Profile</h2>
                                <p className="text-sm text-slate-300 leading-relaxed">{company.overview}</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-800/60 text-xs">
                                    <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl">
                                        <p className="text-slate-500 font-bold uppercase tracking-wider">Headquarters</p>
                                        <p className="text-sm font-semibold text-white mt-1">{company.headquarters || "Unknown"}</p>
                                    </div>
                                    <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl">
                                        <p className="text-slate-500 font-bold uppercase tracking-wider">Company Type</p>
                                        <p className="text-sm font-semibold text-white mt-1">{company.type || "Product"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Instructions summary */}
                            {userCompany?.aiAnalysis?.importantInstructions?.length > 0 && (
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
                                    <h2 className="text-xl font-bold text-white mb-4">⚠️ Key Guidelines & Warning Alerts</h2>
                                    <ul className="space-y-3">
                                        {userCompany.aiAnalysis.importantInstructions.slice(0, 4).map((ins, i) => (
                                            <li key={i} className="flex gap-2.5 items-start text-xs font-semibold text-slate-300 leading-relaxed">
                                                <span className="text-yellow-500 shrink-0">⚠️</span>
                                                <span>{ins}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Overview Sidebar Tracking Controls */}
                        <div className="space-y-8">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        📊 Target Application Controls
                                    </h3>
                                    {saving ? (
                                        <span className="text-[10px] text-blue-400 font-medium animate-pulse">Saving...</span>
                                    ) : saveSuccess ? (
                                        <span className="text-[10px] text-green-400 font-medium">✓ Saved</span>
                                    ) : null}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Tracking Status</label>
                                        <select
                                            value={trackingStatus}
                                            onChange={(e) => handleTrackingUpdate("status", e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Applied">Applied</option>
                                            <option value="Active">Active</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Rejected">Rejected</option>
                                            <option value="Offer Received">Offer Received</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Current Round Focus</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Mock Assessment 10"
                                            value={currentRound}
                                            onChange={(e) => setCurrentRound(e.target.value)}
                                            onBlur={() => handleTrackingUpdate("currentRound", currentRound)}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Workspace Progress</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="5"
                                                value={progress}
                                                onChange={(e) => setProgress(parseInt(e.target.value))}
                                                onMouseUp={() => handleTrackingUpdate("progress", progress)}
                                                className="flex-1 bg-slate-950 h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 border border-slate-850"
                                            />
                                            <span className="text-xs font-black text-blue-400 w-8 text-right">{progress}%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Personal Notes</label>
                                        <textarea
                                            placeholder="Drive links, registration notes, references..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            onBlur={() => handleTrackingUpdate("notes", notes)}
                                            rows={4}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-250 focus:outline-none focus:border-blue-500 resize-none font-semibold leading-relaxed"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* 3. RECRUITMENT SPECIFIC INFO TAB */}
                {activeTab === "recruitment" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Recruitment Criteria Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
                            <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-3">🎯 Recruitment drive criteria</h2>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider">Job ID Code</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1">{userCompany?.jobId || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider">Job Role Profile</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1 capitalize">{userCompany?.jobRole || "Software Engineer"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider">Job Contract Type</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1">{userCompany?.jobType || "Full Time"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider">Target Package (CTC)</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1">{userCompany?.package || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider">CGPA / Cutoff Eligibility</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1">{userCompany?.eligibility || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider">Hiring Locations</p>
                                    <p className="text-sm font-semibold text-slate-200 mt-1">{userCompany?.location || "Unknown"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Eligible Departments & Registration Links Card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
                            <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-3">📋 Target Audiences & Forms</h2>
                            
                            <div>
                                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-2">Target Departments</p>
                                {userCompany?.departments?.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {userCompany.departments.map((dept, i) => (
                                            <span key={i} className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded text-xxs font-bold text-blue-400 tracking-wider">{dept}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No target departments specified.</p>
                                )}
                            </div>

                            <div>
                                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-2">Specializations Focus</p>
                                {userCompany?.specializations?.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {userCompany.specializations.map((spec, i) => (
                                            <span key={i} className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded text-xxs font-bold text-indigo-400 tracking-wider">{spec}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No specific specializations listed.</p>
                                )}
                            </div>

                            <div>
                                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-2">Registration Forms / Links</p>
                                {userCompany?.registrationLinks?.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                        {userCompany.registrationLinks.map((link, i) => (
                                            <a 
                                                key={i} 
                                                href={link} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-xs font-semibold text-blue-400 hover:underline truncate max-w-sm block"
                                            >
                                                ➔ Link {i+1}: {link}
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No registration link found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. RESOURCES & CHECKLISTS TAB */}
                {activeTab === "resources" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Documents & Prep Kits checklist */}
                        <div className="space-y-8">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">📋 Required Documents checklist</h3>
                                {userCompany?.requiredDocuments?.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {userCompany.requiredDocuments.map((doc) => (
                                            <label key={doc._id} className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={doc.completed}
                                                    onChange={(e) => handleToggleDocument(doc._id, e.target.checked)}
                                                    className="w-4 h-4 bg-slate-950 border border-slate-800 rounded accent-blue-600 cursor-pointer"
                                                />
                                                <span className={doc.completed ? "line-through text-slate-500" : ""}>{doc.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No documents specified in emails.</p>
                                )}
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">💻 Interactive Mock Tests</h3>
                                {userCompany?.mockTests?.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {userCompany.mockTests.map((mock) => (
                                            <label key={mock._id} className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-300 bg-slate-950/40 p-2.5 border border-slate-850 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={mock.completed}
                                                        onChange={(e) => handleToggleMockTest(mock._id, e.target.checked)}
                                                        className="w-4 h-4 bg-slate-950 border border-slate-800 rounded accent-blue-600 cursor-pointer"
                                                    />
                                                    <span className={mock.completed ? "line-through text-slate-500" : ""}>{mock.name}</span>
                                                </div>
                                                {mock.date && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded">
                                                        📅 {new Date(mock.date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No mock tests detected in emails.</p>
                                )}
                            </div>
                        </div>

                        {/* Prep Kits & Training Sessions checklists */}
                        <div className="space-y-8">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">📦 AI-Extracted Prep Kits</h3>
                                {userCompany?.prepKits?.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {userCompany.prepKits.map((kit) => (
                                            <div key={kit._id} className="flex items-center justify-between text-xs font-semibold text-slate-300 bg-slate-950/40 p-2.5 border border-slate-850 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={kit.completed}
                                                        onChange={(e) => handleTogglePrepKit(kit._id, e.target.checked)}
                                                        className="w-4 h-4 bg-slate-950 border border-slate-800 rounded accent-blue-600 cursor-pointer"
                                                    />
                                                    <span className={kit.completed ? "line-through text-slate-500" : ""}>{kit.name}</span>
                                                </div>
                                                {kit.link && (
                                                    <a href={kit.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-[10px] font-bold">
                                                        Open Link 🔗
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No prep kits found in emails.</p>
                                )}
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">🎓 Training & Workshops Sessions</h3>
                                {userCompany?.trainingSessions?.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {userCompany.trainingSessions.map((session) => (
                                            <div key={session._id} className="flex flex-col gap-2 text-xs font-semibold text-slate-300 bg-slate-950/40 p-3 border border-slate-850 rounded-xl">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={session.completed}
                                                            onChange={(e) => handleToggleTraining(session._id, e.target.checked)}
                                                            className="w-4 h-4 bg-slate-950 border border-slate-800 rounded accent-blue-600 cursor-pointer"
                                                        />
                                                        <span className={session.completed ? "line-through text-slate-500" : ""}>{session.topic}</span>
                                                    </div>
                                                    {session.link && (
                                                        <a href={session.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-[10px] font-bold">
                                                            Join Room 🔗
                                                        </a>
                                                    )}
                                                </div>
                                                {session.date && (
                                                    <p className="text-[10px] text-slate-400 mt-1 pl-7">
                                                        📅 Scheduled: {new Date(session.date).toLocaleDateString()} {session.time ? `at ${session.time}` : ""}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No training sessions scheduled.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. CALENDAR SCHEDULES TAB */}
                {activeTab === "calendar" && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md max-w-4xl mx-auto space-y-6">
                        <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-3">📅 Scheduled Calendar Events</h2>
                        
                        {calendarData.length > 0 ? (
                            <div className="space-y-4">
                                {calendarData.map((ev) => (
                                    <div key={ev._id} className="p-4 bg-slate-950 border border-slate-850 rounded-xl flex justify-between items-center">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-400">
                                                Type: {ev.type}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-300">
                                            📅 {new Date(ev.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-500 text-xs italic">
                                No specific calendar events found. Sync your inbox to schedule assessments automatically.
                            </div>
                        )}
                    </div>
                )}

                {/* 6. SYNCED EMAILS TAB */}
                {activeTab === "emails" && (
                    <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
                        <h2 className="text-xl font-bold text-white mb-6">📧 Synced Placement & Student Update Emails</h2>
                        <Emails emails={companyEmails} />
                    </div>
                )}

                {/* 7. AI INSIGHTS & INTERACTIVE FAQ TAB */}
                {activeTab === "ai" && (() => {
                    const aiProfile = company.aiProfile || {};
                    const aiStatus = aiProfile.status || "pending";
                    const currentProfile = company.currentPlacementProfile || {};
                    const placementStatus = currentProfile.status || "pending";
                    const isStale = placementStatus === "stale";

                    if (aiStatus === "pending" || aiStatus === "building" || refreshingIntel) {
                        return (
                            <div className="space-y-6 max-w-4xl mx-auto py-10">
                                <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-4 animate-pulse">
                                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    <h3 className="text-lg font-black text-white">🔄 Analyzing Company Footprint...</h3>
                                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                                        CareerSync is deterministic crawling facts and generating synthesis via Gemini. This background operation does not delay Gmail inbox synchronizations.
                                    </p>
                                    <div className="h-4 bg-slate-800 rounded w-3/4 mx-auto mt-4"></div>
                                    <div className="h-4 bg-slate-800 rounded w-1/2 mx-auto"></div>
                                </div>
                            </div>
                        );
                    }

                    if (aiStatus === "failed") {
                        return (
                            <div className="max-w-md mx-auto py-12 text-center space-y-6">
                                <div className="p-6 bg-red-950/20 border border-red-500/30 text-red-400 rounded-3xl shadow-lg">
                                    <p className="text-base font-black">AI Profile Synthesis Failed</p>
                                    <p className="text-xs mt-2 text-red-400/80">We encountered an issue pulling intelligence details for this workspace.</p>
                                </div>
                                <button
                                    onClick={handleRefreshIntelligence}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition cursor-pointer"
                                >
                                    Retry Profile Generation ➔
                                </button>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-12">
                            {/* Staleness Banner check */}
                            {isStale && (
                                <div className="p-4 bg-amber-950/20 border border-amber-500/30 text-amber-400 rounded-2xl flex justify-between items-center text-xs font-semibold">
                                    <div className="flex items-center gap-2">
                                        <span>⚠️</span>
                                        <span>Hiring pattern evidence has evolved. Historical placement profile is marked as stale.</span>
                                    </div>
                                    <button 
                                        onClick={handleRefreshIntelligence}
                                        className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg text-xxs font-black tracking-wider uppercase hover:bg-amber-400 cursor-pointer"
                                    >
                                        Rebuild
                                    </button>
                                </div>
                            )}

                            {/* Section 1: Static Company Intelligence */}
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
                                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                                    <div>
                                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                                            📖 Company Intelligence Profile
                                        </h2>
                                        <p className="text-slate-400 text-xs mt-0.5">
                                            Static profile facts resolved from verified directories.
                                        </p>
                                    </div>
                                    <button 
                                        onClick={handleRefreshIntelligence}
                                        disabled={refreshingIntel}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xxs cursor-pointer transition shadow-sm"
                                    >
                                        {refreshingIntel ? "Refreshing..." : "Refresh Company Intelligence 🔄"}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-4">
                                        <div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tagline</span>
                                            <h4 className="text-sm font-black text-slate-200 mt-1 italic">"{aiProfile.shortDescription || "Global Enterprise"}"</h4>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">About the Company</span>
                                            <p className="text-xs text-slate-350 leading-relaxed font-semibold mt-1.5">{aiProfile.summary || "No overview parsed."}</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-3.5 text-xs font-semibold text-slate-400">
                                        <div className="flex justify-between">
                                            <span>Size:</span>
                                            <span className="text-white font-extrabold">{aiProfile.companySize || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Industry:</span>
                                            <span className="text-white font-extrabold">{aiProfile.industry || "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Headquarters:</span>
                                            <span className="text-white font-extrabold">{aiProfile.headquarters || "N/A"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-5 bg-emerald-950/20 border border-emerald-900/60 rounded-2xl space-y-3">
                                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">👍 Workplace Pros</h4>
                                        <ul className="space-y-2 text-xxs font-extrabold text-slate-300">
                                            {aiProfile.pros?.map((p, i) => (
                                                <li key={i} className="flex gap-2"><span className="text-emerald-400">•</span>{p}</li>
                                            )) || <li className="italic text-slate-500">No Pros generated.</li>}
                                        </ul>
                                    </div>
                                    <div className="p-5 bg-rose-950/20 border border-rose-900/60 rounded-2xl space-y-3">
                                        <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">👎 Workplace Cons</h4>
                                        <ul className="space-y-2 text-xxs font-extrabold text-slate-300">
                                            {aiProfile.cons?.map((c, i) => (
                                                <li key={i} className="flex gap-2"><span className="text-rose-400">•</span>{c}</li>
                                            )) || <li className="italic text-slate-500">No Cons generated.</li>}
                                        </ul>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Work Culture</span>
                                        <p className="text-xs text-slate-350 leading-relaxed font-semibold mt-1.5">{aiProfile.workCulture || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hiring Profile Focus</span>
                                        <p className="text-xs text-slate-350 leading-relaxed font-semibold mt-1.5">{aiProfile.hiringFocus || "N/A"}</p>
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Common Technologies Utilized</span>
                                    <div className="flex flex-wrap gap-2">
                                        {aiProfile.technologies?.map((tech, i) => (
                                            <span key={i} className="px-3 py-1 bg-slate-950 border border-slate-850 rounded-xl text-xxs font-black text-blue-400">{tech}</span>
                                        )) || <span className="text-xs italic text-slate-500">None mapped.</span>}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-850">
                                    {aiProfile.officialWebsite && (
                                        <a href={aiProfile.officialWebsite} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-950 border border-slate-850 text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-850 transition">
                                            Visit Web Portal 🌐
                                        </a>
                                    )}
                                    {aiProfile.careersPage && (
                                        <a href={aiProfile.careersPage} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-950 border border-slate-850 text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-850 transition">
                                            Careers Board 🎯
                                        </a>
                                    )}
                                    {aiProfile.linkedin && (
                                        <a href={aiProfile.linkedin} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-950 border border-slate-850 text-slate-200 font-bold rounded-xl text-xs hover:bg-slate-850 transition">
                                            LinkedIn Profile 👥
                                        </a>
                                    )}
                                </div>

                                {aiProfile.sources?.length > 0 && (
                                    <div className="pt-2">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Reference Verification Sources</span>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                                            {aiProfile.sources.map((src, i) => (
                                                <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-500 hover:text-blue-400 font-bold flex items-center gap-1">
                                                    🔗 {src.title}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

            </div>
        </DashboardLayout>
    );
}

export default CompanyDetails;