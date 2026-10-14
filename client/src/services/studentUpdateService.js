import api from "./api";

const studentUpdateService = {
    getStudentUpdates: async () => {
        const response = await api.get("/student-updates");
        return response.data;
    },
};

export default studentUpdateService;
