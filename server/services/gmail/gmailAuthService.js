const { google } = require("googleapis");
const User = require("../../models/User");

// Active in-memory refresh locks to coalesce concurrent requests
const refreshLocks = new Map();

// Generate standard Google OAuth2 Client
const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "postmessage"
    );
};

// Check if error corresponds to a confirmed authentication/credentials failure
const isAuthError = (err) => {
    if (!err) return false;
    const message = (err.message || "").toLowerCase();
    const code = err.code || "";
    
    // Checked keys: invalid_grant, invalid_request, unauthorized_client, invalid_client, 401, 403 authentication failures
    return (
        message.includes("invalid_grant") ||
        message.includes("invalid_request") ||
        message.includes("unauthorized_client") ||
        message.includes("invalid_client") ||
        code === 401 ||
        code === "401" ||
        code === 403 ||
        code === "403" ||
        message.includes("no refresh token") ||
        message.includes("credentials") ||
        message.includes("token failed")
    );
};

// Clean credentials if confirmed authorization failure
const handleAuthFailure = async (user, err) => {
    if (isAuthError(err)) {
        console.warn(`[GmailAuth] Confirmed authentication failure for user ${user._id}. Revoking credentials...`);
        try {
            const freshUser = await User.findById(user._id);
            if (freshUser) {
                freshUser.googleTokens = undefined;
                await freshUser.save();
                console.log(`[GmailAuth] Cleared invalid tokens from database for user ${user._id}.`);
            }
        } catch (dbErr) {
            console.error(`[GmailAuth] Failed to clear user tokens from DB:`, dbErr.message);
        }
        return true;
    }
    return false;
};

// Get authenticated Gmail Client for the user (performs coalesced refresh if expired)
const getAuthenticatedClientForUser = async (user) => {
    if (!user.googleTokens || !user.googleTokens.refresh_token) {
        throw new Error("Gmail not connected. Refresh token missing.");
    }

    const userIdStr = user._id.toString();

    // Check if refresh lock is already active for this user
    if (refreshLocks.has(userIdStr)) {
        console.log(`[GmailAuth] Concurrent refresh request detected for user ${userIdStr}. Waiting for lock...`);
        return refreshLocks.get(userIdStr);
    }

    // Check if access token is expired or close to expiry (1 minute buffer)
    const isExpired = !user.googleTokens.expiry_date || Date.now() >= user.googleTokens.expiry_date - 60000;

    if (isExpired) {
        console.log(`[GmailAuth] Token is expired or expiring soon for user ${userIdStr}. Acquiring refresh lock...`);
        const refreshPromise = (async () => {
            try {
                const oauth2Client = getOAuth2Client();
                oauth2Client.setCredentials({
                    access_token: user.googleTokens.access_token,
                    refresh_token: user.googleTokens.refresh_token,
                    expiry_date: user.googleTokens.expiry_date,
                });

                console.log(`[GmailAuth] OAuth refresh started for user: ${userIdStr}`);
                const res = await oauth2Client.refreshAccessToken();
                const tokens = res.credentials;

                // Load user fresh from DB to prevent overwriting concurrent updates
                const freshUser = await User.findById(user._id);
                if (!freshUser) {
                    throw new Error("User not found during token refresh");
                }

                // Update tokens and handle Refresh Token Rotation (if Google returns new refresh token)
                freshUser.googleTokens.access_token = tokens.access_token;
                freshUser.googleTokens.expiry_date = tokens.expiry_date;
                if (tokens.refresh_token) {
                    console.log(`[GmailAuth] Refresh token rotated for user: ${userIdStr}`);
                    freshUser.googleTokens.refresh_token = tokens.refresh_token;
                }

                // Update diagnostics metrics
                freshUser.googleTokens.lastRefreshSuccess = new Date();
                freshUser.googleTokens.refreshCount = (freshUser.googleTokens.refreshCount || 0) + 1;
                freshUser.googleTokens.consecutiveAuthFailures = 0;
                freshUser.googleTokens.lastAuthError = null;

                await freshUser.save();
                console.log(`[GmailAuth] OAuth refresh completed. Saved refreshed tokens for user: ${userIdStr}`);

                // Update original object reference
                user.googleTokens.access_token = tokens.access_token;
                user.googleTokens.expiry_date = tokens.expiry_date;
                if (tokens.refresh_token) {
                    user.googleTokens.refresh_token = tokens.refresh_token;
                }

                return google.gmail({ version: "v1", auth: oauth2Client });
            } catch (refreshErr) {
                console.error(`[GmailAuth] OAuth refresh failed for user ${userIdStr}:`, refreshErr.message);
                
                // Load user fresh to log failure
                const freshUser = await User.findById(user._id);
                if (freshUser && freshUser.googleTokens) {
                    freshUser.googleTokens.lastAuthError = refreshErr.message;
                    freshUser.googleTokens.consecutiveAuthFailures = (freshUser.googleTokens.consecutiveAuthFailures || 0) + 1;
                    await freshUser.save();
                }

                // Disconnect user if confirmed auth failure
                await handleAuthFailure(user, refreshErr);
                throw refreshErr;
            } finally {
                // Release the lock
                refreshLocks.delete(userIdStr);
            }
        })();

        refreshLocks.set(userIdStr, refreshPromise);
        return refreshPromise;
    }

    // Token is valid: configure client and return immediately
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
        access_token: user.googleTokens.access_token,
        refresh_token: user.googleTokens.refresh_token,
        expiry_date: user.googleTokens.expiry_date,
    });

    return google.gmail({ version: "v1", auth: oauth2Client });
};

module.exports = {
    getOAuth2Client,
    isAuthError,
    handleAuthFailure,
    getAuthenticatedClientForUser
};
