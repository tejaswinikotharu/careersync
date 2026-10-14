const Event = require("../../models/Event");

const createEventFromAI = async (userId, companyId, companyName, category, date, isDeadline) => {
    try {
        const title = isDeadline ? `${companyName} - Application Deadline` : `${companyName} - ${category}`;
        
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);

        // Prevent duplicate calendar events
        const duplicate = await Event.findOne({
            userId,
            companyId,
            title,
            date: {
                $gte: dateStart,
                $lt: dateEnd,
            },
        });

        if (!duplicate) {
            let type = "Assessment";
            const lowerTitle = title.toLowerCase();
            if (isDeadline) {
                type = "Deadline";
            } else if (lowerTitle.includes("interview")) {
                type = "Interview";
            } else if (lowerTitle.includes("coding")) {
                type = "Coding";
            } else if (lowerTitle.includes("test")) {
                type = "Test";
            }

            const newEvent = await Event.create({
                userId,
                companyId,
                companyName,
                title,
                date,
                type,
            });

            console.log(`Calendar Event created: "${title}" on ${date.toDateString()}`);

            // Emit real-time update
            const { sendRealTimeUpdate } = require("../../config/socket");
            sendRealTimeUpdate(userId, "event_created", newEvent);

            return newEvent;
        }
    } catch (error) {
        console.error("Error in calendarService:", error.message);
    }
};

module.exports = {
    createEventFromAI,
};
