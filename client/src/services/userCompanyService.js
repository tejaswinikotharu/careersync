import api from "./api";

const userCompanyService = {
    getUserCompanies: async () => {
        const response = await api.get("/user-companies");
        return response.data;
    },

    getUserCompany: async (companyId) => {
        const response = await api.get(`/user-companies/${companyId}`);
        return response.data;
    },

    startTracking: async (companyId, status = "Pending", notes = "", currentRound = "", progress = 0, companyName = "") => {
        const response = await api.post("/user-companies", {
            companyId,
            status,
            notes,
            currentRound,
            progress,
            companyName,
        });
        return response.data;
    },

    updateTracking: async (id, data) => {
        const response = await api.put(`/user-companies/id/${id}`, data);
        return response.data;
    },

    stopTracking: async (id) => {
        const response = await api.delete(`/user-companies/id/${id}`);
        return response.data;
    },
};

export default userCompanyService;
