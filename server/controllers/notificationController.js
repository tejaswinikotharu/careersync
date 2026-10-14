const Notification = require("../models/Notification");

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
    try {
        const list = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            data: list,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res, next) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            res.status(404);
            throw new Error("Notification not found");
        }

        if (notification.userId.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error("Not authorized");
        }

        notification.isRead = true;
        await notification.save();

        res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: notification,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getNotifications,
    markNotificationRead,
};
