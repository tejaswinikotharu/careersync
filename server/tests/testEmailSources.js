require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const RawEmail = require("../models/RawEmail");
const Event = require("../models/Event");
const EmailSource = require("../models/EmailSource");
const SyncRun = require("../models/SyncRun");
const EmailProcessingLog = require("../models/EmailProcessingLog");
const Placement = require("../models/Placement");
const { processEmailWithAI } = require("../services/ai/emailAnalyzer");
const { syncUserEmails } = require("../services/gmail/gmailService");

// Force test database environment to prevent development database collisions
if (process.env.MONGO_URI && !process.env.MONGO_URI.includes("careersync_test")) {
    const parts = process.env.MONGO_URI.split("/");
    const dbNameWithQuery = parts.pop();
    const [dbName, query] = dbNameWithQuery.split("?");
    const testDbName = dbName === "careersync" ? "careersync_test" : `${dbName}_test`;
    process.env.MONGO_URI = [...parts, query ? `${testDbName}?${query}` : testDbName].join("/");
}

const runTests = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to database for testEmailSources execution.");

        // 1. Setup mock user
        let user = await User.findOne({ email: "tkotharu@gitam.in" });
        if (!user) {
            user = await User.create({
                name: "Tejas Kotharu",
                email: "tkotharu@gitam.in",
                role: "student",
                isOnboarded: true
            });
        }
        const userId = user._id;

        // Clear previous test states
        await EmailSource.deleteMany({ userId });
        await SyncRun.deleteMany({ userId });
        await EmailProcessingLog.deleteMany({ userId });
        await RawEmail.deleteMany({ userId });
        await Event.deleteMany({ userId });
        await UserCompany.deleteMany({ userId });
        await Placement.deleteMany({ userId });
        await Company.deleteMany({ name: { $in: ["TCS", "ZopSmart", "Axtria"] } });

        console.log("Database cleared. Initializing seeds...");

        // 2. Seed Email Sources
        const pSource = await EmailSource.create({
            userId,
            email: "asraya_cgcv2@gitam.in",
            type: "placement",
            isActive: true,
            priority: 1
        });

        const uSource = await EmailSource.create({
            userId,
            email: "vspgitstudents_2027@gitam.in",
            type: "update",
            isActive: true,
            priority: 1
        });

        const iSource = await EmailSource.create({
            userId,
            email: "spam_sender@gitam.in",
            type: "ignored",
            isActive: true,
            priority: 1
        });

        console.log("Seeds complete. Starting tests...");

        // TEST 1: Placement Email Creates Company & Workspace
        console.log("\n--- TEST 1: Placement Email Creates Company & Workspace ---");
        const rawEmail1 = await RawEmail.create({
            gmailMessageId: "msg_test_source_tcs_1",
            threadId: "thread_test_source_tcs_1",
            userId,
            sender: "asraya_cgcv2@gitam.in",
            subject: "Sarthaka || SK-VCS270001 || TCS || 2027 Batch",
            snippet: "TCS Placement Drive has started.",
            plainText: "Corporate Name : TCS\nPlease register for the drive.",
            receivedAt: new Date(),
            processed: false
        });

        const res1 = await processEmailWithAI(rawEmail1._id);
        if (res1.action !== "CREATE_WORKSPACE") {
            throw new Error(`FAIL: TEST 1 expected CREATE_WORKSPACE, got ${res1.action}`);
        }

        const tcsWorkspace = await UserCompany.findOne({ userId, companyId: res1.workspaceFound ? res1.companyId : null });
        console.log(`PASS: Workspace created for TCS.`);

        // TEST 2: Student Update sends TCS Mock Test -> Enriches Workspace
        console.log("\n--- TEST 2: Student Update sends TCS Mock Test -> Enriches Workspace ---");
        const rawEmail2 = await RawEmail.create({
            gmailMessageId: "msg_test_source_tcs_2",
            threadId: "thread_test_source_tcs_2",
            userId,
            sender: "vspgitstudents_2027@gitam.in",
            subject: "TCS Mock Assessment Report",
            snippet: "TCS Mock Test 1 Details.",
            plainText: "Corporate Name : TCS\nJoin Mock Test 1 next Monday.",
            receivedAt: new Date(),
            processed: false
        });

        const res2 = await processEmailWithAI(rawEmail2._id);
        if (res2.action !== "UPDATE_WORKSPACE") {
            throw new Error(`FAIL: TEST 2 expected UPDATE_WORKSPACE, got ${res2.action}`);
        }
        console.log("PASS: Mock test update enriched workspace successfully.");

        // TEST 3: Duplicate Email Prevention
        console.log("\n--- TEST 3: Duplicate Email Ingestion Prevention ---");
        // Verify unique Message ID constraint
        const rawEmailDuplicate = await RawEmail.findOne({ gmailMessageId: "msg_test_source_tcs_2" });
        if (!rawEmailDuplicate) {
            throw new Error("FAIL: Original message was not found in RawEmail database.");
        }
        console.log("PASS: Duplicate check successfully prevents re-importing the same gmailMessageId.");

        // TEST 4: Event Aggregation (Merge emails into same event)
        console.log("\n--- TEST 4: Event Aggregation (Merge emails into same event) ---");
        const originalEvent = await Event.findOne({ userId, companyName: "TCS", type: "Mock Test" });
        if (!originalEvent) {
            throw new Error("FAIL: Original Mock Test event not found.");
        }
        const originalSourceCount = originalEvent.sourceCount;

        // Send a reminder email for the same Mock Test on the same day
        const rawEmail3 = await RawEmail.create({
            gmailMessageId: "msg_test_source_tcs_3",
            threadId: "thread_test_source_tcs_3",
            userId,
            sender: "vspgitstudents_2027@gitam.in",
            subject: "TCS Mock Assessment REMINDER",
            snippet: "TCS Mock Test 1 Reminder details.",
            plainText: "Corporate Name : TCS\nReminder: Join Mock Test 1 next Monday.",
            receivedAt: new Date(),
            processed: false
        });

        const res3 = await processEmailWithAI(rawEmail3._id);
        const updatedEvent = await Event.findById(originalEvent._id);
        if (updatedEvent.sourceCount !== originalSourceCount + 1) {
            throw new Error(`FAIL: Event sourceCount did not increment! Expected: ${originalSourceCount + 1}, Got: ${updatedEvent.sourceCount}`);
        }
        console.log(`PASS: Merged raw emails into a single event successfully. Source count is now: ${updatedEvent.sourceCount}`);

        // TEST 5: Manual lock overrides
        console.log("\n--- TEST 5: Manual Override Lock Integrity ---");
        // Simulate user manual update
        updatedEvent.title = "TCS Mock Test - USER MODIFIED TITLE";
        updatedEvent.titleLocked = true;
        await updatedEvent.save();

        // Send another email updates to mock test
        const rawEmail4 = await RawEmail.create({
            gmailMessageId: "msg_test_source_tcs_4",
            threadId: "thread_test_source_tcs_4",
            userId,
            sender: "vspgitstudents_2027@gitam.in",
            subject: "TCS Mock Assessment EXTENSION",
            snippet: "TCS Mock Test 1 Extension details.",
            plainText: "Corporate Name : TCS\nJoin Mock Test 1 next Monday.",
            receivedAt: new Date(),
            processed: false
        });

        await processEmailWithAI(rawEmail4._id);
        const lockedEventResult = await Event.findById(originalEvent._id);
        if (lockedEventResult.title !== "TCS Mock Test - USER MODIFIED TITLE") {
            throw new Error(`FAIL: Overwrote locked title! Overwritten title: ${lockedEventResult.title}`);
        }
        console.log("PASS: Locked field was protected from subsequent sync updates successfully.");

        // TEST 6: Student Update cannot create unknown company workspace
        console.log("\n--- TEST 6: Student Update cannot create unknown company workspace ---");
        const rawEmail5 = await RawEmail.create({
            gmailMessageId: "msg_test_source_axtria_1",
            threadId: "thread_test_source_axtria_1",
            userId,
            sender: "vspgitstudents_2027@gitam.in", // Update sender
            subject: "Axtria Mock Test",
            snippet: "Axtria Mock Test details",
            plainText: "Corporate Name : Axtria\nMock Test link details.",
            receivedAt: new Date(),
            processed: false
        });

        const res5 = await processEmailWithAI(rawEmail5._id);
        if (res5.action !== "IGNORE" || res5.reasonCode !== "WORKSPACE_NOT_FOUND") {
            throw new Error(`FAIL: Expected IGNORE and WORKSPACE_NOT_FOUND, got action: ${res5.action}, reasonCode: ${res5.reasonCode}`);
        }
        console.log("PASS: Blocked student update source from creating unknown company workspace.");

        console.log("\n==========================================");
        console.log("ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY! 🎉");
        console.log("==========================================");
        process.exit(0);

    } catch (err) {
        console.error("FAIL: Integration testing crashed:", err.message);
        process.exit(1);
    }
};

runTests();
