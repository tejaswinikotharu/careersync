import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/authService";

function Login() {
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // If already logged in, redirect to dashboard
    useEffect(() => {
        if (authService.isAuthenticated()) {
            navigate("/dashboard");
        }
    }, [navigate]);

    const hasValidGoogleClient = () => {
        const cid = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        return cid && cid !== "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" && !cid.startsWith("dummy");
    };

    // Dynamically load Google Identity Services (GSI) script and initialize
    useEffect(() => {
        if (!hasValidGoogleClient()) {
            return;
        }

        const initializeGsi = () => {
            if (window.google) {
                const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleLoginResponse,
                });
                
                const btnContainer = document.getElementById("google-signin-btn");
                if (btnContainer) {
                    window.google.accounts.id.renderButton(
                        btnContainer,
                        { 
                            theme: "dark", 
                            size: "large", 
                            width: "382", 
                            text: "continue_with",
                            shape: "rectangular"
                        }
                    );
                }
            }
        };

        const loadGsiScript = () => {
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = initializeGsi;
            document.body.appendChild(script);
        };

        if (!window.google) {
            loadGsiScript();
        } else {
            initializeGsi();
        }
    }, []);

    const handleGoogleLoginResponse = async (response) => {
        setError("");
        setLoading(true);

        try {
            // Retrieve Google ID Token and submit to backend
            await authService.loginGoogle(response.credential);
            navigate("/dashboard");
        } catch (err) {
            console.error("Google Auth Error:", err);
            setError(err.response?.data?.message || err.message || "Google Sign-In failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isRegister) {
                await authService.register(name, email, password);
            } else {
                await authService.login(email, password);
            }
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.message || err.message || "Authentication failed";
            const validationErrors = err.response?.data?.errors;
            if (validationErrors && validationErrors.length > 0) {
                setError(`${errMsg}: ${validationErrors.map(e => e.message).join(", ")}`);
            } else {
                setError(errMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl hover:border-slate-700/50 transition duration-300">
                <div className="flex flex-col items-center mb-8">
                    <img
                        src="/logo.png"
                        alt="CareerSync Logo"
                        className="w-20 h-20 mb-4"
                        onError={(e) => {
                            e.target.style.display = "none";
                        }}
                    />
                    <h1 className="text-4xl font-extrabold tracking-tight">
                        CareerSync
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        AI Placement Assistant
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-500/30 text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {isRegister && (
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                            <input
                                type="text"
                                placeholder="Enter name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Email Address</label>
                        <input
                            type="email"
                            placeholder="Enter email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                        <input
                            type="password"
                            placeholder="Enter password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/55 text-white rounded-xl font-semibold transition cursor-pointer text-sm shadow-md shadow-blue-500/10"
                    >
                        {loading ? "Authenticating..." : isRegister ? "Sign Up" : "Sign In"}
                    </button>
                </form>

                <div className="flex flex-col items-center mt-6 space-y-4">
                    <button
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError("");
                        }}
                        className="text-xs text-blue-400 hover:underline cursor-pointer"
                    >
                        {isRegister ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                    </button>

                    {hasValidGoogleClient() && (
                        <>
                            <div className="flex items-center w-full gap-2 text-slate-500">
                                <hr className="flex-1 border-slate-800" />
                                <span className="text-[10px] uppercase font-semibold">or</span>
                                <hr className="flex-1 border-slate-800" />
                            </div>

                            {/* Official GSI Sign-In Button Container */}
                            <div id="google-signin-btn" className="w-full flex justify-center min-h-[40px]"></div>
                        </>
                    )}
                </div>
            </div>

            <footer className="absolute bottom-6 text-slate-600 text-xs">
                © 2026 CareerSync
            </footer>
        </div>
    );
}

export default Login;