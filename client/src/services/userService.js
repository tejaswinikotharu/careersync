import api from "./api";

const userService = {
    getProfile: async () => {
        const response = await api.get("/users/profile");
        return response.data;
    },

    updateProfile: async (data) => {
        const response = await api.put("/users/profile", data);
        
        // Synchronize updated user details inside local storage context
        const localUser = localStorage.getItem("user");
        if (localUser && response.data.data) {
            const parsed = JSON.parse(localUser);
            const merged = { ...parsed, ...response.data.data };
            localStorage.setItem("user", JSON.stringify(merged));
        }

        return response.data;
    },

    deleteAccount: async () => {
        const response = await api.delete("/users/profile");
        // Clear tokens
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return response.data;
    },
};

export default userService;
