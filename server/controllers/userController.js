const User = require("../models/User");

// @desc    Get logged in user profile details
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select("-password");
        if (!user) {
            res.status(404);
            throw new Error("User not found");
        }
        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user profile data
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404);
            throw new Error("User not found");
        }

        // Allowed fields to update
        const fieldsToUpdate = [
            "name",
            "branch",
            "cgpa",
            "graduationYear",
            "skills",
            "preferredRoles",
            "preferredLocations",
            "preferredPackage",
            "linkedin",
            "github",
            "portfolio",
            "resumeUrl",
            "isOnboarded",
            "trustedSenders"
        ];

        fieldsToUpdate.forEach((field) => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });

        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                branch: user.branch,
                cgpa: user.cgpa,
                graduationYear: user.graduationYear,
                skills: user.skills,
                preferredRoles: user.preferredRoles,
                preferredLocations: user.preferredLocations,
                preferredPackage: user.preferredPackage,
                linkedin: user.linkedin,
                github: user.github,
                portfolio: user.portfolio,
                resumeUrl: user.resumeUrl,
                isOnboarded: user.isOnboarded,
                profilePicture: user.profilePicture,
                trustedSenders: user.trustedSenders
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user account completely (Security Feature)
// @route   DELETE /api/users/profile
// @access  Private
const deleteUserAccount = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404);
            throw new Error("User not found");
        }

        // Also delete associated tracking records and emails
        const UserCompany = require("../models/UserCompany");
        const Email = require("../models/Email");
        const Notification = require("../models/Notification");
        const Event = require("../models/Event");
        const Document = require("../models/Document");

        await UserCompany.deleteMany({ userId: user._id });
        await Email.deleteMany({ userId: user._id });
        await Notification.deleteMany({ userId: user._id });
        await Event.deleteMany({ userId: user._id });
        await Document.deleteMany({ userId: user._id });
        
        await user.deleteOne();

        res.status(200).json({
            success: true,
            message: "User account and all associated metrics deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUserProfile,
    updateUserProfile,
    deleteUserAccount,
};
