const StudentUpdate = require("../models/StudentUpdate");

// @desc    Get all student updates for logged-in user
// @route   GET /api/student-updates
// @access  Private
const getStudentUpdates = async (req, res, next) => {
    try {
        const list = await StudentUpdate.find({ userId: req.user._id })
            .populate("rawEmailId")
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            data: list,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getStudentUpdates,
};
