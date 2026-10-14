const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
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
        name: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ["Resume", "Cover Letter", "Offer Letter", "Hall Ticket", "Certificate", "Notes"],
            required: true,
        },
        fileUrl: {
            type: String,
            required: true,
        },
        fileName: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Document", DocumentSchema);
