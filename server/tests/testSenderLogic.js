require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const RawEmail = require("../models/RawEmail");
const Placement = require("../models/Placement");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const { processEmailWithAI } = require("../services/ai/emailAnalyzer");

// Force test database environment to prevent development database collisions
if (process.env.MONGO_URI && !process.env.MONGO_URI.includes("careersync_test")) {
    const parts = process.env.MONGO_URI.split("/");
    const dbNameWithQuery = parts.pop();
    const [dbName, query] = dbNameWithQuery.split("?");
    const testDbName = dbName === "careersync" ? "careersync_test" : `${dbName}_test`;
    process.env.MONGO_URI = [...parts, query ? `${testDbName}?${query}` : testDbName].join("/");
}

const runSenderLogicTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB for Sender Logic Test.");

        // Clear ZopSmart, TCS, Google
        await Company.deleteMany({ name: { $in: ["TCS", "Google", "ZopSmart"] } });
        await UserCompany.deleteMany({});
        await Placement.deleteMany({});
        await RawEmail.deleteMany({});

        const user = await User.findOne({});
        if (!user) {
            console.error("No user found in database. Seed user first.");
            process.exit(1);
        }

        console.log(`Running test as user: ${user.email}`);

        // Seed test email sources
        const EmailSource = require("../models/EmailSource");
        await EmailSource.deleteMany({ userId: user._id });
        await EmailSource.create([
            {
                userId: user._id,
                email: "asraya_cgcv2@gitam.in",
                type: "placement",
                isActive: true,
                priority: 1
            },
            {
                userId: user._id,
                email: "vspgitstudents_2027@gitam.in",
                type: "update",
                isActive: true,
                priority: 1
            }
        ]);
        console.log("Seeded test email sources for user.");

        // --- TEST 1: Sender 2 sends Google Mock Test (Google does not exist yet) ---
        console.log("\n--- TEST 1: Sender 2 sends Google Mock Test (Should be IGNORED) ---");
        const rawEmail1 = await RawEmail.create({
            gmailMessageId: "msg_google_sender2",
            threadId: "thread_google_sender2",
            userId: user._id,
            sender: "vspgitstudents_2027@gitam.in", // Sender 2
            subject: "Google Mock Test Scheduled",
            snippet: "Google Mock Test details",
            plainText: "Hello student, please join the Google Mock Test next Monday.",
            receivedAt: new Date(),
            processed: false,
        });

        await processEmailWithAI(rawEmail1._id);

        const googleComp = await Company.findOne({ name: { $regex: /^Google$/i } });
        if (googleComp) {
            throw new Error("FAIL: Google Company was incorrectly created by Sender 2!");
        }
        const googlePlacement = await Placement.findOne({ company: "Google" });
        if (googlePlacement) {
            throw new Error("FAIL: Google Placement was incorrectly created by Sender 2!");
        }
        console.log("PASS: Google was correctly ignored.");

        // --- TEST 2: Sender 1 sends TCS Recruitment (TCS does not exist yet -> should CREATE) ---
        console.log("\n--- TEST 2: Sender 1 sends TCS Recruitment (Should CREATE TCS) ---");
        const rawEmail2 = await RawEmail.create({
            gmailMessageId: "msg_tcs_sender1",
            threadId: "thread_tcs_sender1",
            userId: user._id,
            sender: "asraya_cgcv2@gitam.in", // Sender 1
            subject: "Sarthaka || SK-VCS270001 || TCS || 2027 Batch",
            snippet: "TCS placement registration is open.",
            plainText: "Apply now at https://careers.tcs.com. Eligibility 7.0 CGPA.",
            receivedAt: new Date(),
            processed: false,
        });

        await processEmailWithAI(rawEmail2._id);

        const tcsComp = await Company.findOne({ name: { $regex: /^TCS$/i } });
        if (!tcsComp) {
            throw new Error("FAIL: TCS Company workspace was NOT created by Sender 1!");
        }
        console.log("PASS: TCS workspace created successfully.");

        // --- TEST 3: Sender 2 sends TCS Mock Test (TCS exists -> should ENRICH/UPDATE) ---
        console.log("\n--- TEST 3: Sender 2 sends TCS Mock Test (Should ENRICH TCS) ---");
        const rawEmail3 = await RawEmail.create({
            gmailMessageId: "msg_tcs_mock_sender2",
            threadId: "thread_tcs_mock_sender2",
            userId: user._id,
            sender: "vspgitstudents_2027@gitam.in", // Sender 2
            subject: "TCS Mock Test Schedule Update",
            snippet: "TCS Mock Test is scheduled on Monday.",
            plainText: "Join link at https://tcs.com/test room code 123.",
            receivedAt: new Date(),
            processed: false,
        });

        await processEmailWithAI(rawEmail3._id);

        const tcsPlacements = await Placement.find({ companyId: tcsComp._id });
        if (tcsPlacements.length < 2) {
            throw new Error(`FAIL: TCS Mock Test was not added as a placement event! Total: ${tcsPlacements.length}`);
        }
        console.log("PASS: TCS workspace enriched with mock test successfully.");

        console.log("\n==========================================");
        console.log("SENDER ROUTING INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉");
        console.log("==========================================");
        process.exit(0);

    } catch (err) {
        console.error("FAIL: Test execution encountered error:", err.message);
        process.exit(1);
    }
};

runSenderLogicTest();
