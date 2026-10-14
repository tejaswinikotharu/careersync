import { useState, useEffect } from "react";
import companyService from "../../services/companyService";
import userCompanyService from "../../services/userCompanyService";
import documentService from "../../services/documentService";
import userService from "../../services/userService";
import gmailService from "../../services/gmailService";

function WelcomeWizard({ onClose, onComplete }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Step 4: Target Companies
    const [allCompanies, setAllCompanies] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCompanies, setSelectedCompanies] = useState([]); // Array of company IDs

    // Step 5: Resume upload
    const [resumeFile, setResumeFile] = useState(null);
    const [resumeUploadedUrl, setResumeUploadedUrl] = useState("");

    // Step 6: Profile Fields
    const [branch, setBranch] = useState("");
    const [cgpa, setCgpa] = useState("");
    const [gradYear, setGradYear] = useState("2026");
    const [skillsText, setSkillsText] = useState("");
    const [preferredRole, setPreferredRole] = useState("");
    const [preferredLocation, setPreferredLocation] = useState("");
    const [preferredPackage, setPreferredPackage] = useState("");

    useEffect(() => {
        const loadCompanies = async () => {
            try {
                const res = await companyService.getCompanies("", "All");
                setAllCompanies(res.data || []);
            } catch (err) {
                console.error(err);
            }
        };
        loadCompanies();
    }, []);

    const handleToggleCompany = (id) => {
        if (selectedCompanies.includes(id)) {
            setSelectedCompanies((prev) => prev.filter((cId) => cId !== id));
        } else {
            setSelectedCompanies((prev) => [...prev, id]);
        }
    };

    const handleGmailLink = () => {
        if (!window.google) {
            setError("Google Identity Services script not loaded. Please refresh the page.");
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
                            setLoading(true);
                            await gmailService.connectGmail(response.code);
                            setSuccessMessage("Gmail linked successfully!");
                            setTimeout(() => {
                                setSuccessMessage("");
                                handleFinish();
                            }, 1500);
                        } catch (err) {
                            setError(err.response?.data?.message || "Failed to link Gmail account");
                        } finally {
                            setLoading(false);
                        }
                    }
                },
            });
            client.requestCode();
        } catch (err) {
            setError("Failed to open Google authorization dialog.");
        }
    };

    const handleFinish = async () => {
        setLoading(true);
        setError("");
        try {
            await userService.updateProfile({
                isOnboarded: true,
            });
            onComplete();
        } catch (err) {
            setError(err.response?.data?.message || "Onboarding completion failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
                {/* Close/Skip button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white text-xs font-semibold cursor-pointer border border-slate-800 hover:border-slate-700 bg-slate-950 px-3 py-1.5 rounded-lg transition"
                >
                    Skip Setup ✕
                </button>

                {/* Main panel container */}
                <div className="p-8">
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/20 text-red-400 rounded-xl text-xs">
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="mb-4 p-3 bg-green-900/30 border border-green-500/20 text-green-400 rounded-xl text-xs font-semibold">
                            {successMessage}
                        </div>
                    )}

                    {/* Step 1: Welcome Greeting */}
                    {step === 1 && (
                        <div className="text-center py-6 space-y-4">
                            <span className="text-5xl select-none">👋</span>
                            <h2 className="text-3xl font-extrabold text-white">Welcome to CareerSync</h2>
                            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                                CareerSync is your personal, AI-powered placement assistant. We automatically fetch recruitment alerts from your student email, build timeline events, and provide AI strategy tips tailored for your targeted companies.
                            </p>
                            <div className="pt-6">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition cursor-pointer"
                                >
                                    Get Started ➔
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Connect Google Account */}
                    {step === 2 && (
                        <div className="text-center py-6 space-y-4">
                            <span className="text-5xl select-none">🔑</span>
                            <h2 className="text-2xl font-extrabold text-white">Setup Google Authentications</h2>
                            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                                To synchronize and securely access student placement details, link your Google account profile.
                            </p>
                            <div className="pt-6 flex justify-center gap-4">
                                <button
                                    onClick={() => setStep(3)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition cursor-pointer"
                                >
                                    Continue to Gmail Sync ➔
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Connect Gmail */}
                    {step === 3 && (
                        <div className="text-center py-6 space-y-4">
                            <span className="text-5xl select-none">📬</span>
                            <h2 className="text-2xl font-extrabold text-white">Link Student Inbox</h2>
                            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                                Connect your Gmail inbox to automatically import, structure, and categorize recruitment timeline updates, exam invitations, and calendar events.
                            </p>
                            <div className="pt-6 flex flex-col items-center gap-3">
                                <button
                                    onClick={handleGmailLink}
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-xl text-sm transition cursor-pointer flex items-center gap-2"
                                >
                                    {loading ? "Connecting..." : "Connect Gmail Inbox"}
                                </button>
                                <button
                                    onClick={handleFinish}
                                    className="text-xs text-slate-500 hover:underline cursor-pointer"
                                >
                                    Skip this step for now
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default WelcomeWizard;
