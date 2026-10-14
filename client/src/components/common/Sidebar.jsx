import { Link, useLocation } from "react-router-dom";

function Sidebar() {
    const location = useLocation();
    const path = location.pathname;

    return (
        <div className="w-64 bg-slate-900 p-6 flex flex-col justify-between border-r border-slate-800 shrink-0">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white mb-10 select-none">
                    CareerSync
                </h1>

                <ul className="space-y-3">
                    <li>
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer select-none ${
                                path === "/dashboard"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                        >
                            <span>🏠</span> Dashboard
                        </Link>
                    </li>



                    <li>
                        <Link
                            to="/calendar"
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer select-none ${
                                path === "/calendar"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                        >
                            <span>📅</span> Calendar
                        </Link>
                    </li>



                    <li>
                        <Link
                            to="/settings"
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer select-none ${
                                path === "/settings"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                        >
                            <span>⚙️</span> Settings
                        </Link>
                    </li>
                </ul>
            </div>
            
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider select-none">
                 CareerSync Engine v1.0
            </div>
        </div>
    );
}

export default Sidebar;