const mongoose = require("mongoose");

const SyncRunSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        startedAt: {
            type: Date,
            required: true,
        },
        endedAt: {
            type: Date,
        },
        duration: {
            type: Number, // milliseconds
            default: 0,
        },
        emailsFetched: {
            type: Number,
            default: 0,
        },
        emailsProcessed: {
            type: Number,
            default: 0,
        },
        companiesCreated: {
            type: Number,
            default: 0,
        },
        companiesUpdated: {
            type: Number,
            default: 0,
        },
        studentUpdatesAdded: {
            type: Number,
            default: 0,
        },
        ignoredEmails: {
            type: Number,
            default: 0,
        },
        duplicateEmails: {
            type: Number,
            default: 0,
        },
        syncErrors: {
            type: [String],
            default: [],
        },
        status: {
            type: String,
            enum: ["running", "completed", "completed_with_warnings", "failed"],
            default: "running",
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("SyncRun", SyncRunSchema);
