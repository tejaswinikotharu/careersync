require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const Event = require("../models/Event");
const RawEmail = require("../models/RawEmail");
const Placement = require("../models/Placement");
const { parseStructuredEmail } = require("../parser/structuredParser");

const trace = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB.");

        const userId = new mongoose.Types.ObjectId("6a4fb6bb270918758ae20389");

        // 1. Fetch TCS company
        const company = await Company.findOne({ slug: "tcs" });
        if (!company) {
            console.error("Company TCS not found!");
            process.exit(1);
        }
        console.log(`\n--- COMPANY DOCUMENT ---`);
        console.log(JSON.stringify(company, null, 2));

        // 2. Fetch UserCompany workspace
        const userCompany = await UserCompany.findOne({ userId, companyId: company._id });
        console.log(`\n--- USERCOMPANY DOCUMENT ---`);
        console.log(JSON.stringify(userCompany, null, 2));

        // 3. Fetch Event documents for TCS
        const events = await Event.find({ companyId: company._id });
        console.log(`\n--- EVENTS ---`);
        console.log(JSON.stringify(events, null, 2));

        // 4. Fetch Placements for TCS (which maps to emails)
        const placements = await Placement.find({ companyId: company._id }).populate("rawEmailId");
        console.log(`\n--- PLACEMENTS ---`);
        console.log(JSON.stringify(placements, null, 2));

        // 5. Fetch associated RawEmail
        let rawEmailId = null;
        if (placements.length > 0 && placements[0].rawEmailId) {
            rawEmailId = placements[0].rawEmailId._id;
        } else {
            // Find by searching body/subject for TCS
            const emailByBody = await RawEmail.findOne({ subject: /TCS/i });
            if (emailByBody) rawEmailId = emailByBody._id;
        }

        if (rawEmailId) {
            const rawEmail = await RawEmail.findById(rawEmailId);
            console.log(`\n--- RAWEMAIL ---`);
            console.log(`Subject: ${rawEmail.subject}`);
            console.log(`Body Snippet (first 1500 chars):\n${rawEmail.plainText?.substring(0, 1500)}`);
            
            // Run parser on this raw email
            const parsed = await parseStructuredEmail(rawEmail);
            console.log(`\n--- PARSER EXTRACTION ---`);
            console.log(JSON.stringify(parsed, null, 2));
        } else {
            console.log("\nNo RawEmail found for TCS.");
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

trace();
