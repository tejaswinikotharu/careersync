const mongoose = require("mongoose");

const TimelineItemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    date: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["completed", "current", "upcoming"],
        default: "upcoming",
    },
});

const CompanySchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        name: {
            type: String,
            required: [true, "Please add a company name"],
            trim: true,
        },
        package: {
            type: String,
            default: "N/A",
        },
        eligibility: {
            type: String,
            default: "N/A",
        },
        website: {
            type: String,
            trim: true,
            default: "",
        },
        overview: {
            type: String,
            default: "Company workspace.",
        },
        headquarters: {
            type: String,
            default: "Unknown",
        },
        recruitmentProcess: {
            type: [String],
            default: [],
        },
        timeline: {
            type: [TimelineItemSchema],
            default: [],
        },
        type: {
            type: String,
            enum: ["Product", "Service", "Startup"],
            default: "Product",
        },
        isRemote: {
            type: Boolean,
            default: false,
        },
        hiringStatus: {
            type: String,
            enum: ["Hiring", "Closed", "Scheduled"],
            default: "Hiring",
        },
        roles: {
            type: [String],
            default: [],
        },
        location: {
            type: String,
            default: "Bangalore",
        },
        aiProfile: {
            summary: { type: String, default: "" },
            shortDescription: { type: String, default: "" },
            pros: { type: [String], default: [] },
            cons: { type: [String], default: [] },
            workCulture: { type: String, default: "" },
            hiringFocus: { type: String, default: "" },
            technologies: { type: [String], default: [] },
            officialWebsite: { type: String, default: "" },
            careersPage: { type: String, default: "" },
            linkedin: { type: String, default: "" },
            companySize: { type: String, default: "" },
            industry: { type: String, default: "" },
            headquarters: { type: String, default: "" },
            sources: [{
                title: { type: String },
                url: { type: String }
            }],
            status: { 
                type: String, 
                enum: ["pending", "building", "completed", "failed"], 
                default: "pending" 
            },
            confidence: { type: Number, default: 0.95 },
            generatedAt: { type: Date },
            lastUpdated: { type: Date },
            generatedBy: { type: String, default: "Gemini 2.5 + Deterministic Directory" },
            fingerprint: { type: String, default: "" },
            promptVersion: { type: String, default: "" },
            validatorVersion: { type: String, default: "" },
            validationVersion: { type: String, default: "" },
            generationMetadata: {
                provider: { type: String, default: "" },
                model: { type: String, default: "" },
                retries: { type: Number, default: 0 },
                generationDurationMs: { type: Number, default: 0 },
                validationDurationMs: { type: Number, default: 0 },
                persistDurationMs: { type: Number, default: 0 }
            }
        },
        aiProfileHistory: [
            {
                summary: { type: String, default: "" },
                shortDescription: { type: String, default: "" },
                pros: { type: [String], default: [] },
                cons: { type: [String], default: [] },
                workCulture: { type: String, default: "" },
                hiringFocus: { type: String, default: "" },
                technologies: { type: [String], default: [] },
                generatedAt: { type: Date, default: Date.now },
                fingerprint: { type: String, default: "" },
                provider: { type: String, default: "" },
                promptVersion: { type: String, default: "" },
                validatorVersion: { type: String, default: "" },
                confidence: { type: Number, default: 0.0 },
                changedFields: { type: [String], default: [] }
            }
        ],
        placementProfiles: {
            type: [
                new mongoose.Schema({
                    versionId: {
                        batch: { type: String, default: "Unknown" },
                        season: { type: String, default: "Campus Hiring" },
                        year: { type: Number, default: () => new Date().getFullYear() }
                    },
                    recruitmentPattern: {
                        value: { type: String, default: "" },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    aptitudeFocus: {
                        value: { type: [String], default: [] },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    codingFocus: {
                        value: { type: [String], default: [] },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    interviewFocus: {
                        value: { type: [String], default: [] },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    preparationStrategy: {
                        value: { type: [String], default: [] },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    commonMistakes: {
                        value: { type: [String], default: [] },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    estimatedSelectionDifficulty: {
                        value: { type: String, default: "" },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    estimatedRounds: {
                        value: { type: [String], default: [] },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    recommendedResources: {
                        value: { type: [String], default: [] },
                        confidence: { type: Number, default: 0.0 },
                        source: { type: String, enum: ["Historical Emails", "Official Resources", "AI Generalization"], default: "AI Generalization" },
                        evidenceCount: { type: Number, default: 0 },
                        firstObserved: { type: Date },
                        lastObserved: { type: Date },
                        evidenceEmails: [{ type: mongoose.Schema.Types.ObjectId, ref: "RawEmail" }]
                    },
                    status: { 
                        type: String, 
                        enum: ["pending", "building", "completed", "failed", "stale"], 
                        default: "pending" 
                    },
                    generatedAt: { type: Date, default: Date.now },
                    lastUpdated: { type: Date, default: Date.now },
                    lastEvidenceDate: { type: Date },
                    generatedBy: { type: String, default: "Gemini 2.5 + Historical Recruitment Patterns" }
                }, { _id: false })
            ],
            default: []
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

CompanySchema.virtual("currentPlacementProfile").get(function() {
    if (!this.placementProfiles || this.placementProfiles.length === 0) {
        return null;
    }
    return this.placementProfiles[this.placementProfiles.length - 1];
});

module.exports = mongoose.model("Company", CompanySchema);
