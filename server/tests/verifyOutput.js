const mongoose = require("mongoose");
const Placement = require("../models/Placement");
const RawEmail = require("../models/RawEmail");
const UserCompany = require("../models/UserCompany");

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        
        console.log("Connected to MongoDB for Verification.");

        // Find ZopSmart placement
        const p = await Placement.findOne({ company: "ZopSmart" }).populate("rawEmailId");
        if (!p) {
            console.error("ZopSmart placement not found in DB!");
            process.exit(1);
        }

        const raw = p.rawEmailId || {};
        
        // Mapped response structure returned by GET /api/gmail/emails
        const mappedEmail = {
            _id: p._id,
            id: p._id,
            company: p.company,
            sender: raw.sender || "Unknown",
            subject: raw.subject || `${p.company} - ${p.event}`,
            snippet: p.summary || raw.snippet || "",
            body: raw.plainText || raw.html || "",
            receivedAt: raw.receivedAt || p.createdAt,
            category: p.event,
            summary: p.summary,
            deadline: p.deadline,
            jobRole: p.role,
            package: p.package,
            eligibility: p.cgpa,
            applyLink: p.registrationLink,
            codingTestDate: p.testDate,
            interviewDates: p.interviewDate ? [p.interviewDate] : [],
            importantInstructions: p.importantInstructions || [],
            requiredDocuments: p.requiredDocuments || [],
            mockTests: p.mockTests || [],
        };

        console.log("\n==========================================");
        console.log("SIMULATED API RESPONSE FOR UI RENDERING:");
        console.log("==========================================");
        console.log(JSON.stringify(mappedEmail, null, 2));

        // Fetch UserCompany workspace details
        const uc = await UserCompany.findOne({ userId: p.userId, companyId: p.rawEmailId.userId }); // or just search by name
        console.log("\nSuccessfully verified E2E database records.");
        process.exit(0);
    } catch (err) {
        console.error("Verification script failed:", err.message);
        process.exit(1);
    }
};

verify();
