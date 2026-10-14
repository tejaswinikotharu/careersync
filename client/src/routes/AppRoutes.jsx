import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import authService from "../services/authService";

import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import CompanyDetails from "../pages/CompanyDetails";
import Calendar from "../pages/Calendar";
import Settings from "../pages/Settings";


// Route guard checking local token status
function ProtectedRoute({ children }) {
    if (!authService.isAuthenticated()) {
        return <Navigate to="/" replace />;
    }
    return children;
}

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/companies"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/company/:companyName"
                    element={
                        <ProtectedRoute>
                            <CompanyDetails />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/calendar"
                    element={
                        <ProtectedRoute>
                            <Calendar />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <Settings />
                        </ProtectedRoute>
                    }
                />

            </Routes>
        </BrowserRouter>
    );
}

export default AppRoutes;