const mongoose = require("mongoose");

const RawEmailSchema = new mongoose.Schema(
    {
        gmailMessageId: {
            type: String,
            required: true,
            unique: true,
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
        plainText: {
            type: String,
            default: "",
        },
        html: {
            type: String,
            default: "",
        },
        attachments: {
            type: Array,
            default: [],
        },
        receivedAt: {
            type: Date,
            required: true,
        },
        processed: {
            type: Boolean,
            default: false,
        },
        aiAnalysis: {
            type: Object,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("RawEmail", RawEmailSchema);
