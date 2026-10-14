const Notification = require("../../models/Notification");

const createNotificationFromAI = async (userId, companyName, category, date) => {
    try {
        let title = "Placement Update";
        let message = `New recruitment notification related to ${companyName}.`;

        if (category && category.toLowerCase().includes("test")) {
            title = `🎯 Upcoming Test: ${companyName}`;
            message = `A mock or coding assessment is schedule for ${companyName} on ${
                date ? new Date(date).toLocaleDateString() : "upcoming dates"
            }.`;
        } else if (category && category.toLowerCase().includes("interview")) {
            title = `🎤 Interview Invite: ${companyName}`;
            message = `An interview round has been coordinated for ${companyName}. Please verify slots.`;
        } else if (category && category.toLowerCase().includes("deadline")) {
            title = `⏳ Deadline Alert: ${companyName}`;
            message = `Registration or offer acceptance closes soon for ${companyName}. Complete it before the deadline.`;
        }

        const notification = await Notification.create({
            userId,
            title,
            message,
            isRead: false,
        });

        console.log(`Notification created for user ${userId}: "${title}"`);

        // Emit real-time update
        const { sendRealTimeUpdate } = require("../../config/socket");
        sendRealTimeUpdate(userId, "notification_received", notification);

        return notification;
    } catch (error) {
        console.error("Error in notificationService:", error.message);
    }
};

module.exports = {
    createNotificationFromAI,
};
