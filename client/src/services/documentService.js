import api from "./api";

const documentService = {
    uploadDocument: async (file, companyId, type, name) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        formData.append("name", name);
        if (companyId) {
            formData.append("companyId", companyId);
        }

        const response = await api.post("/documents/upload", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return response.data;
    },

    getDocumentsByCompany: async (companyId) => {
        const response = await api.get(`/documents/company/${companyId}`);
        return response.data;
    },

    deleteDocument: async (id) => {
        const response = await api.delete(`/documents/${id}`);
        return response.data;
    },
};

export default documentService;
