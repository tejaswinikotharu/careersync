const UserCompany = require("../../models/UserCompany");

const updateTimelineFromAI = async (userId, companyId, timelineEvent) => {
    try {
        if (!timelineEvent || !timelineEvent.title) return;

        // Find or create UserCompany tracking record
        let userCompany = await UserCompany.findOne({ userId, companyId });

        if (!userCompany) {
            userCompany = await UserCompany.create({
                userId,
                companyId,
                status: "Pending",
                timeline: [],
            });
        }

        // Avoid duplicate timeline titles for this company
        const duplicate = userCompany.timeline.some(
            (item) => item.title.toLowerCase() === timelineEvent.title.toLowerCase()
        );

        if (!duplicate) {
            const dateStr = new Date().toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });

            userCompany.timeline.push({
                title: timelineEvent.title,
                date: dateStr,
                status: timelineEvent.status || "upcoming",
            });

            await userCompany.save();
            console.log(`Timeline updated for UserCompany: Added "${timelineEvent.title}"`);
        }
    } catch (error) {
        console.error("Error in timelineService:", error.message);
    }
};

module.exports = {
    updateTimelineFromAI,
};
