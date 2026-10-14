import api from "./api";

const gmailService = {
    connectGmail: async (code) => {
        const response = await api.post("/gmail/connect", { code });
        return response.data;
    },

    disconnectGmail: async () => {
        const response = await api.post("/gmail/disconnect");
        return response.data;
    },

    syncGmail: async () => {
        const response = await api.post("/gmail/sync");
        return response.data;
    },

    getGmailStatus: async () => {
        const response = await api.get("/gmail/status");
        return response.data;
    },

    getEmails: async () => {
        const response = await api.get("/gmail/emails");
        return response.data;
    },

    getEmailsByCompany: async (company) => {
        const response = await api.get(`/gmail/emails/${encodeURIComponent(company)}`);
        return response.data;
    },
};

export default gmailService;
