import api from "./api";

const searchService = {
    search: async (query) => {
        const response = await api.get(`/search?q=${encodeURIComponent(query)}`);
        return response.data;
    },
};

export default searchService;
