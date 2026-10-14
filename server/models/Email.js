const mongoose = require("mongoose");

const AttachmentSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true,
    },
    mimeType: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
    },
    attachmentId: {
        type: String,
        required: true,
    },
});

const EmailSchema = new mongoose.Schema(
    {
        gmailMessageId: {
            type: String,
            required: true,
            unique: true, // Prevent duplicate insertions
            index: true,
        },
        threadId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        company: {
            type: String,
            default: "General",
        },
        sender: {
            type: String,
            required: true,
        },
        subject: {
            type: String,
            default: "",
        },
        snippet: {
            type: String,
            default: "",
        },
        body: {
            type: String,
            default: "", // Stores text and/or html body
        },
        receivedAt: {
            type: Date,
            required: true,
        },
        labels: {
            type: [String],
            default: [],
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        hasAttachments: {
            type: Boolean,
            default: false,
        },
        attachments: {
            type: [AttachmentSchema],
            default: [],
        },
        aiProcessed: {
            type: Boolean,
            default: false,
        },
        confidence: {
            type: Number,
            default: 0.0,
        },
        reviewNeeded: {
            type: Boolean,
            default: false,
        },
        category: {
            type: String,
            default: "General Update",
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High"],
            default: "Medium",
        },
        summary: {
            type: String,
            default: "",
        },
        deadline: {
            type: Date,
        },
        actionItems: {
            type: [String],
            default: [],
        },
        jobRole: {
            type: String,
            default: null,
        },
        package: {
            type: String,
            default: null,
        },
        eligibility: {
            type: String,
            default: null,
        },
        applyLink: {
            type: String,
            default: null,
        },
        registrationDeadline: {
            type: Date,
            default: null,
        },
        codingTestDate: {
            type: Date,
            default: null,
        },
        assessmentDate: {
            type: Date,
            default: null,
        },
        mockTestDates: {
            type: [Date],
            default: [],
        },
        interviewDates: {
            type: [Date],
            default: [],
        },
        offerInformation: {
            type: String,
            default: null,
        },
        requiredDocuments: {
            type: [String],
            default: [],
        },
        importantInstructions: {
            type: [String],
            default: [],
        },
        meetingLinks: {
            type: [String],
            default: [],
        },
        venue: {
            type: String,
            default: null,
        },
        attachmentsMentioned: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Email", EmailSchema);
