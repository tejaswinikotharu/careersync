const mongoose = require("mongoose");

const EmailProcessingLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        syncRunId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SyncRun",
        },
        sender: {
            type: String,
            required: true,
        },
        subject: {
            type: String,
            required: true,
        },
        companyDetected: {
            type: String,
            default: "Unknown",
        },
        category: {
            type: String,
            enum: ["Placement", "Student Update", "Unknown"],
            default: "Unknown",
        },
        workspaceFound: {
            type: Boolean,
            default: false,
        },
        action: {
            type: String,
            enum: ["CREATE_WORKSPACE", "UPDATE_WORKSPACE", "IGNORE", "SKIP_DUPLICATE", "ERROR"],
            required: true,
        },
        reasonCode: {
            type: String,
            enum: [
                "WORKSPACE_NOT_FOUND",
                "DUPLICATE_EMAIL",
                "INVALID_COMPANY",
                "INVALID_SENDER",
                "IGNORED_SOURCE",
                "PARSER_FAILED",
                "COMPANY_CREATED",
                "WORKSPACE_UPDATED"
            ],
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
        processedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("EmailProcessingLog", EmailProcessingLogSchema);
