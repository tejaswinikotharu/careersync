const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please add a name"],
        },
        email: {
            type: String,
            required: [true, "Please add an email"],
            unique: true,
            trim: true,
            lowercase: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                "Please add a valid email",
            ],
        },
        password: {
            type: String,
            // Password is optional for users authenticating via Google OAuth
        },
        role: {
            type: String,
            enum: ["student", "admin"],
            default: "student",
        },
        profilePicture: {
            type: String,
            default: "",
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        googleTokens: {
            access_token: String,
            refresh_token: String,
            expiry_date: Number,
            lastRefreshSuccess: Date,
            refreshCount: { type: Number, default: 0 },
            lastAuthError: String,
            consecutiveAuthFailures: { type: Number, default: 0 },
            isSyncRunning: { type: Boolean, default: false },
            lastSuccessfulSync: Date,
            initialSyncCompleted: { type: Boolean, default: false },
            lastHistoryId: String
        },
        branch: {
            type: String,
            default: "",
        },
        cgpa: {
            type: Number,
            default: 0,
        },
        graduationYear: {
            type: Number,
            default: 0,
        },
        skills: {
            type: [String],
            default: [],
        },
        preferredRoles: {
            type: [String],
            default: [],
        },
        preferredLocations: {
            type: [String],
            default: [],
        },
        preferredPackage: {
            type: String,
            default: "",
        },
        linkedin: {
            type: String,
            default: "",
        },
        github: {
            type: String,
            default: "",
        },
        portfolio: {
            type: String,
            default: "",
        },
        resumeUrl: {
            type: String,
            default: "",
        },
        isOnboarded: {
            type: Boolean,
            default: false,
        },
        trustedSenders: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true,
    }
);

// Hash password before saving to database (if password is provided and modified)
UserSchema.pre("save", async function (next) {
    if (!this.password || !this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password input to database hashed password
UserSchema.methods.comparePassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
