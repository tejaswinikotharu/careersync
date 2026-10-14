require("dotenv").config();
const mongoose = require("mongoose");
const RawEmail = require("../models/RawEmail");
const UserCompany = require("../models/UserCompany");
const Placement = require("../models/Placement");
const Company = require("../models/Company");
const { processEmailWithAI } = require("../services/ai/emailAnalyzer");

const reprocess = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB.");

        // Find ZopSmart raw email
        const email = await RawEmail.findById("6a50a5db83e676f8e96e4f70");
        if (!email) {
            console.error("ZopSmart raw email not found in MongoDB!");
            process.exit(1);
        }
        console.log(`Found RawEmail ID: ${email._id}`);
        console.log(`Subject: ${email.subject}`);

        // Set processed flag to false to trigger analysis
        email.processed = false;
        await email.save();

        // Reprocess the email
        const dummySyncRunId = new mongoose.Types.ObjectId();
        console.log("Reprocessing email with processEmailWithAI...");
        const result = await processEmailWithAI(email._id, dummySyncRunId);
        console.log("Ingestion result:", JSON.stringify(result, null, 2));

        // Let's verify what got updated in database
        const company = await Company.findOne({ slug: "zopsmart" });
        const userCompany = await UserCompany.findOne({ companyId: company._id });
        console.log(`\n--- UPDATED USERCOMPANY DOCUMENT ---`);
        console.log(`Package: ${userCompany.package}`);
        console.log(JSON.stringify(userCompany, null, 2));

        const placement = await Placement.findOne({ companyId: company._id });
        console.log(`\n--- UPDATED PLACEMENT DOCUMENT ---`);
        console.log(`Package: ${placement.package}`);
        console.log(JSON.stringify(placement, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

reprocess();
