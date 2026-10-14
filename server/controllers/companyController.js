const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");

// @desc    Get all companies (supports search, status filtering, pagination, sorting)
// @route   GET /api/companies
// @access  Private
const getCompanies = async (req, res, next) => {
    try {
        const { search, status, page = 1, limit = 10, sortBy = "name", order = "asc" } = req.query;
        
        const userTracked = await UserCompany.find({ userId: req.user._id });
        const trackedCompanyIds = userTracked.map(ut => ut.companyId);

        const query = {};

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        if (status === "Pending") {
            query._id = { $nin: trackedCompanyIds };
        } else if (status && status !== "All") {
            const userTrackedWithStatus = await UserCompany.find({ userId: req.user._id, status });
            const filteredIds = userTrackedWithStatus.map(ut => ut.companyId);
            query._id = { $in: filteredIds };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = order === "desc" ? -1 : 1;

        const total = await Company.countDocuments(query);
        const companiesList = await Company.find(query)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            message: "Companies retrieved successfully",
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
            data: companiesList,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single company by slug
// @route   GET /api/companies/:slug
// @access  Private
const getCompanyBySlug = async (req, res, next) => {
    try {
        const company = await Company.findOne({ slug: req.params.slug.toLowerCase() });
        if (!company) {
            res.status(404);
            throw new Error("Company not found");
        }

        const Placement = require("../models/Placement");
        const Event = require("../models/Event");
        const StudentUpdate = require("../models/StudentUpdate");

        // Find existing userCompany tracking record (or create it if it doesn't exist!)
        let userCompany = await UserCompany.findOne({
            userId: req.user._id,
            companyId: company._id,
        });

        if (!userCompany) {
            try {
                userCompany = await UserCompany.create({
                    userId: req.user._id,
                    companyId: company._id,
                    status: "Active",
                    currentRound: "Registration Open",
                });
                console.log(`Auto-created UserCompany tracking on-the-fly for company: "${company.name}"`);
            } catch (createErr) {
                userCompany = await UserCompany.findOne({
                    userId: req.user._id,
                    companyId: company._id,
                });
                if (!userCompany) {
                    throw createErr;
                }
            }
        }

        // Fetch first-class events from database
        const events = await Event.find({
            userId: req.user._id,
            companyId: company._id,
        }).sort({ date: 1 });

        // Sync status calculations
        const completedCount = events.filter(e => e.status === "completed").length;
        userCompany.progress = events.length > 0
            ? Math.round((completedCount / events.length) * 100)
            : 0;
        
        const currentEvent = events.find(e => e.status === "current");
        if (currentEvent) {
            userCompany.currentRound = currentEvent.title;
        }

        await userCompany.save();

        // Find placements/emails records for legacy email list view compatibility
        const placements = await Placement.find({
            userId: req.user._id,
            companyId: company._id,
        }).populate("rawEmailId");

        const studentUpdates = await StudentUpdate.find({
            userId: req.user._id,
            company: { $regex: new RegExp(`^${company.name}$`, "i") }
        }).populate("rawEmailId");

        const emails = [];
        const mapEmail = (record, isStudentUpdate) => {
            const raw = record.rawEmailId || {};
            return {
                _id: record._id,
                id: record._id,
                company: company.name,
                companySlug: company.slug,
                sender: raw.sender || "Unknown",
                subject: raw.subject || `${company.name} - ${isStudentUpdate ? record.eventType : record.event}`,
                snippet: record.summary || raw.snippet || "",
                body: raw.plainText || raw.html || "",
                receivedAt: raw.receivedAt || record.createdAt,
                category: isStudentUpdate ? "Student Update" : record.event,
                eventType: isStudentUpdate ? record.eventType : record.event,
                summary: record.summary,
                deadline: record.deadline,
                jobRole: isStudentUpdate ? "" : record.role,
                package: isStudentUpdate ? "" : record.package,
                eligibility: isStudentUpdate ? "" : record.cgpa,
                applyLink: isStudentUpdate ? record.link : record.registrationLink,
                codingTestDate: isStudentUpdate ? null : record.testDate,
                interviewDates: (isStudentUpdate ? null : record.interviewDate) ? [record.interviewDate] : [],
                importantInstructions: record.importantInstructions || record.instructions || [],
                requiredDocuments: record.requiredDocuments || [],
                mockTests: [],
            };
        };

        placements.forEach(p => emails.push(mapEmail(p, false)));
        studentUpdates.forEach(s => emails.push(mapEmail(s, true)));
        emails.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

        // Format timeline data for frontend
        const timelineWithStatus = events.map(e => ({
            _id: e._id,
            title: e.title,
            date: e.date ? new Date(e.date).toLocaleDateString() : "Pending",
            dateVal: e.date,
            eventType: e.type,
            time: e.time,
            link: e.link,
            status: e.status
        }));

        // Dynamic checklists formatted from first-class events
        const mockTests = events.filter(e => e.type === "Mock Test").map(e => ({
            _id: e._id,
            name: e.title,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));

        const prepKits = events.filter(e => e.type === "Prep Kit").map(e => ({
            _id: e._id,
            name: e.title,
            link: e.link,
            completed: e.status === "completed"
        }));

        const trainingSessions = events.filter(e => e.type === "Training").map(e => ({
            _id: e._id,
            topic: e.title,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));

        const assessments = events.filter(e => e.type === "Online Assessment" || e.type === "Deadline").map(e => ({
            _id: e._id,
            type: e.type,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));

        const interviews = events.filter(e => e.type === "Interview").map(e => ({
            _id: e._id,
            round: e.title,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));

        const resources = events.filter(e => e.link).map(e => ({
            _id: e._id,
            name: e.title,
            link: e.link,
            type: e.type === "Prep Kit" ? "Prep Kit" : e.type === "Training" ? "Training" : "Official Link"
        }));

        // Inject dynamic lists into return payload wrapper
        const userCompanyObj = userCompany.toObject();
        userCompanyObj.mockTests = mockTests;
        userCompanyObj.prepKits = prepKits;
        userCompanyObj.trainingSessions = trainingSessions;
        userCompanyObj.assessments = assessments;
        userCompanyObj.interviews = interviews;
        userCompanyObj.resources = resources;

        res.status(200).json({
            success: true,
            data: {
                company: company,
                userCompany: userCompanyObj,
                timeline: timelineWithStatus,
                events: placements,
                studentUpdates: studentUpdates,
                emails: emails,
                aiSummary: {
                    summary: userCompany.aiAnalysis?.summary || "Workspace details updated.",
                    upcomingSteps: userCompany.aiAnalysis?.upcomingSteps || [],
                    prepStrategy: userCompany.aiAnalysis?.prepStrategy || "",
                    codingTopics: userCompany.aiAnalysis?.codingTopics || [],
                    interviewTopics: userCompany.aiAnalysis?.interviewTopics || [],
                    importantInstructions: userCompany.importantInstructions || [],
                    checklist: userCompany.aiAnalysis?.checklist || [],
                    faqs: userCompany.aiAnalysis?.faqs || []
                },
                calendarData: events,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new company (Admin only)
// @route   POST /api/companies
// @access  Private/Admin
const createCompany = async (req, res, next) => {
    try {
        const { slug, name, package, eligibility, website, overview, headquarters, recruitmentProcess, timeline } = req.body;

        const slugExists = await Company.findOne({ slug: slug.toLowerCase() });
        if (slugExists) {
            res.status(400);
            throw new Error("Company slug already exists");
        }

        const company = await Company.create({
            slug: slug.toLowerCase(),
            name,
            package,
            eligibility,
            website,
            overview,
            headquarters,
            recruitmentProcess: recruitmentProcess || [],
            timeline: timeline || [],
        });

        res.status(201).json({
            success: true,
            message: "Company created successfully",
            data: company,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update company profile (Admin only)
// @route   PUT /api/companies/:id
// @access  Private/Admin
const updateCompany = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            res.status(404);
            throw new Error("Company not found");
        }

        const updatedCompany = await Company.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: "Company updated successfully",
            data: updatedCompany,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete company (Admin only)
// @route   DELETE /api/companies/:id
// @access  Private/Admin
const deleteCompany = async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            res.status(404);
            throw new Error("Company not found");
        }

        await company.deleteOne();
        res.status(200).json({
            success: true,
            message: "Company deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Refresh Company Intelligence manually
// @route   POST /api/companies/:slug/refresh-intelligence
// @access  Private
const refreshCompanyIntelligence = async (req, res, next) => {
    try {
        const company = await Company.findOne({ slug: req.params.slug.toLowerCase() });
        if (!company) {
            res.status(404);
            throw new Error("Company not found");
        }

        const { refreshCompany } = require("../services/ai/companyIntelligenceService");
        await refreshCompany(company._id);

        res.status(200).json({
            success: true,
            message: "Company intelligence regeneration triggered successfully in the background."
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Run database consistency repair for orphaned company workspaces
// @route   POST /api/companies/repair
// @access  Private
const repairCompanies = async (req, res, next) => {
    try {
        const dryRun = req.query.dryRun === "true";
        const { repairCompanyConsistency } = require("../services/companyRepairService");
        
        const diagnostics = await repairCompanyConsistency({ dryRun });
        
        res.status(200).json({
            success: true,
            message: dryRun ? "Dry run consistency check completed successfully." : "Company database referential integrity repaired successfully.",
            data: diagnostics
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCompanies,
    getCompanyBySlug,
    createCompany,
    updateCompany,
    deleteCompany,
    refreshCompanyIntelligence,
    repairCompanies,
};
