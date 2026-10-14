require("dotenv").config();
const mongoose = require("mongoose");
const RawEmail = require("../models/RawEmail");
const UserCompany = require("../models/UserCompany");
const Company = require("../models/Company");
const Placement = require("../models/Placement");
const Event = require("../models/Event");
const EmailSource = require("../models/EmailSource");
const SyncRun = require("../models/SyncRun");
const EmailProcessingLog = require("../models/EmailProcessingLog");

const seedMock = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB for Seeding Mock Emails.");

        const activeUserId = "6a4bab90b29f1b38c3237376";

        // Clean up previous runs
        await RawEmail.deleteMany({ userId: activeUserId });
        await UserCompany.deleteMany({ userId: activeUserId });
        await Placement.deleteMany({ userId: activeUserId });
        await Event.deleteMany({ userId: activeUserId });
        await SyncRun.deleteMany({ userId: activeUserId });
        await EmailProcessingLog.deleteMany({ userId: activeUserId });
        await EmailSource.deleteMany({ userId: activeUserId });

        // Seed default EmailSource records
        await EmailSource.create([
            {
                userId: activeUserId,
                email: "asraya_cgcv2@gitam.in",
                type: "placement",
                isActive: true,
                priority: 1
            },
            {
                userId: activeUserId,
                email: "vspgitstudents_2027@gitam.in",
                type: "update",
                isActive: true,
                priority: 1
            }
        ]);
        console.log("Seeded default active email sources for active test user.");

        // Add ZopSmart if not exists in global companies (so it doesn't trigger E11000 or profile fallback crash)
        let zop = await Company.findOne({ name: "ZopSmart" });
        if (!zop) {
            zop = await Company.create({
                name: "ZopSmart",
                slug: "zopsmart",
                website: "https://zopsmart.com",
                headquarters: "Bangalore",
                overview: "ZopSmart is a product-based technology company.",
                type: "Product"
            });
            console.log("Created global ZopSmart company record.");
        }

        // 1. Seed TCS Placement Email from Sender 1
        await RawEmail.create({
            gmailMessageId: "msg_tcs_mock_1",
            threadId: "thread_tcs_mock_1",
            userId: activeUserId,
            sender: "asraya_cgcv2@gitam.in",
            subject: "Sarthaka || SK-VCS270001 || TCS || 2027 Batch",
            snippet: "TCS Placement Drive has started.",
            plainText: "Corporate Name : TCS\nPlease register for the drive using this form.",
            html: "",
            attachments: [],
            receivedAt: new Date(),
            processed: false
        });

        // 2. Seed ZopSmart Placement Email from Sender 1
        await RawEmail.create({
            gmailMessageId: "msg_zopsmart_mock_1",
            threadId: "thread_zopsmart_mock_1",
            userId: activeUserId,
            sender: "asraya_cgcv2@gitam.in",
            subject: "Sarthaka || SK-VCS270002 || ZopSmart || 2027 Batch",
            snippet: "ZopSmart Placement Drive details.",
            plainText: "Corporate Name : ZopSmart\nRegister at https://zopsmart.com/apply.",
            html: "",
            attachments: [],
            receivedAt: new Date(),
            processed: false
        });

        // 3. Seed Axtria Placement Email from Sender 1
        await RawEmail.create({
            gmailMessageId: "msg_axtria_mock_1",
            threadId: "thread_axtria_mock_1",
            userId: activeUserId,
            sender: "asraya_cgcv2@gitam.in",
            subject: "Sarthaka || SK-VCS270004 || Axtria || 2027 Batch || Deadline 11-Jul-2026 08:00 AM",
            snippet: "Axtria placement drive deadline.",
            plainText: "Corporate Name : Axtria\nRegister before deadline.",
            html: "",
            attachments: [],
            receivedAt: new Date(),
            processed: false
        });

        console.log("Mock placement emails seeded successfully for user 6a4bab90b29f1b38c3237376.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedMock();
