import api from "./api";

const authService = {
    login: async (email, password) => {
        const response = await api.post("/auth/login", { email, password });
        if (response.data && response.data.token) {
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("user", JSON.stringify(response.data));
        }
        return response.data;
    },

    register: async (name, email, password) => {
        const response = await api.post("/auth/register", { name, email, password });
        if (response.data && response.data.token) {
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("user", JSON.stringify(response.data));
        }
        return response.data;
    },

    loginGoogle: async (idToken) => {
        const response = await api.post("/auth/google", { idToken });
        if (response.data && response.data.token) {
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("user", JSON.stringify(response.data));
        }
        return response.data;
    },

    logout: () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    },

    getToken: () => {
        return localStorage.getItem("token");
    },

    getCurrentUser: () => {
        const user = localStorage.getItem("user");
        return user ? JSON.parse(user) : null;
    },

    isAuthenticated: () => {
        return !!localStorage.getItem("token");
    },
};

export default authService;
