const EmailSource = require("../models/EmailSource");
const RawEmail = require("../models/RawEmail");
const EmailProcessingLog = require("../models/EmailProcessingLog");

// Extract email address from typical "Name <email@address.com>" formats
const extractEmailAddress = (senderStr) => {
    if (!senderStr) return "";
    const match = senderStr.match(/<([^>]+)>/);
    return match ? match[1].trim().toLowerCase() : senderStr.trim().toLowerCase();
};

/**
 * Get all configured email sources for the authenticated user + auto-discovered unknown senders
 * @route GET /api/settings/email-sources
 */
const getEmailSources = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Fetch configured email sources
        const sources = await EmailSource.find({ userId }).sort({ priority: 1, email: 1 });

        // 2. Discover unknown senders from imported RawEmail logs
        const configuredEmails = new Set(sources.map(s => s.email.toLowerCase()));
        
        const rawSenders = await RawEmail.distinct("sender", { userId });
        const unknownSendersMap = new Map();

        for (const sender of rawSenders) {
            const email = extractEmailAddress(sender);
            if (email && !configuredEmails.has(email)) {
                // Find last email details for snippet preview
                const lastEmail = await RawEmail.findOne({ userId, sender })
                    .sort({ receivedAt: -1 })
                    .select("subject snippet receivedAt");
                
                unknownSendersMap.set(email, {
                    email,
                    rawSender: sender,
                    lastSubject: lastEmail ? lastEmail.subject : "No Subject",
                    lastReceivedAt: lastEmail ? lastEmail.receivedAt : null
                });
            }
        }

        res.status(200).json({
            success: true,
            sources,
            unknownSenders: Array.from(unknownSendersMap.values())
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Add a new email source
 * @route POST /api/settings/email-sources
 */
const addEmailSource = async (req, res) => {
    try {
        const userId = req.user.id;
        const { email, type, isActive, priority } = req.body;

        if (!email || !type) {
            return res.status(400).json({ success: false, message: "Email address and source type are required." });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check if already configured
        const exists = await EmailSource.findOne({ userId, email: normalizedEmail });
        if (exists) {
            return res.status(400).json({ success: false, message: "Email source already configured for this user." });
        }

        const source = await EmailSource.create({
            userId,
            email: normalizedEmail,
            type,
            isActive: isActive !== undefined ? isActive : true,
            priority: priority !== undefined ? Number(priority) : 1
        });

        res.status(201).json({ success: true, message: "Email source added successfully.", source });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Update an existing email source settings (active toggle, priority, type)
 * @route PUT /api/settings/email-sources/:id
 */
const updateEmailSource = async (req, res) => {
    try {
        const userId = req.user.id;
        const sourceId = req.params.id;
        const { type, isActive, priority } = req.body;

        const source = await EmailSource.findOne({ _id: sourceId, userId });
        if (!source) {
            return res.status(404).json({ success: false, message: "Email source not found or unauthorized." });
        }

        if (type !== undefined) source.type = type;
        if (isActive !== undefined) source.isActive = isActive;
        if (priority !== undefined) source.priority = Number(priority);

        await source.save();
        res.status(200).json({ success: true, message: "Email source updated successfully.", source });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Delete an email source
 * @route DELETE /api/settings/email-sources/:id
 */
const deleteEmailSource = async (req, res) => {
    try {
        const userId = req.user.id;
        const sourceId = req.params.id;

        const result = await EmailSource.deleteOne({ _id: sourceId, userId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: "Email source not found or unauthorized." });
        }

        res.status(200).json({ success: true, message: "Email source removed successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Test source health metrics and analytics
 * @route POST /api/settings/email-sources/:id/test
 */
const testEmailSource = async (req, res) => {
    try {
        const userId = req.user.id;
        const sourceId = req.params.id;

        const source = await EmailSource.findOne({ _id: sourceId, userId });
        if (!source) {
            return res.status(404).json({ success: false, message: "Email source not found or unauthorized." });
        }

        // Query metrics
        const escapedEmail = source.email.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const senderRegex = new RegExp(escapedEmail, "i");

        const totalEmailsCount = await RawEmail.countDocuments({ userId, sender: senderRegex });
        const lastEmail = await RawEmail.findOne({ userId, sender: senderRegex }).sort({ receivedAt: -1 });

        const companiesCreatedCount = await EmailProcessingLog.countDocuments({
            userId,
            sender: senderRegex,
            action: "CREATE_WORKSPACE"
        });

        const companiesUpdatedCount = await EmailProcessingLog.countDocuments({
            userId,
            sender: senderRegex,
            action: "UPDATE_WORKSPACE"
        });

        const errorsCount = await EmailProcessingLog.countDocuments({
            userId,
            sender: senderRegex,
            action: "ERROR"
        });

        res.status(200).json({
            success: true,
            metrics: {
                lastEmailSubject: lastEmail ? lastEmail.subject : "None received yet",
                lastSync: lastEmail ? lastEmail.receivedAt : null,
                totalEmails: totalEmailsCount,
                companiesCreated: companiesCreatedCount,
                companiesUpdated: companiesUpdatedCount,
                errors: errorsCount,
                lastProcessed: lastEmail && lastEmail.processed ? lastEmail.updatedAt : null
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getEmailSources,
    addEmailSource,
    updateEmailSource,
    deleteEmailSource,
    testEmailSource
};
