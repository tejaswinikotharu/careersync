import api from "./api";

const eventService = {
    getEvents: async () => {
        const response = await api.get("/events");
        return response.data;
    },

    createEvent: async (eventData) => {
        const response = await api.post("/events", eventData);
        return response.data;
    },

    updateEvent: async (id, eventData) => {
        const response = await api.put(`/events/${id}`, eventData);
        return response.data;
    },

    deleteEvent: async (id) => {
        const response = await api.delete(`/events/${id}`);
        return response.data;
    },
};

export default eventService;
