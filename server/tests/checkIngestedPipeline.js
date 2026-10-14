require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const RawEmail = require("../models/RawEmail");
const Event = require("../models/Event");
const Placement = require("../models/Placement");
const StudentUpdate = require("../models/StudentUpdate");

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const tkotharuUserId = "6a4fb6bb270918758ae20389";
        
        console.log("\n==========================================");
        console.log(`ANALYSIS FOR USER tkotharu@gitam.in (${tkotharuUserId})`);
        console.log("==========================================");

        // 1. RawEmails
        const rawEmails = await RawEmail.find({ userId: tkotharuUserId });
        console.log(`\nRaw Emails Count: ${rawEmails.length}`);
        rawEmails.forEach(e => {
            console.log(`  - [ID: ${e._id}] Sender: ${e.sender} | Subject: "${e.subject}" | Processed: ${e.processed}`);
        });

        // 2. Placements
        const placements = await Placement.find({ userId: tkotharuUserId });
        console.log(`\nPlacements Count: ${placements.length}`);
        placements.forEach(p => {
            console.log(`  - [ID: ${p._id}] Company: ${p.company} | Event: ${p.event} | Role: ${p.role}`);
        });

        // 3. StudentUpdates
        const studentUpdates = await StudentUpdate.find({ userId: tkotharuUserId });
        console.log(`\nStudent Updates Count: ${studentUpdates.length}`);
        studentUpdates.forEach(s => {
            console.log(`  - [ID: ${s._id}] Company: ${s.company} | Category: ${s.category} | Title: "${s.title}"`);
        });

        // 4. Events
        const events = await Event.find({ userId: tkotharuUserId });
        console.log(`\nEvents Count: ${events.length}`);
        events.forEach(ev => {
            console.log(`  - [ID: ${ev._id}] Company: ${ev.companyName} | Type: ${ev.type} | Date: ${ev.date.toISOString().split("T")[0]}`);
        });

        // 5. UserCompanies
        const userComps = await UserCompany.find({ userId: tkotharuUserId }).populate("companyId");
        console.log(`\nUserCompanies Count: ${userComps.length}`);
        userComps.forEach(uc => {
            console.log(`  - [ID: ${uc._id}] Company Name: ${uc.companyId?.name} | Slug: ${uc.companyId?.slug} | Status: ${uc.status}`);
        });

        // 6. Global Companies
        const globalComps = await Company.find({});
        console.log(`\nGlobal Companies Count: ${globalComps.length}`);
        globalComps.forEach(c => {
            console.log(`  - [ID: ${c._id}] Name: ${c.name} | Slug: ${c.slug}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err.stack || err);
        process.exit(1);
    }
};

run();
