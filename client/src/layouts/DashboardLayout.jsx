import Sidebar from "../components/common/Sidebar";
import Navbar from "../components/common/Navbar";

function DashboardLayout({ children }) {
    return (
        <div className="min-h-screen bg-slate-950 text-white flex">

            <Sidebar />

            <div className="flex-1">

                <Navbar />

                <main className="p-8">
                    {children}
                </main>

            </div>

        </div>
    );
}

export default DashboardLayout;