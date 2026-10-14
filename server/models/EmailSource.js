const mongoose = require("mongoose");

const EmailSourceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        email: {
            type: String,
            required: [true, "Please add an email address"],
            trim: true,
            lowercase: true,
        },
        type: {
            type: String,
            required: true,
            enum: ["placement", "update", "ignored"],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        priority: {
            type: Number,
            default: 1,
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index to ensure email source is unique per user
EmailSourceSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("EmailSource", EmailSourceSchema);
