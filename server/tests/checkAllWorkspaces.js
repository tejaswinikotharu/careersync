require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const UserCompany = require("../models/UserCompany");
const Company = require("../models/Company");

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const users = await User.find({});
        for (const u of users) {
            console.log(`\n==========================================`);
            console.log(`User: ${u.email} (${u._id})`);
            console.log(`==========================================`);

            const userComps = await UserCompany.find({ userId: u._id }).populate("companyId");
            console.log(`Workspaces Count: ${userComps.length}`);
            userComps.forEach(uc => {
                console.log(`  - [ID: ${uc._id}] Company Name: ${uc.companyId?.name} | Slug: ${uc.companyId?.slug} | Status: ${uc.status}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error(err.stack || err);
        process.exit(1);
    }
};

run();
