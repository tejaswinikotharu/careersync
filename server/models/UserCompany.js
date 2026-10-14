const mongoose = require("mongoose");

const UserCompanySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true,
        },
        canonicalCompanyName: {
            type: String,
        },
        status: {
            type: String,
            enum: ["Applied", "Active", "Completed", "Rejected", "Offer Received", "Pending"],
            default: "Pending",
            index: true,
        },
        notes: {
            type: String,
            default: "",
        },
        currentRound: {
            type: String,
            default: "",
        },
        progress: {
            type: Number,
            default: 0, // percentage 0 to 100
        },
        // Recruitment-specific info (separate from stable company profile)
        jobId: {
            type: String,
            default: "",
        },
        jobRole: {
            type: String,
            default: "",
        },
        jobType: {
            type: String,
            default: "",
        },
        departments: {
            type: [String],
            default: [],
        },
        specializations: {
            type: [String],
            default: [],
        },
        package: {
            type: String,
            default: "N/A",
        },
        eligibility: {
            type: String,
            default: "N/A",
        },
        location: {
            type: String,
            default: "Unknown",
        },
        registrationLinks: {
            type: [String],
            default: [],
        },
        deadline: {
            type: Date,
            default: null,
        },
        requiredDocuments: [
            {
                name: { type: String, required: true },
                completed: { type: Boolean, default: false },
            }
        ],
        importantInstructions: {
            type: [String],
            default: [],
        },
        aiAnalysis: {
            summary: { type: String, default: "" },
            upcomingSteps: { type: [String], default: [] },
            prepStrategy: { type: String, default: "" },
            codingTopics: { type: [String], default: [] },
            interviewTopics: { type: [String], default: [] },
            importantInstructions: { type: [String], default: [] },
            checklist: { type: [String], default: [] },
            faqs: [
                {
                    question: { type: String },
                    answer: { type: String }
                }
            ],
        },
    },
    {
        timestamps: true,
    }
);

// Define compound unique index to ensure user can only track a company once
UserCompanySchema.index({ userId: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("UserCompany", UserCompanySchema);
