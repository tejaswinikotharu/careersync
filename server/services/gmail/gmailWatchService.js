/**
 * Gmail Webhook Watch Service Skeleton (Phase 7 ready)
 * This service implements watch, renew, and stop logic for Pub/Sub push notifications.
 */
const { google } = require("googleapis");
const User = require("../../models/User");

// Auto-resolving Google client
const getWatchGmailClient = async (userId) => {
    const user = await User.findById(userId);
    if (!user || !user.googleTokens || !user.googleTokens.refresh_token) {
        throw new Error("Google tokens are missing or user is not connected.");
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
        access_token: user.googleTokens.access_token,
        refresh_token: user.googleTokens.refresh_token,
        expiry_date: user.googleTokens.expiry_date,
    });

    return google.gmail({ version: "v1", auth: oauth2Client });
};

/**
     * Start push notifications subscription
     * @param {string} userId
     */
const watch = async (userId) => {
    try {
        const gmail = await getWatchGmailClient(userId);
        
        // Topic name configured on Google Cloud Pub/Sub
        const topicName = process.env.GOOGLE_PUB_SUB_TOPIC || "projects/careersync/topics/gmail-push";

        const res = await gmail.users.watch({
            userId: "me",
            requestBody: {
                topicName,
                labelIds: ["INBOX"],
            },
        });

        console.log(`Successfully registered Gmail Watch API for user ${userId}. History ID: ${res.data.historyId}`);
        return res.data;
    } catch (error) {
        console.error(`Gmail watch setup failed for user ${userId}:`, error.message);
        throw error;
    }
};

/**
     * Stop push notifications subscription
     * @param {string} userId
     */
const stopWatch = async (userId) => {
    try {
        const gmail = await getWatchGmailClient(userId);
        await gmail.users.stop({
            userId: "me",
        });
        console.log(`Successfully stopped Gmail Watch subscription for user ${userId}`);
        return { success: true };
    } catch (error) {
        console.error(`Failed stopping Gmail watch for user ${userId}:`, error.message);
        throw error;
    }
};

/**
     * Renew watch subscription (Google Watch expires after 7 days)
     * @param {string} userId
     */
const renewWatch = async (userId) => {
    console.log(`Renewing Gmail Watch subscription for user ${userId}`);
    return await watch(userId);
};

module.exports = {
    watch,
    stopWatch,
    renewWatch,
};
