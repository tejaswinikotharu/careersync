const Placement = require("../models/Placement");
const RawEmail = require("../models/RawEmail");
const User = require("../models/User");
const { connectUserGmail, syncUserEmails } = require("../services/gmail/gmailService");

// Helper to map placement records to the JSON structure the React frontend expects
const mapPlacementToEmailShape = (p) => {
    const raw = p.rawEmailId || {};
    return {
        _id: p._id,
        id: p._id,
        company: p.company,
        companySlug: p.companyId?.slug || p.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        sender: raw.sender || "Unknown",
        subject: raw.subject || `${p.company} - ${p.event}`,
        snippet: p.summary || raw.snippet || "",
        body: raw.plainText || raw.html || "",
        receivedAt: raw.receivedAt || p.createdAt,
        category: p.event,
        summary: p.summary,
        deadline: p.deadline,
        jobRole: p.role,
        package: p.package,
        eligibility: p.cgpa,
        applyLink: p.registrationLink,
        codingTestDate: p.testDate,
        interviewDates: p.interviewDate ? [p.interviewDate] : [],
        importantInstructions: p.importantInstructions || [],
        requiredDocuments: p.requiredDocuments || [],
        mockTests: p.mockTests || [],
    };
};

// @desc    Connect Gmail account via Google OAuth Auth Code
// @route   POST /api/gmail/connect
// @access  Private
const connectGmail = async (req, res, next) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400);
            throw new Error("Authorization code is required");
        }

        await connectUserGmail(req.user._id, code);

        res.status(200).json({
            success: true,
            message: "Gmail linked successfully",
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Manually trigger Gmail synchronization
// @route   POST /api/gmail/sync
// @access  Private
const syncGmail = async (req, res, next) => {
    try {
        const stats = await syncUserEmails(req.user._id);

        res.status(200).json({
            success: true,
            message: `Synchronization complete.`,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all synced emails for logged-in user
// @route   GET /api/gmail/emails
// @access  Private
const getEmails = async (req, res, next) => {
    try {
        const placements = await Placement.find({ userId: req.user._id })
            .populate("rawEmailId")
            .populate("companyId")
            .sort({ createdAt: -1 })
            .limit(50);

        const emailsList = placements.map(mapPlacementToEmailShape);

        res.status(200).json({
            success: true,
            data: emailsList,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get synced emails for a specific company
// @route   GET /api/gmail/emails/:company
// @access  Private
const getEmailsByCompany = async (req, res, next) => {
    try {
        const { company } = req.params;
        
        // Find using case-insensitive match (e.g. "tcs" or "TCS")
        const placements = await Placement.find({
            userId: req.user._id,
            company: { $regex: new RegExp(`^${company}$`, "i") },
        })
            .populate("rawEmailId")
            .populate("companyId")
            .sort({ createdAt: -1 });

        const emailsList = placements.map(mapPlacementToEmailShape);

        res.status(200).json({
            success: true,
            data: emailsList,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Gmail connection status and metrics
// @route   GET /api/gmail/status
// @access  Private
const getGmailStatus = async (req, res, next) => {
    try {
        console.log(`[GmailStatus] Health status checked for user: ${req.user._id}`);
        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404);
            throw new Error("User not found");
        }

        if (!user.googleTokens || !user.googleTokens.refresh_token) {
            return res.status(200).json({
                success: true,
                connected: false,
                state: "NOT_CONNECTED",
                message: "No credentials stored."
            });
        }

        const gmailAuthService = require("../services/gmail/gmailAuthService");
        
        try {
            const gmail = await gmailAuthService.getAuthenticatedClientForUser(user);
            const profileRes = await gmail.users.getProfile({ userId: "me" });
            
            return res.status(200).json({
                success: true,
                connected: true,
                state: "CONNECTED",
                email: profileRes.data.emailAddress,
                lastVerified: new Date(),
                tokenExpiresAt: user.googleTokens.expiry_date ? new Date(user.googleTokens.expiry_date) : null,
                lastTokenRefresh: user.googleTokens.lastRefreshSuccess,
                syncRunning: user.googleTokens.isSyncRunning || false,
                tokenRefreshWorking: true
            });
        } catch (err) {
            console.error("[GmailStatus] Token verification failed:", err.message);
            
            if (gmailAuthService.isAuthError(err)) {
                await gmailAuthService.handleAuthFailure(user, err);
                return res.status(200).json({
                    success: true,
                    connected: false,
                    state: "RECONNECT_REQUIRED",
                    reason: "Credentials revoked or expired"
                });
            } else {
                return res.status(200).json({
                    success: true,
                    connected: true,
                    state: "TRANSIENT_ERROR",
                    email: user.email,
                    tokenRefreshWorking: false,
                    error: err.message
                });
            }
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Disconnect Gmail account (clear credentials)
// @route   POST /api/gmail/disconnect
// @access  Private
const disconnectGmail = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.googleTokens = undefined;
            await user.save();
        }
        console.log(`[GmailAuth] Gmail disconnected manually by user: ${req.user._id}`);
        res.status(200).json({
            success: true,
            message: "Gmail disconnected successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    connectGmail,
    syncGmail,
    getEmails,
    getEmailsByCompany,
    getGmailStatus,
    disconnectGmail,
};
