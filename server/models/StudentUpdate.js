const mongoose = require("mongoose");

const StudentUpdateSchema = new mongoose.Schema(
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
        category: {
            type: String,
            default: "Student Update",
        },
        sourceType: {
            type: String,
            default: "update",
        },
        eventType: {
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
        summary: {
            type: String,
            default: "",
        },
        rawEmailId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RawEmail",
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("StudentUpdate", StudentUpdateSchema);
