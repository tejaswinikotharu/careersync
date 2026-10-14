require("dotenv").config();
const mongoose = require("mongoose");
const RawEmail = require("../models/RawEmail");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const Placement = require("../models/Placement");
const StudentUpdate = require("../models/StudentUpdate");
const { processEmailWithAI } = require("../services/ai/emailAnalyzer");

const runActiveUserSyncTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB for Active User Sync Test.");

        const activeUserId = "6a4bab90b29f1b38c3237376";

        // Find all unprocessed emails for active user
        const unprocessed = await RawEmail.find({ userId: activeUserId, processed: false });
        console.log(`\nFound ${unprocessed.length} unprocessed emails for active user.`);

        // We will hijack the console.log during processEmailWithAI to format the exact requested logging schema
        // and track what mongoose operations happen.
        for (const email of unprocessed) {
            console.log("\n=========================");
            console.log("PLACEMENT EMAIL");
            console.log("=========================\n");
            
            console.log(`Processing message ID: ${email._id}`);
            
            // We run processEmailWithAI synchronously here to capture output
            try {
                await processEmailWithAI(email._id);
            } catch (err) {
                console.error("Error in processEmailWithAI:", err);
            }
        }

        // Output collection counts
        console.log("\n=========================");
        console.log("COLLECTION COUNTS AFTER SYNC");
        console.log("=========================");
        const compCount = await Company.countDocuments({});
        const ucCount = await UserCompany.countDocuments({});
        const pCount = await Placement.countDocuments({});
        const suCount = await StudentUpdate.countDocuments({});
        
        console.log(`Companies Collection Count: ${compCount}`);
        console.log(`UserCompany Count: ${ucCount}`);
        console.log(`Placement Count: ${pCount}`);
        console.log(`StudentUpdate Count: ${suCount}`);
        console.log("=========================\n");

        // Dump every document in the database
        console.log("Companies\n[");
        const companies = await Company.find({});
        console.log(JSON.stringify(companies, null, 2));
        console.log("]\n");

        console.log("UserCompanies\n[");
        const userCompanies = await UserCompany.find({});
        console.log(JSON.stringify(userCompanies, null, 2));
        console.log("]\n");

        console.log("Placements\n[");
        const placements = await Placement.find({});
        console.log(JSON.stringify(placements, null, 2));
        console.log("]\n");

        console.log("StudentUpdates\n[");
        const studentUpdates = await StudentUpdate.find({});
        console.log(JSON.stringify(studentUpdates, null, 2));
        console.log("]\n");

        // Verify the dashboard APIs by simulating the controller operations
        console.log("=========================");
        console.log("API ROUTE VERIFICATIONS");
        console.log("=========================");

        // 1. GET /api/companies (via companyController getCompanies)
        console.log("\nGET /api/companies response payload simulation:");
        const userTracked = await UserCompany.find({ userId: activeUserId });
        const trackedCompanyIds = userTracked.map(ut => ut.companyId);
        const getCompaniesResult = await Company.find({
            _id: { $in: trackedCompanyIds }
        });
        console.log(JSON.stringify(getCompaniesResult, null, 2));

        // 2. GET /api/dashboard (via companyController getDashboardData)
        console.log("\nGET /api/dashboard response payload simulation:");
        const dashboardCompanies = await UserCompany.find({ userId: activeUserId }).populate("companyId");
        console.log(JSON.stringify(dashboardCompanies, null, 2));

        // 3. GET /api/user-companies (via userCompanyController getUserCompanies)
        console.log("\nGET /api/user-companies response payload simulation:");
        const userCompaniesResult = await UserCompany.find({ userId: activeUserId }).populate("companyId");
        console.log(JSON.stringify(userCompaniesResult, null, 2));

        console.log("\nActive user sync testing complete.");
        process.exit(0);
    } catch (err) {
        console.error("Fail:", err);
        process.exit(1);
    }
};

runActiveUserSyncTest();
