import api from "./api";

const companyService = {
    getCompanies: async (search = "", status = "") => {
        let url = "/companies?limit=100";
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }
        if (status && status !== "All") {
            url += `&status=${encodeURIComponent(status)}`;
        }
        const response = await api.get(url);
        return response.data;
    },

    getCompanyBySlug: async (slug) => {
        const response = await api.get(`/companies/${slug}`);
        return response.data;
    },

    refreshCompanyIntelligence: async (slug) => {
        const response = await api.post(`/companies/${slug}/refresh-intelligence`);
        return response.data;
    },
};

export default companyService;
