require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const Placement = require("../models/Placement");
const StudentUpdate = require("../models/StudentUpdate");
const RawEmail = require("../models/RawEmail");

const checkDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB database.");

        const companiesCount = await Company.countDocuments({});
        const userCompaniesCount = await UserCompany.countDocuments({});
        const placementsCount = await Placement.countDocuments({});
        const studentUpdatesCount = await StudentUpdate.countDocuments({});
        const rawEmailsCount = await RawEmail.countDocuments({});

        console.log("\n==========================================");
        console.log("COLLECTION COUNTS:");
        console.log(`Companies Count: ${companiesCount}`);
        console.log(`UserCompany Count: ${userCompaniesCount}`);
        console.log(`Placement Count: ${placementsCount}`);
        console.log(`StudentUpdate Count: ${studentUpdatesCount}`);
        console.log(`RawEmails Count: ${rawEmailsCount}`);
        console.log("==========================================\n");

        console.log("COMPANIES IN DATABASE:");
        const companies = await Company.find({});
        console.log(JSON.stringify(companies, null, 2));

        console.log("\nUSER COMPANIES IN DATABASE:");
        const userCompanies = await UserCompany.find({});
        console.log(JSON.stringify(userCompanies, null, 2));

        console.log("\nPLACEMENTS IN DATABASE (limit 5):");
        const placements = await Placement.find({}).limit(5);
        console.log(JSON.stringify(placements, null, 2));

        console.log("\nSTUDENT UPDATES IN DATABASE (limit 5):");
        const studentUpdates = await StudentUpdate.find({}).limit(5);
        console.log(JSON.stringify(studentUpdates, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("Error checking DB:", err.message);
        process.exit(1);
    }
};

checkDb();
