import api from "./api";

const getEmailSources = () => {
    return api.get("/settings/email-sources");
};

const addEmailSource = (payload) => {
    return api.post("/settings/email-sources", payload);
};

const updateEmailSource = (id, payload) => {
    return api.put(`/settings/email-sources/${id}`, payload);
};

const deleteEmailSource = (id) => {
    return api.delete(`/settings/email-sources/${id}`);
};

const testEmailSource = (id) => {
    return api.post(`/settings/email-sources/${id}/test`);
};

export default {
    getEmailSources,
    addEmailSource,
    updateEmailSource,
    deleteEmailSource,
    testEmailSource
};
