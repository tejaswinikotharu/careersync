const { google } = require("googleapis");
const User = require("../../models/User");
const RawEmail = require("../../models/RawEmail");
const EmailSource = require("../../models/EmailSource");
const SyncRun = require("../../models/SyncRun");
const EmailProcessingLog = require("../../models/EmailProcessingLog");
const { parseGmailMessage } = require("./gmailParser");
const gmailAuthService = require("./gmailAuthService");

// In-memory sync locks to prevent concurrent sync operations within the running server instance
const syncLocks = new Map();

// Retry transient failures using exponential backoff backoffs
const executeWithRetry = async (operation, maxAttempts = 4) => {
    let attempt = 1;
    while (true) {
        try {
            return await operation();
        } catch (err) {
            // Confirm if error is authentication failure: fail immediately
            if (gmailAuthService.isAuthError(err)) {
                throw err;
            }
            if (attempt >= maxAttempts) {
                throw err; // Out of attempts, propagate transient error
            }

            let delay = 0;
            if (attempt === 1) {
                console.log(`[GmailSync] Attempt 1 failed with transient error: ${err.message}. Retrying immediately...`);
            } else if (attempt === 2) {
                delay = 2000;
                console.log(`[GmailSync] Attempt 2 failed with transient error: ${err.message}. Retrying in 2 seconds...`);
            } else if (attempt === 3) {
                delay = 4000;
                console.log(`[GmailSync] Attempt 3 failed with transient error: ${err.message}. Retrying in 4 seconds...`);
            }

            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
            attempt++;
        }
    }
};

// Exchange OAuth code for credentials (run during initial link)
const connectUserGmail = async (userId, authCode) => {
    const oauth2Client = gmailAuthService.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(authCode);

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }

    user.googleTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || user.googleTokens?.refresh_token,
        expiry_date: tokens.expiry_date,
        lastRefreshSuccess: new Date(),
        refreshCount: 0,
        consecutiveAuthFailures: 0,
        lastAuthError: null
    };

    await user.save();
    console.log(`[GmailAuth] Connected Gmail account successfully for user: ${userId}`);
    return user;
};

// Resilient synchronization routine for placement inbox messages
const syncUserEmails = async (userId) => {
    const userIdStr = userId.toString();

    // Check in-memory sync lock map
    if (syncLocks.has(userIdStr)) {
        console.warn(`[GmailSync] Sync already in progress for user ${userIdStr}. Blocked concurrent execution.`);
        throw new Error("SYNC_ALREADY_RUNNING");
    }

    // Set lock
    let resolveLock;
    const lockPromise = new Promise((resolve) => {
        resolveLock = resolve;
    });
    syncLocks.set(userIdStr, lockPromise);

    const user = await User.findById(userId);
    if (!user) {
        syncLocks.delete(userIdStr);
        resolveLock();
        throw new Error("User not found");
    }

    // Mirror lock state to DB User model for UI visibility
    try {
        if (user.googleTokens) {
            user.googleTokens.isSyncRunning = true;
            await user.save();
        }
    } catch (dbErr) {
        console.error(`[GmailSync] Failed to mirror sync lock in DB for user ${userIdStr}:`, dbErr.message);
    }

    // Initialize SyncRun
    const syncRun = await SyncRun.create({
        userId: user._id,
        startedAt: new Date(),
        status: "running"
    });

    let emailsFetchedCount = 0;
    let emailsProcessedCount = 0;
    let companiesCreatedCount = 0;
    let companiesUpdatedCount = 0;
    let studentUpdatesAddedCount = 0;
    let ignoredEmailsCount = 0;
    let duplicateEmailsCount = 0;
    const errors = [];

    const extractEmail = (senderStr) => {
        const match = senderStr.match(/<([^>]+)>/);
        return match ? match[1].trim().toLowerCase() : senderStr.trim().toLowerCase();
    };

    console.log(`[GmailSync] Sync started for user: ${userIdStr}`);

    try {
        // Retrieve client using Centralized Manager
        const gmail = await gmailAuthService.getAuthenticatedClientForUser(user);

        // Fetch active sources from database
        const activeSources = await EmailSource.find({ userId: user._id, isActive: true });
        const searchEmails = activeSources.filter(s => s.type !== "ignored").map(s => s.email);

        if (searchEmails.length === 0) {
            console.log(`No active email sources configured for user ${userId}. Sync skipped.`);
            syncRun.status = "completed";
            syncRun.endedAt = new Date();
            await syncRun.save();
            
            // Release lock
            syncLocks.delete(userIdStr);
            resolveLock();
            try {
                const freshUser = await User.findById(userId);
                if (freshUser && freshUser.googleTokens) {
                    freshUser.googleTokens.isSyncRunning = false;
                    await freshUser.save();
                }
            } catch (dbErr) {
                console.error(`[GmailSync] Failed to clear DB sync status:`, dbErr.message);
            }

            return {
                emailsFetched: 0,
                emailsProcessed: 0,
                companiesCreated: 0,
                companiesUpdated: 0,
                studentUpdatesAdded: 0,
                ignoredEmails: 0,
                duplicateEmails: 0,
                errors: []
            };
        }

        const Company = require("../../models/Company");
        const rawEmailCountBefore = await RawEmail.countDocuments({});
        const companyCountBefore = await Company.countDocuments({});

        let searchQuery = `from:(${searchEmails.join(" OR ")})`;
        if (user.googleTokens && user.googleTokens.initialSyncCompleted && user.googleTokens.lastSuccessfulSync) {
            const afterSeconds = Math.floor(new Date(user.googleTokens.lastSuccessfulSync).getTime() / 1000);
            searchQuery += ` after:${afterSeconds}`;
        }

        console.log(`=========================`);
        console.log(`SYNC START`);
        console.log(`=========================`);
        console.log(`User ID: ${user._id}`);
        console.log(`Email: ${user.email}`);
        console.log(`initialSyncCompleted: ${user.googleTokens?.initialSyncCompleted}`);
        console.log(`lastSuccessfulSync: ${user.googleTokens?.lastSuccessfulSync}`);
        console.log(`searchQuery: "${searchQuery}"`);
        console.log(`=========================`);

        const MAX_PAGES = 10;
        let pageToken = null;
        let pageNumber = 1;
        const messages = [];

        do {
            if (pageNumber > MAX_PAGES) {
                console.error(`[GmailSync] Unexpected pagination limit reached. Aborting sync page count safety check.`);
                throw new Error("Unexpected pagination limit reached.");
            }

            const listParams = {
                userId: "me",
                q: searchQuery,
                maxResults: 50
            };
            if (pageToken) {
                listParams.pageToken = pageToken;
            }

            const listRes = await executeWithRetry(() =>
                gmail.users.messages.list(listParams)
            );

            const pageMessages = listRes.data.messages || [];
            messages.push(...pageMessages);

            console.log(`=========================`);
            console.log(`Call gmail.users.messages.list()`);
            console.log(`pageNumber: ${pageNumber}`);
            console.log(`pageToken: ${pageToken || "null"}`);
            console.log(`messagesReturned: ${pageMessages.length}`);
            console.log(`nextPageToken: ${listRes.data.nextPageToken || "null"}`);
            console.log(`=========================`);

            pageToken = listRes.data.nextPageToken;
            pageNumber++;
        } while (pageToken);

        emailsFetchedCount = messages.length;

        const { processEmailWithAI } = require("../ai/emailAnalyzer");
        const dirtyCompanies = new Set();

        for (const msg of messages) {
            const emailExists = await RawEmail.findOne({ gmailMessageId: msg.id });
            if (emailExists) {
                duplicateEmailsCount++;
                console.log(`=========================`);
                console.log(`gmailMessageId: ${msg.id}`);
                console.log(`subject: "${emailExists.subject}"`);
                console.log(`sender: ${emailExists.sender}`);
                console.log(`alreadyExistsInRawEmail?: YES`);
                console.log(`skipped: already exists in RawEmail`);
                console.log(`=========================`);

                await EmailProcessingLog.create({
                    userId: user._id,
                    syncRunId: syncRun._id,
                    sender: emailExists.sender || "Unknown",
                    subject: emailExists.subject || "Duplicate Email",
                    companyDetected: emailExists.aiAnalysis?.company || "Unknown",
                    category: "Unknown",
                    workspaceFound: true,
                    action: "SKIP_DUPLICATE",
                    reasonCode: "DUPLICATE_EMAIL",
                    reason: `Skipped duplicate email with Message ID: ${msg.id}`
                });
                continue;
            }

            // Fetch message payload using exponential retry wrapper
            const msgRes = await executeWithRetry(() =>
                gmail.users.messages.get({
                    userId: "me",
                    id: msg.id
                })
            );

            const parsed = parseGmailMessage(msgRes.data);
            const senderEmail = extractEmail(parsed.sender);
            const sourceConfig = activeSources.find(s => s.email.toLowerCase() === senderEmail);

            if (!sourceConfig || sourceConfig.type === "ignored") {
                ignoredEmailsCount++;
                console.log(`=========================`);
                console.log(`gmailMessageId: ${msg.id}`);
                console.log(`subject: "${parsed.subject}"`);
                console.log(`sender: ${parsed.sender}`);
                console.log(`alreadyExistsInRawEmail?: NO`);
                console.log(`skipped: sender is not in trusted sources or marked as ignored`);
                console.log(`=========================`);

                await EmailProcessingLog.create({
                    userId: user._id,
                    syncRunId: syncRun._id,
                    sender: parsed.sender,
                    subject: parsed.subject,
                    companyDetected: "Unknown",
                    category: "Unknown",
                    workspaceFound: false,
                    action: "IGNORE",
                    reasonCode: "IGNORED_SOURCE",
                    reason: `Email from ${parsed.sender} is marked as ignored or inactive.`
                });
                continue;
            }

            const createdRawEmail = await RawEmail.create({
                gmailMessageId: msg.id,
                threadId: msg.threadId,
                userId: user._id,
                sender: parsed.sender,
                subject: parsed.subject,
                snippet: parsed.snippet,
                plainText: parsed.body,
                html: parsed.htmlBody || "",
                attachments: parsed.attachments || [],
                receivedAt: parsed.receivedAt || new Date(),
                processed: false
            });

            console.log(`=========================`);
            console.log(`gmailMessageId: ${msg.id}`);
            console.log(`subject: "${parsed.subject}"`);
            console.log(`sender: ${parsed.sender}`);
            console.log(`alreadyExistsInRawEmail?: NO`);
            console.log(`inserted: ${createdRawEmail._id}`);
            console.log(`=========================`);

            let processCalled = "NO";
            let processReason = "";
            let result = null;

            try {
                processCalled = "YES";
                result = await processEmailWithAI(createdRawEmail._id, syncRun._id, sourceConfig);
                emailsProcessedCount++;
                if (result.companyId) {
                    dirtyCompanies.add(result.companyId.toString());
                }
                if (result.action === "CREATE_WORKSPACE") {
                    companiesCreatedCount++;
                } else if (result.action === "UPDATE_WORKSPACE") {
                    companiesUpdatedCount++;
                } else if (result.action === "CREATE_UPDATE") {
                    studentUpdatesAddedCount++;
                } else if (result.action === "IGNORE") {
                    ignoredEmailsCount++;
                }
            } catch (procErr) {
                processReason = procErr.message;
                console.error(`Error processing email ${createdRawEmail._id}:`, procErr.message);
                errors.push(`Email ID ${createdRawEmail._id}: ${procErr.message}`);

                await EmailProcessingLog.create({
                    userId: user._id,
                    syncRunId: syncRun._id,
                    sender: parsed.sender,
                    subject: parsed.subject,
                    companyDetected: "Unknown",
                    category: "Unknown",
                    workspaceFound: false,
                    action: "ERROR",
                    reasonCode: "PARSER_FAILED",
                    reason: procErr.message
                });
            }

            console.log(`=========================`);
            console.log(`processEmailWithAI called? ${processCalled}`);
            if (processCalled === "NO") {
                console.log(`reason: ${processReason}`);
            } else if (result) {
                console.log(`classification: ${result.classification || "Unknown"}`);
                console.log(`company: ${result.company || "Unknown"}`);
                console.log(`eventType: ${result.eventType || "Unknown"}`);
                console.log(`workspace created? ${result.action === "CREATE_WORKSPACE" ? "YES" : "NO"}`);
                console.log(`company created? ${result.action === "CREATE_WORKSPACE" ? "YES" : "NO"}`);
                console.log(`company id: ${result.companyId || "null"}`);
            }
            console.log(`=========================`);
        }

        const rawEmailCountAfter = await RawEmail.countDocuments({});
        const companyCountAfter = await Company.countDocuments({});

        try {
            const freshUser = await User.findById(userId);
            if (freshUser && freshUser.googleTokens) {
                freshUser.googleTokens.initialSyncCompleted = true;
                freshUser.googleTokens.lastSuccessfulSync = new Date();
                await freshUser.save();
                console.log(`=========================`);
                console.log(`RawEmail count before sync: ${rawEmailCountBefore}`);
                console.log(`RawEmail count after sync: ${rawEmailCountAfter}`);
                console.log(`Company count before sync: ${companyCountBefore}`);
                console.log(`Company count after sync: ${companyCountAfter}`);
                console.log(`initialSyncCompleted final value: ${freshUser.googleTokens.initialSyncCompleted}`);
                console.log(`=========================`);
            }
        } catch (metadataErr) {
            console.error(`[GmailSync] Failed to update user sync metadata:`, metadataErr.message);
        }
    } catch (err) {
        console.error("Critical error in syncUserEmails:", err.message);
        errors.push(`Gmail client / OAuth error: ${err.message}`);
        syncRun.status = "failed";

        // Attempt user cleanup and disconnection if verified credentials failure
        await gmailAuthService.handleAuthFailure(user, err);
    } finally {
        // ALWAYS release both in-memory and database locks in a finally block
        syncLocks.delete(userIdStr);
        resolveLock();

        try {
            const freshUser = await User.findById(userId);
            if (freshUser && freshUser.googleTokens) {
                freshUser.googleTokens.isSyncRunning = false;
                await freshUser.save();
            }
        } catch (dbErr) {
            console.error(`[GmailSync] Failed to clear DB sync status:`, dbErr.message);
        }

        const endedAt = new Date();
        const duration = endedAt - syncRun.startedAt;

        if (syncRun.status !== "failed") {
            syncRun.status = errors.length > 0 ? "completed_with_warnings" : "completed";
        }

        syncRun.endedAt = endedAt;
        syncRun.duration = duration;
        syncRun.emailsFetched = emailsFetchedCount;
        syncRun.emailsProcessed = emailsProcessedCount;
        syncRun.companiesCreated = companiesCreatedCount;
        syncRun.companiesUpdated = companiesUpdatedCount;
        syncRun.studentUpdatesAdded = studentUpdatesAddedCount;
        syncRun.ignoredEmails = ignoredEmailsCount;
        syncRun.duplicateEmails = duplicateEmailsCount;
        syncRun.syncErrors = errors;
        await syncRun.save();

        // Batch enrich all unique dirty companies in the background
        if (typeof dirtyCompanies !== "undefined" && dirtyCompanies.size > 0) {
            try {
                const { batchEnrichCompanies } = require("../ai/companyIntelligenceService");
                batchEnrichCompanies(Array.from(dirtyCompanies));
            } catch (enrichErr) {
                console.error("[GmailSync] Batch enrichment failed at sync completion:", enrichErr.message);
            }
        }

        console.log(`[GmailSync] Sync completed for user: ${userIdStr}. Status: ${syncRun.status}`);
    }

    return {
        emailsFetched: emailsFetchedCount,
        emailsProcessed: emailsProcessedCount,
        companiesCreated: companiesCreatedCount,
        companiesUpdated: companiesUpdatedCount,
        studentUpdatesAdded: studentUpdatesAddedCount,
        ignoredEmails: ignoredEmailsCount,
        duplicateEmails: duplicateEmailsCount,
        errors
    };
};

module.exports = {
    connectUserGmail,
    syncUserEmails
};
