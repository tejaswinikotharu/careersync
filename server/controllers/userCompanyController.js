const UserCompany = require("../models/UserCompany");
const Company = require("../models/Company");

// @desc    Get all user tracked companies
// @route   GET /api/user-companies
// @access  Private
const getUserCompanies = async (req, res, next) => {
    try {
        const list = await UserCompany.find({ userId: req.user._id }).populate("companyId");
        res.status(200).json({
            success: true,
            data: list,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get tracking details for a specific company by companyId
// @route   GET /api/user-companies/:companyId
// @access  Private
const getUserCompanyByCompanyId = async (req, res, next) => {
    try {
        const record = await UserCompany.findOne({
            userId: req.user._id,
            companyId: req.params.companyId,
        }).populate("companyId");

        if (!record) {
            res.status(404);
            throw new Error("No tracking record found for this company");
        }

        res.status(200).json({
            success: true,
            data: record,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Start tracking a company
// @route   POST /api/user-companies
// @access  Private
const createUserCompany = async (req, res, next) => {
    try {
        const { companyId, companyName, status, notes, currentRound, progress } = req.body;

        let targetCompanyId = companyId;
        
        // Manual creation: auto-resolve or create minimal Company document by name
        if (!targetCompanyId && companyName) {
            const cleanName = companyName.trim();
            let comp = await Company.findOne({ 
                name: { $regex: new RegExp(`^${cleanName}$`, "i") } 
            });
            
            if (!comp) {
                const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                comp = await Company.create({
                    name: cleanName,
                    slug,
                    package: "N/A",
                    eligibility: "N/A",
                    overview: "Manually added tracking workspace.",
                    headquarters: "Unknown",
                    type: "Product",
                });
                console.log(`Auto-created minimal Company for manual tracker: "${cleanName}"`);
            }
            
            targetCompanyId = comp._id;
        }

        if (!targetCompanyId) {
            res.status(400);
            throw new Error("Please specify a company name or ID");
        }

        // Check if record already exists
        const recordExists = await UserCompany.findOne({
            userId: req.user._id,
            companyId: targetCompanyId,
        }).populate("companyId");

        if (recordExists) {
            return res.status(200).json({
                success: true,
                message: "Already tracking this company",
                data: recordExists,
            });
        }

        let userCompany;
        try {
            userCompany = await UserCompany.create({
                userId: req.user._id,
                companyId: targetCompanyId,
                status: status || "Pending",
                notes: notes || "",
                currentRound: currentRound || "",
                progress: progress || 0,
            });
        } catch (createErr) {
            if (createErr.code === 11000) {
                const record = await UserCompany.findOne({
                    userId: req.user._id,
                    companyId: targetCompanyId,
                }).populate("companyId");
                return res.status(200).json({
                    success: true,
                    message: "Already tracking this company",
                    data: record,
                });
            }
            throw createErr;
        }

        res.status(201).json({
            success: true,
            message: "Company tracking started successfully",
            data: userCompany,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user-specific company progress tracking record
// @route   PUT /api/user-companies/:id
// @access  Private
const updateUserCompany = async (req, res, next) => {
    try {
        const record = await UserCompany.findById(req.params.id);
        if (!record) {
            res.status(404);
            throw new Error("Tracking record not found");
        }

        // Check ownership
        if (record.userId.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error("Not authorized to modify this record");
        }

        // Check for event-driven checklist toggles in body and save to Event collection
        const Event = require("../models/Event");
        const checklistKeys = ["mockTests", "prepKits", "trainingSessions", "assessments", "interviews"];
        for (const key of checklistKeys) {
            if (req.body[key] && Array.isArray(req.body[key])) {
                for (const item of req.body[key]) {
                    if (item._id) {
                        const event = await Event.findOne({ _id: item._id, userId: req.user._id });
                        if (event) {
                            event.statusOverride = item.completed ? "completed" : "upcoming";
                            await event.save();
                            console.log(`Updated event "${event.title}" statusOverride to: ${event.statusOverride}`);
                        }
                    }
                }
                delete req.body[key]; // Strip field before UserCompany update
            }
        }

        const updated = await UserCompany.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // Fetch first-class events from database for this company
        const mockTests = await Event.find({ userId: req.user._id, companyId: updated.companyId, type: "Mock Test" });
        const prepKits = await Event.find({ userId: req.user._id, companyId: updated.companyId, type: "Prep Kit" });
        const trainingSessions = await Event.find({ userId: req.user._id, companyId: updated.companyId, type: "Training" });
        const assessments = await Event.find({ userId: req.user._id, companyId: updated.companyId, type: { $in: ["Online Assessment", "Deadline"] } });
        const interviews = await Event.find({ userId: req.user._id, companyId: updated.companyId, type: "Interview" });
        const resources = await Event.find({ userId: req.user._id, companyId: updated.companyId, link: { $ne: "" } });

        const updatedObj = updated.toObject();
        updatedObj.mockTests = mockTests.map(e => ({
            _id: e._id,
            name: e.title,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));
        updatedObj.prepKits = prepKits.map(e => ({
            _id: e._id,
            name: e.title,
            link: e.link,
            completed: e.status === "completed"
        }));
        updatedObj.trainingSessions = trainingSessions.map(e => ({
            _id: e._id,
            topic: e.title,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));
        updatedObj.assessments = assessments.map(e => ({
            _id: e._id,
            type: e.type,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));
        updatedObj.interviews = interviews.map(e => ({
            _id: e._id,
            round: e.title,
            date: e.date,
            time: e.time,
            link: e.link,
            completed: e.status === "completed"
        }));
        updatedObj.resources = resources.map(e => ({
            _id: e._id,
            name: e.title,
            link: e.link,
            type: e.type === "Prep Kit" ? "Prep Kit" : e.type === "Training" ? "Training" : "Official Link"
        }));

        res.status(200).json({
            success: true,
            message: "Tracking record updated successfully",
            data: updatedObj,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove company tracking record
// @route   DELETE /api/user-companies/:id
// @access  Private
const deleteUserCompany = async (req, res, next) => {
    try {
        const record = await UserCompany.findById(req.params.id);
        if (!record) {
            res.status(404);
            throw new Error("Tracking record not found");
        }

        // Check ownership
        if (record.userId.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error("Not authorized to delete this record");
        }

        await record.deleteOne();
        res.status(200).json({
            success: true,
            message: "Tracking record deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUserCompanies,
    getUserCompanyByCompanyId,
    createUserCompany,
    updateUserCompany,
    deleteUserCompany,
};
