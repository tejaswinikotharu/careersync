// Streamlined in-memory async job executor for local execution without Redis/BullMQ

const queueEmailSync = async (userId) => {
    console.log(`In-memory Queue Service: Triggering asynchronous mailbox sync for user ${userId}`);
    const { syncUserEmails } = require("../gmail/gmailService");
    
    // Execute asynchronously to avoid blocking the main server thread
    setTimeout(() => {
        syncUserEmails(userId).catch(err => {
            console.error(`In-memory sync job failed for user ${userId}:`, err.message);
        });
    }, 100);
};

const queueAiAnalysis = async (emailId) => {
    console.log(`In-memory Queue Service: Triggering asynchronous AI analysis for email ${emailId}`);
    const { processEmailWithAI } = require("../ai/emailAnalyzer");
    
    // Execute asynchronously to avoid blocking the main server thread
    setTimeout(() => {
        processEmailWithAI(emailId).catch(err => {
            console.error(`In-memory AI analysis job failed for email ${emailId}:`, err.message);
        });
    }, 100);
};

module.exports = {
    initQueueService: () => {
        console.log("In-process Queue Service initialized (Bypassing Redis/BullMQ for simplified stack).");
    },
    queueEmailSync,
    queueAiAnalysis,
};
