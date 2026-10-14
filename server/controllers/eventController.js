const Event = require("../models/Event");

// @desc    Get user calendar events
// @route   GET /api/events
// @access  Private
const getEvents = async (req, res, next) => {
    try {
        const eventsList = await Event.find({ userId: req.user._id }).sort({ date: 1 });
        
        res.status(200).json({
            success: true,
            data: eventsList,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create manual calendar event
// @route   POST /api/events
// @access  Private
const createEvent = async (req, res, next) => {
    try {
        const { companyName, title, date, type, companyId } = req.body;

        if (!companyName || !title || !date || !type) {
            res.status(400);
            throw new Error("Please provide companyName, title, date, and type");
        }

        const newEvent = await Event.create({
            userId: req.user._id,
            companyId: companyId || null,
            companyName,
            title,
            date,
            type,
        });

        // Emit real-time update
        const { sendRealTimeUpdate } = require("../config/socket");
        sendRealTimeUpdate(req.user._id, "event_created", newEvent);

        res.status(201).json({
            success: true,
            message: "Calendar event scheduled successfully",
            data: newEvent,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update calendar event
// @route   PUT /api/events/:id
// @access  Private
const updateEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            res.status(404);
            throw new Error("Calendar event not found");
        }

        // Verify ownership
        if (event.userId.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error("Not authorized");
        }

        if (req.body.title) req.body.titleLocked = true;
        if (req.body.date) req.body.dateLocked = true;
        if (req.body.time) req.body.timeLocked = true;
        if (req.body.link) req.body.linkLocked = true;

        const updatedEvent = await Event.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // Emit real-time update
        const { sendRealTimeUpdate } = require("../config/socket");
        sendRealTimeUpdate(req.user._id, "event_created", updatedEvent);

        res.status(200).json({
            success: true,
            message: "Calendar event updated successfully",
            data: updatedEvent,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete calendar event
// @route   DELETE /api/events/:id
// @access  Private
const deleteEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            res.status(404);
            throw new Error("Calendar event not found");
        }

        // Verify ownership
        if (event.userId.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error("Not authorized");
        }

        await event.deleteOne();

        // Emit real-time update
        const { sendRealTimeUpdate } = require("../config/socket");
        sendRealTimeUpdate(req.user._id, "event_created", { _id: req.params.id, deleted: true });

        res.status(200).json({
            success: true,
            message: "Calendar event deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
};
