require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const RawEmail = require("../models/RawEmail");
const Placement = require("../models/Placement");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const Event = require("../models/Event");
const Notification = require("../models/Notification");
const { processEmailWithAI } = require("../services/ai/emailAnalyzer");

const triggerSyncTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for End-to-End Sync Test.");

        // Clear any old mock ZopSmart placement data to ensure a fresh test
        await RawEmail.deleteMany({ gmailMessageId: "msg_zopsmart_123" });
        await Placement.deleteMany({ company: "ZopSmart" });
        await Company.deleteMany({ name: "ZopSmart" });
        
        // Find a user from the DB
        const user = await User.findOne({});
        if (!user) {
            console.error("No user found in DB to run E2E sync test.");
            process.exit(1);
        }

        console.log(`Running test under User: ${user.email} (${user._id})`);

        // Ensure whitelisted sender list includes Gitam coordinator
        if (!user.trustedSenders.includes("asraya_cgcv2@gitam.in")) {
            user.trustedSenders.push("asraya_cgcv2@gitam.in");
            await user.save();
            console.log("Added Gitam sender to user's whitelisted trustedSenders.");
        }

        // Store a simulated Raw Email
        const rawEmail = await RawEmail.create({
            gmailMessageId: "msg_zopsmart_123",
            threadId: "thread_zopsmart_123",
            userId: user._id,
            sender: "asraya_cgcv2@gitam.in",
            subject: "Sarthaka IISK-VCS270002 || ZopSmart || 2027 Batch || Deadline 22-Jun",
            snippet: "ZopSmart coding test registration deadline 22-Jun",
            plainText: `Dear Student,

We are pleased to announce the campus recruitment drive of ZopSmart for the 2027 batch.
Position: Software Engineer
Eligibility: 7.5 CGPA and above (CS/IT branch only)
Package: 12 LPA
Work Location: Bangalore
Test Date: 14-Jul-2026

Please apply at the link below before the deadline 22-Jun:
https://careers.zopsmart.com/jobs/apply

Regards,
Placement Coordinator`,
            html: "",
            attachments: [],
            receivedAt: new Date(),
            processed: false,
        });

        console.log(`Stored RawEmail successfully. ID: ${rawEmail._id}`);

        // Trigger parser and AI processing pipeline
        console.log("Executing processEmailWithAI parsing and AI summary engine...");
        await processEmailWithAI(rawEmail._id);

        console.log("\n==========================================");
        console.log("E2E PIPELINE RUN SUCCESSFUL!");
        console.log("==========================================");

        // Fetch and print stored placement record
        const placement = await Placement.findOne({ rawEmailId: rawEmail._id });
        if (placement) {
            console.log("Stored Placement Document:");
            console.log(JSON.stringify({
                company: placement.company,
                role: placement.role,
                event: placement.event,
                deadline: placement.deadline,
                testDate: placement.testDate,
                package: placement.package,
                registrationLink: placement.registrationLink,
                summary: placement.summary,
                prepTips: placement.prepTips,
                importantInstructions: placement.importantInstructions,
                confidence: placement.confidence,
                reason: placement.reason
            }, null, 2));
        } else {
            console.error("Placement document was not stored!");
        }

        // Fetch and print tracking company
        const trackedCompany = await UserCompany.findOne({ userId: user._id }).populate("companyId");
        if (trackedCompany && trackedCompany.companyId) {
            console.log("\nCreated tracked workspace details:");
            console.log(JSON.stringify({
                companyName: trackedCompany.companyId.name,
                status: trackedCompany.status,
                currentRound: trackedCompany.currentRound,
                progress: trackedCompany.progress,
            }, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error("E2E test failed:", err.message);
        process.exit(1);
    }
};

triggerSyncTest();
