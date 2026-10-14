require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("./models/Company");
const UserCompany = require("./models/UserCompany");
const User = require("./models/User");
const Event = require("./models/Event");
const Email = require("./models/Email");
const Notification = require("./models/Notification");
const Document = require("./models/Document");
const EmailSource = require("./models/EmailSource");
const SyncRun = require("./models/SyncRun");
const EmailProcessingLog = require("./models/EmailProcessingLog");

const companiesToSeed = [
    {
        slug: "tcs",
        name: "TCS",
        package: "7 LPA",
        eligibility: "7 CGPA",
        website: "https://www.tcs.com",
        overview: "TCS is India's largest IT services and consulting company.",
        headquarters: "Mumbai",
        recruitmentProcess: ["Application", "Online Assessment", "Technical Interview", "HR Interview"],
        type: "Service",
        isRemote: false,
        hiringStatus: "Hiring",
        roles: ["System Engineer", "Digital Consultant"],
        location: "Mumbai",
        timeline: [
            { title: "Applied", date: "2 Jul 2026", status: "completed" },
            { title: "Registration Completed", date: "4 Jul 2026", status: "completed" },
            { title: "Mock Test", date: "10 Jul 2026", status: "current" },
            { title: "Coding Round", date: "14 Jul 2026", status: "upcoming" }
        ]
    }
];

const seedDB = async () => {
    try {
        // Connect via Atlas string (configured in .env)
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB database for seeding...");

        // 1. Clear all collections
        await Company.deleteMany({});
        await UserCompany.deleteMany({});
        await User.deleteMany({});
        await Event.deleteMany({});
        await Email.deleteMany({});
        await Notification.deleteMany({});
        await Document.deleteMany({});
        await EmailSource.deleteMany({});
        await SyncRun.deleteMany({});
        await EmailProcessingLog.deleteMany({});
        console.log("Cleared existing records across all sandbox collections successfully.");

        // 2. Seed Master Companies list (Only TCS)
        const seededCompanies = await Company.insertMany(companiesToSeed);
        console.log(`Seeded ${seededCompanies.length} master companies.`);

        const tcsCompany = seededCompanies.find(c => c.slug === "tcs");

        // 3. Create Sandbox Test User 1 (Need Onboarding)
        const user1 = await User.create({
            name: "Alex Placement",
            email: "test@careersync.com",
            password: "password123",
            role: "student",
            isOnboarded: false,
        });
        console.log(`Seeded New Student User (Need Onboarding):`);
        console.log(`  - Email: test@careersync.com`);
        console.log(`  - Password: password123`);

        // 4. Create Sandbox Test User 2 (Already Onboarded with full workspace history)
        const user2 = await User.create({
            name: "Sam Expert",
            email: "onboarded@careersync.com",
            password: "password123",
            role: "student",
            isOnboarded: true,
            branch: "Computer Science",
            cgpa: 9.1,
            graduationYear: 2026,
            skills: ["React", "Node.js", "Java", "Python"],
            preferredRoles: ["Software Engineer"],
            preferredLocations: ["Bangalore"],
            preferredPackage: "15 LPA",
            resumeUrl: "/uploads/sam-sample-resume.pdf",
            linkedin: "https://linkedin.com",
            github: "https://github.com",
        });
        console.log(`Seeded Onboarded Student User (With Complete Workspace History):`);
        console.log(`  - Email: onboarded@careersync.com`);
        console.log(`  - Password: password123`);

        // Seed default EmailSource records for user1
        await EmailSource.create([
            {
                userId: user1._id,
                email: "asraya_cgcv2@gitam.in",
                type: "placement",
                isActive: true,
                priority: 1
            },
            {
                userId: user1._id,
                email: "vspgitstudents_2027@gitam.in",
                type: "update",
                isActive: true,
                priority: 1
            }
        ]);

        // Seed default EmailSource records for user2
        await EmailSource.create([
            {
                userId: user2._id,
                email: "asraya_cgcv2@gitam.in",
                type: "placement",
                isActive: true,
                priority: 1
            },
            {
                userId: user2._id,
                email: "vspgitstudents_2027@gitam.in",
                type: "update",
                isActive: true,
                priority: 1
            }
        ]);

        // 5. Seed tracking entries for User 2 (Only TCS)
        await UserCompany.create([
            {
                userId: user2._id,
                companyId: tcsCompany._id,
                status: "Applied",
                notes: "Review basic aptitude reasoning quizzes.",
                currentRound: "Online Assessment",
                progress: 20,
                timeline: [
                    { title: "Applied", date: "2 Jul 2026", status: "completed" },
                    { title: "Registration Completed", date: "4 Jul 2026", status: "completed" }
                ]
            }
        ]);

        // 6. Seed Event schedules for User 2 (Only TCS)
        await Event.create([
            {
                userId: user2._id,
                companyId: tcsCompany._id,
                companyName: "TCS",
                title: "Aptitude Mock Quiz",
                date: "2026-07-10",
                type: "Online Assessment"
            }
        ]);

        // 7. Seed Email sync warnings for User 2 (Only TCS)
        await Email.create([
            {
                gmailMessageId: "msg-t1",
                threadId: "thread-t1",
                userId: user2._id,
                sender: "TCS Campus Drive Team <recruitment@tcs.com>",
                subject: "TCS Registration Completed",
                snippet: "Your registration details for TCS campus drive have been updated.",
                body: "Hello Sam, your registration is successful for TCS NQT campus drive...",
                company: "TCS",
                receivedAt: new Date("2026-07-04T10:00:00.000Z"),
                isRead: false,
                aiProcessed: true,
                category: "Registration",
                priority: "Medium",
                summary: "TCS registration completed.",
                deadline: new Date("2026-07-04T23:59:59.000Z"),
                actionItems: ["Review credentials"]
            }
        ]);

        // 8. Seed AI Notification alerts for User 2 (Only TCS)
        await Notification.create([
            {
                userId: user2._id,
                title: "🎯 TCS Prep Strategy Tips",
                message: "Revise basic aptitude reasoning quizzes.",
                isRead: false
            }
        ]);

        // 9. Seed Document logs for User 2 (Only TCS)
        await Document.create([
            {
                userId: user2._id,
                companyId: tcsCompany._id,
                name: "TCS SDE Custom Resume",
                type: "Resume",
                fileUrl: "/uploads/sam-tcs-resume.pdf",
                fileName: "sam-tcs-resume.pdf",
                fileSize: 320000
            }
        ]);

        console.log("Database seeded successfully! 🎉 Sandbox is now ready.");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error.message);
        process.exit(1);
    }
};

seedDB();
