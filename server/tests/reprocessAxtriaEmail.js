require("dotenv").config();
const mongoose = require("mongoose");
const RawEmail = require("../models/RawEmail");
const UserCompany = require("../models/UserCompany");
const Company = require("../models/Company");
const { processEmailWithAI } = require("../services/ai/emailAnalyzer");

const reprocess = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB.");

        const email = await RawEmail.findById("6a50a5b083e676f8e96e4c36");
        if (!email) {
            console.error("Axtria raw email not found in MongoDB!");
            process.exit(1);
        }
        console.log(`Found RawEmail ID: ${email._id}`);
        console.log(`Subject: ${email.subject}`);

        email.processed = false;
        await email.save();

        const dummySyncRunId = new mongoose.Types.ObjectId();
        await processEmailWithAI(email._id, dummySyncRunId);

        const company = await Company.findOne({ slug: "axtria" });
        const userCompany = await UserCompany.findOne({ companyId: company._id });
        console.log(`\n--- UPDATED USERCOMPANY DOCUMENT ---`);
        console.log(`Package: ${userCompany.package}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

reprocess();
