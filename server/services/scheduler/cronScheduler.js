const cron = require("node-cron");
const User = require("../../models/User");
const { queueEmailSync } = require("../queues/queueService");

const initScheduler = () => {
    // Schedule cron job to sync Gmail mailboxes for all connected users every 15 minutes
    cron.schedule("*/15 * * * *", async () => {
        console.log("Scheduler: Triggering automated Gmail synchronization cycle...");
        try {
            // Find users who have Gmail OAuth tokens configured
            const users = await User.find({
                "googleTokens.refresh_token": { $exists: true, $ne: null },
            });

            console.log(`Scheduler: Found ${users.length} connected mailboxes. Dispatching queue jobs.`);
            
            for (const user of users) {
                await queueEmailSync(user._id);
            }
        } catch (error) {
            console.error("Scheduler: Automated Gmail sync execution failed:", error.message);
        }
    });

    console.log("Automated 15-minute Gmail sync scheduler registered successfully.");
};

module.exports = {
    initScheduler,
};
