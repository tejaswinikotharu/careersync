const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
            index: true,
        },
        companyName: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        time: {
            type: String,
            default: "",
        },
        link: {
            type: String,
            default: "",
        },
        type: {
            type: String,
            enum: [
                "Registration",
                "Mock Test",
                "Prep Kit",
                "Training",
                "Online Assessment",
                "Interview",
                "Offer",
                "Deadline",
                "General Notice"
            ],
            required: true,
        },
        rawEmailIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "RawEmail",
            }
        ],
        latestRawEmailId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RawEmail",
        },
        sourceCount: {
            type: Number,
            default: 1,
        },
        statusOverride: {
            type: String,
            enum: ["completed", "current", "upcoming"],
            default: null,
        },
        titleLocked: {
            type: Boolean,
            default: false,
        },
        dateLocked: {
            type: Boolean,
            default: false,
        },
        timeLocked: {
            type: Boolean,
            default: false,
        },
        linkLocked: {
            type: Boolean,
            default: false,
        },
        notesLocked: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Virtual for auto-computed status
EventSchema.virtual("status").get(function () {
    if (this.statusOverride) return this.statusOverride;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(this.date);
    eventDate.setHours(0, 0, 0, 0);

    if (today.getTime() < eventDate.getTime()) {
        return "upcoming";
    } else if (today.getTime() === eventDate.getTime()) {
        return "current";
    } else {
        return "completed";
    }
});

// Configure virtual fields serialization
EventSchema.set("toJSON", { virtuals: true });
EventSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Event", EventSchema);
