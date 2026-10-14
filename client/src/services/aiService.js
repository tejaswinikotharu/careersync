import api from "./api";

const aiService = {
    getCompanySummary: async (companyId) => {
        const response = await api.get(`/ai/company-summary/${companyId}`);
        return response.data;
    },
};

export default aiService;
