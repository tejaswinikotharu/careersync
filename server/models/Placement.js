const mongoose = require("mongoose");

const PlacementSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        company: {
            type: String,
            default: "Unknown",
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            default: null,
            index: true,
        },
        role: {
            type: String,
            default: "Unknown",
        },
        event: {
            type: String,
            default: "General Update",
        },
        batch: {
            type: String,
            default: "Unknown",
        },
        deadline: {
            type: Date,
            default: null,
        },
        testDate: {
            type: Date,
            default: null,
        },
        interviewDate: {
            type: Date,
            default: null,
        },
        cgpa: {
            type: String,
            default: "N/A",
        },
        package: {
            type: String,
            default: "N/A",
        },
        location: {
            type: String,
            default: "Unknown",
        },
        registrationLink: {
            type: String,
            default: null,
        },
        summary: {
            type: String,
            default: "",
        },
        prepTips: {
            type: String,
            default: "",
        },
        confidence: {
            type: Number,
            default: 0,
        },
        reason: {
            type: String,
            default: "Unknown",
        },
        date: {
            type: Date,
            default: null,
        },
        time: {
            type: String,
            default: "",
        },
        link: {
            type: String,
            default: "",
        },
        instructions: {
            type: [String],
            default: [],
        },
        jobId: {
            type: String,
            default: "",
        },
        rawEmailId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RawEmail",
            required: true,
            index: true,
        },
        importantInstructions: {
            type: [String],
            default: [],
        },
        requiredDocuments: {
            type: [String],
            default: [],
        },
        mockTests: {
            type: Array,
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Placement", PlacementSchema);
