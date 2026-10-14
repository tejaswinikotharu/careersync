const Company = require("../models/Company");
const Placement = require("../models/Placement");
const RawEmail = require("../models/RawEmail");
const Event = require("../models/Event");
const Notification = require("../models/Notification");
const UserCompany = require("../models/UserCompany");

// @desc    Global query search across all collections
// @route   GET /api/search
// @access  Private
const globalSearch = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(200).json({
                success: true,
                data: {
                    workspaces: [],
                    emails: [],
                    events: [],
                    notifications: [],
                    aiInsights: []
                }
            });
        }

        const regex = new RegExp(q, "i");
        const userId = req.user._id;

        // 1. Search tracked workspaces
        const userTracked = await UserCompany.find({ userId }).populate("companyId");
        
        const workspaces = userTracked.filter(ut => {
            if (!ut.companyId) return false;
            return ut.companyId.name.match(regex) || ut.companyId.slug.match(regex);
        }).map(ut => ({
            _id: ut.companyId._id,
            name: ut.companyId.name,
            slug: ut.companyId.slug,
            trackingId: ut._id,
            status: ut.status,
            currentRound: ut.currentRound,
            progress: ut.progress
        }));

        // 2. Search raw emails first to find match references
        const matchingRawEmails = await RawEmail.find({
            userId,
            $or: [
                { subject: regex },
                { plainText: regex },
                { html: regex },
                { sender: regex }
            ]
        });
        const rawIds = matchingRawEmails.map(raw => raw._id);

        // Find Placements that reference matching RawEmails or match company details
        const placements = await Placement.find({
            userId,
            $or: [
                { rawEmailId: { $in: rawIds } },
                { company: regex },
                { role: regex },
                { event: regex },
                { summary: regex }
            ]
        }).populate("rawEmailId").sort({ createdAt: -1 }).limit(20);

        const emails = placements.map(p => {
            const raw = p.rawEmailId || {};
            return {
                _id: p._id,
                id: p._id,
                company: p.company,
                sender: raw.sender || "Unknown",
                subject: raw.subject || `${p.company} - ${p.event}`,
                snippet: p.summary || raw.snippet || "",
                body: raw.plainText || raw.html || "",
                receivedAt: raw.receivedAt || p.createdAt,
                category: p.event,
                summary: p.summary,
            };
        });

        // 3. Search events
        const events = await Event.find({
            userId,
            $or: [
                { title: regex },
                { type: regex },
                { companyName: regex }
            ]
        }).sort({ date: 1 }).limit(20);

        // 4. Search notifications
        const notifications = await Notification.find({
            userId,
            $or: [
                { title: regex },
                { message: regex }
            ]
        }).sort({ createdAt: -1 }).limit(20);

        // 5. Search AI Insights
        const aiInsights = [];
        userTracked.forEach(ut => {
            if (!ut.companyId) return;
            const companyName = ut.companyId.name;
            const analysis = ut.aiAnalysis || {};
            
            const matchesSummary = analysis.summary?.match(regex);
            const matchesStrategy = analysis.prepStrategy?.match(regex);
            const matchesInstructions = analysis.importantInstructions?.some(ins => ins.match(regex));
            const matchesCoding = analysis.codingTopics?.some(t => t.match(regex));
            const matchesInterviews = analysis.interviewTopics?.some(t => t.match(regex));
            const matchesMock = ut.mockTests?.some(m => m.name.match(regex));

            if (matchesSummary || matchesStrategy || matchesInstructions || matchesCoding || matchesInterviews || matchesMock) {
                aiInsights.push({
                    companyName,
                    slug: ut.companyId.slug,
                    summary: analysis.summary || "Synched workspace preparation advice.",
                    prepStrategy: analysis.prepStrategy || "",
                    codingTopics: analysis.codingTopics || [],
                    interviewTopics: analysis.interviewTopics || []
                });
            }
        });

        res.status(200).json({
            success: true,
            data: {
                workspaces,
                emails,
                events,
                notifications,
                aiInsights
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    globalSearch,
};
