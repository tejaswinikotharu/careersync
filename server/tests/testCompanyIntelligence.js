require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const RawEmail = require("../models/RawEmail");
const User = require("../models/User");
const EmailSource = require("../models/EmailSource");
const Placement = require("../models/Placement");
const Event = require("../models/Event");
const StudentUpdate = require("../models/StudentUpdate");
const { processEmailWithAI } = require("../services/ai/emailAnalyzer");
const { enrichCompany, refreshCompany, generateCompanyIntelligence } = require("../services/ai/companyIntelligenceService");

// Force test database environment to prevent development database collisions
if (process.env.MONGO_URI && !process.env.MONGO_URI.includes("careersync_test")) {
    const parts = process.env.MONGO_URI.split("/");
    const dbNameWithQuery = parts.pop();
    const [dbName, query] = dbNameWithQuery.split("?");
    const testDbName = dbName === "careersync" ? "careersync_test" : `${dbName}_test`;
    process.env.MONGO_URI = [...parts, query ? `${testDbName}?${query}` : testDbName].join("/");
}

const runTest = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        console.log("Cleaning database for validation run...");
        await Company.deleteMany({ name: { $in: ["TCS", "ZopSmart", "Axtria"] } });
        await UserCompany.deleteMany({ userId: "6a4fb6bb270918758ae20389" });
        await RawEmail.deleteMany({ userId: "6a4fb6bb270918758ae20389" });
        await Placement.deleteMany({ company: { $in: ["TCS", "ZopSmart", "Axtria"] } });
        await Event.deleteMany({ companyName: { $in: ["TCS", "ZopSmart", "Axtria"] } });
        await StudentUpdate.deleteMany({ userId: "6a4fb6bb270918758ae20389" });

        // Ensure user exists
        let user = await User.findById("6a4fb6bb270918758ae20389");
        if (!user) {
            user = await User.create({
                _id: new mongoose.Types.ObjectId("6a4fb6bb270918758ae20389"),
                name: "Tejas Kotharu",
                email: "tkotharu@gitam.in",
                googleTokens: {
                    access_token: "mock_access",
                    refresh_token: "mock_refresh",
                    expiry_date: Date.now() + 3600000
                }
            });
        }

        // Ensure email source exists
        let source = await EmailSource.findOne({ userId: user._id, email: "asraya_cgcv2@gitam.in" });
        if (!source) {
            await EmailSource.create({
                userId: user._id,
                email: "asraya_cgcv2@gitam.in",
                type: "placement",
                isActive: true
            });
        }

        console.log("Seeding placement email to trigger workspace creation...");
        const rawEmail = await RawEmail.create({
            gmailMessageId: "msg_tcs_verification_1",
            threadId: "thread_tcs_verification_1",
            userId: user._id,
            sender: "asraya_cgcv2@gitam.in",
            subject: "TCS Campus Hiring Drive Announcement",
            snippet: "Important update regarding TCS registrations.",
            plainText: "Tata Consultancy Services (TCS) is hiring. Please fill registration links.",
            receivedAt: new Date(),
            processed: false
        });

        console.log("Executing E2E processEmailWithAI parsing...");
        const result = await processEmailWithAI(rawEmail._id);
        console.log("Email parser completed action:", result.action);

        console.log("Querying company record from MongoDB...");
        let company = await Company.findOne({ name: "TCS" });
        if (!company) {
            throw new Error("❌ FAILURE: Global Company 'TCS' was not created!");
        }

        console.log("Triggering intelligence refresh now that Placement record is stored...");
        await refreshCompany(company._id);

        console.log("Waiting for background async intelligence job queue worker to complete (4 seconds)...");
        await new Promise(r => setTimeout(r, 4000));

        // Reload fresh company
        company = await Company.findOne({ name: "TCS" });

        console.log("Verifying Company Intelligence (Layer 1)...");
        console.log(`  - Status: ${company.aiProfile.status}`);
        console.log(`  - Summary: ${company.aiProfile.summary}`);
        console.log(`  - Fingerprint: ${company.aiProfile.fingerprint}`);
        console.log(`  - Prompt Version: ${company.aiProfile.promptVersion}`);
        console.log(`  - Validator Version: ${company.aiProfile.validatorVersion}`);
        console.log(`  - Validation Version: ${company.aiProfile.validationVersion}`);

        if (company.aiProfile.status !== "completed") {
            throw new Error(`❌ FAILURE: aiProfile status is "${company.aiProfile.status}", expected "completed"!`);
        }
        if (!company.aiProfile.fingerprint) {
            throw new Error("❌ FAILURE: aiProfile.fingerprint is empty!");
        }
        if (company.aiProfile.promptVersion !== "CompanyProfilePrompt_v5") {
            throw new Error(`❌ FAILURE: Expected promptVersion "CompanyProfilePrompt_v5", got "${company.aiProfile.promptVersion}"`);
        }

        console.log("Verifying Generation Duration & Metadata...");
        const meta = company.aiProfile.generationMetadata;
        console.log(`  - Provider: ${meta.provider}`);
        console.log(`  - Model: ${meta.model}`);
        console.log(`  - Retries: ${meta.retries}`);
        console.log(`  - Generation duration: ${meta.generationDurationMs}ms`);
        console.log(`  - Validation duration: ${meta.validationDurationMs}ms`);
        console.log(`  - Persist duration: ${meta.persistDurationMs}ms`);

        if (!meta.provider || !meta.model) {
            throw new Error("❌ FAILURE: provider/model metadata fields are missing!");
        }
        if (meta.persistDurationMs <= 0) {
            throw new Error("❌ FAILURE: persistDurationMs was not tracked!");
        }

        console.log("Testing Revision History...");
        // Modify some data in Company and save to trigger a change on next refresh
        company.aiProfile.summary = "A different summary content to trigger revision change list.";
        await company.save();

        console.log("Triggering second refresh to inspect aiProfileHistory snapshots...");
        await refreshCompany(company._id);
        
        console.log("Waiting for second background async task to finish (4 seconds)...");
        await new Promise(r => setTimeout(r, 4000));

        const updatedCompany = await Company.findOne({ name: "TCS" });
        console.log(`  - Revisions in History: ${updatedCompany.aiProfileHistory.length}`);
        
        if (updatedCompany.aiProfileHistory.length !== 1) {
            throw new Error(`❌ FAILURE: Expected exactly 1 revision in history, got ${updatedCompany.aiProfileHistory.length}`);
        }

        const revision = updatedCompany.aiProfileHistory[0];
        console.log(`  - Revision 1 summary: ${revision.summary}`);
        console.log(`  - Changed fields detected: ${revision.changedFields.join(", ")}`);

        if (!revision.changedFields.includes("summary")) {
            throw new Error("❌ FAILURE: Changed fields didn't detect changes in 'summary'!");
        }

        console.log("Testing Cache TTL constraints...");
        // enrichCompany should bypass calling LLM/queue if within 30 days
        const lastUpdatedBefore = updatedCompany.aiProfile.lastUpdated;
        await enrichCompany(updatedCompany._id);
        
        // Wait a bit and reload
        await new Promise(r => setTimeout(r, 500));
        const finalCompany = await Company.findOne({ name: "TCS" });
        
        if (finalCompany.aiProfile.lastUpdated.getTime() !== lastUpdatedBefore.getTime()) {
            throw new Error("❌ FAILURE: Cache TTL did not prevent regeneration within 30 days!");
        }
        console.log("  - Cache TTL constraint verified. Last updated timestamp matched exactly.");

        console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY! Canonical Three-Layer Pipeline with revisions & validations validated.");
        process.exit(0);
    } catch (err) {
        console.error("\n❌ TEST COMPILATION ERROR:");
        console.error(err.stack || err);
        process.exit(1);
    }
};

runTest();
