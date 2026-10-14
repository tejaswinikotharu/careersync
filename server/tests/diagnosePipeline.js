require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const RawEmail = require("../models/RawEmail");
const Placement = require("../models/Placement");
const Event = require("../models/Event");
const StudentUpdate = require("../models/StudentUpdate");

const runDiagnosis = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("==========================================");
        console.log("CAREERSYNC PIPELINE DIAGNOSTICS & VERIFICATION");
        console.log("==========================================\n");

        // 1. Verify Database environment
        const conn = mongoose.connection;
        console.log("--- 1. DATABASE ENVIRONMENT ---");
        console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`MONGO_URI: ${process.env.MONGO_URI}`);
        console.log(`Database Host: ${conn.host}`);
        console.log(`Database Name: ${conn.name}`);
        console.log("------------------------------------------\n");

        // 2. Database Counts
        console.log("--- 2. DATABASE COUNTS ---");
        console.log(`Companies: ${await Company.countDocuments({})}`);
        console.log(`UserCompanies: ${await UserCompany.countDocuments({})}`);
        console.log(`Placements: ${await Placement.countDocuments({})}`);
        console.log(`Events: ${await Event.countDocuments({})}`);
        console.log(`RawEmails: ${await RawEmail.countDocuments({})}`);
        console.log(`StudentUpdates: ${await StudentUpdate.countDocuments({})}`);
        console.log("------------------------------------------\n");

        // 3. UserCompany Consistency Check (Orphaned references check)
        console.log("--- 3. USERCOMPANY CONSISTENCY CHECK ---");
        const uComps = await UserCompany.find({});
        for (const uc of uComps) {
            const comp = await Company.findById(uc.companyId);
            const exists = comp ? "YES" : "NO";
            const user = await User.findById(uc.userId);
            const userEmail = user ? user.email : "Unknown User";
            console.log(`Workspace ID: ${uc._id}`);
            console.log(`  - User: ${userEmail} (${uc.userId})`);
            console.log(`  - CompanyId: ${uc.companyId}`);
            console.log(`  - Company Exists? ${exists} ${comp ? `(Name: "${comp.name}")` : ""}`);
            if (exists === "NO") {
                console.log(`  ⚠️ ORPHANED REFERENCE DETECTED: Workspace references a deleted company!`);
            }
        }
        console.log("------------------------------------------\n");

        // 4. Trace E2E Placement Pipeline (TCS, ZopSmart, Axtria)
        console.log("--- 4. PLACEMENT PIPELINE TRACE ---");
        const placementEmails = await RawEmail.find({
            sender: "asraya_cgcv2@gitam.in"
        });

        console.log(`Found ${placementEmails.length} emails from placement source asraya_cgcv2@gitam.in:`);
        for (const e of placementEmails) {
            console.log(`\nEmail Subject: "${e.subject}"`);
            console.log(`  - Message ID: ${e.gmailMessageId}`);
            
            // Extract using mock logic/regex to check company
            const subject = e.subject || "";
            const body = e.plainText || "";
            let compName = "Unknown";
            if (subject.toLowerCase().includes("tcs") || body.toLowerCase().includes("tcs")) compName = "TCS";
            else if (subject.toLowerCase().includes("zopsmart") || body.toLowerCase().includes("zopsmart")) compName = "ZopSmart";
            else if (subject.toLowerCase().includes("axtria") || body.toLowerCase().includes("axtria")) compName = "Axtria";
            
            console.log(`  - Company Extracted: "${compName}"`);
            
            const gComp = await Company.findOne({ name: { $regex: new RegExp(`^${compName}$`, "i") } });
            console.log(`  - Global Company Exists? ${gComp ? `YES (ID: ${gComp._id})` : "NO"}`);
            console.log(`  - Global Company Created? ${gComp ? "YES" : "NO"}`);

            if (gComp) {
                const uc = await UserCompany.findOne({ userId: e.userId, companyId: gComp._id });
                console.log(`  - UserCompany Exists? ${uc ? `YES (ID: ${uc._id}, Status: ${uc.status})` : "NO"}`);
                console.log(`  - UserCompany Created? ${uc ? "YES" : "NO"}`);

                const pl = await Placement.findOne({ userId: e.userId, companyId: gComp._id });
                console.log(`  - Placement Saved? ${pl ? `YES (ID: ${pl._id}, Event: "${pl.event}")` : "NO"}`);

                const evCount = await Event.countDocuments({ userId: e.userId, companyId: gComp._id });
                console.log(`  - Events Saved? ${evCount > 0 ? `YES (${evCount} events)` : "NO"}`);

                // Check dashboard query visibility
                const tracked = await UserCompany.findOne({ userId: e.userId, companyId: gComp._id });
                console.log(`  - Dashboard Visible? ${tracked ? "YES" : "NO"}`);
            } else {
                console.log("  - UserCompany Exists? NO");
                console.log("  - UserCompany Created? NO");
                console.log("  - Placement Saved? NO");
                console.log("  - Events Saved? NO");
                console.log("  - Dashboard Visible? NO");
            }
        }
        console.log("------------------------------------------\n");

        // 5. Trace E2E Student Update Pipeline
        console.log("--- 5. STUDENT UPDATE PIPELINE TRACE ---");
        const updateEmails = await RawEmail.find({
            sender: "vspgitstudents_2027@gitam.in"
        });

        console.log(`Found ${updateEmails.length} emails from update source vspgitstudents_2027@gitam.in:`);
        for (const e of updateEmails) {
            console.log(`\nEmail Subject: "${e.subject}"`);
            console.log(`  - Message ID: ${e.gmailMessageId}`);
            
            // Detected Company
            const subject = e.subject || "";
            const body = e.plainText || "";
            let compName = "Unknown";
            if (subject.toLowerCase().includes("tcs") || body.toLowerCase().includes("tcs")) compName = "TCS";
            else if (subject.toLowerCase().includes("zopsmart") || body.toLowerCase().includes("zopsmart")) compName = "ZopSmart";
            else if (subject.toLowerCase().includes("axtria") || body.toLowerCase().includes("axtria")) compName = "Axtria";
            
            console.log(`  - Detected Company: "${compName}"`);

            const gComp = await Company.findOne({ name: { $regex: new RegExp(`^${compName}$`, "i") } });
            if (gComp) {
                const uc = await UserCompany.findOne({ userId: e.userId, companyId: gComp._id });
                console.log(`  - Existing Workspace Found? ${uc ? `YES (ID: ${uc._id})` : "NO"}`);
                console.log(`  - Workspace Updated? ${uc ? "YES" : "NO"}`);
                
                const ev = await Event.findOne({ userId: e.userId, companyId: gComp._id, rawEmailIds: e._id });
                console.log(`  - Event Created? ${ev ? `YES (ID: ${ev._id}, Type: "${ev.type}")` : "NO"}`);
                console.log(`  - Skipped? ${uc ? "NO" : "YES"}`);
                if (!uc) {
                    console.log(`    ⚠️ Skip Reason: WORKSPACE_NOT_FOUND (Company exists globally but no UserCompany workspace established for this user yet)`);
                }
            } else {
                console.log("  - Existing Workspace Found? NO");
                console.log("  - Workspace Updated? NO");
                console.log("  - Event Created? NO");
                console.log("  - Skipped? YES");
                console.log(`    ⚠️ Skip Reason: COMPANY_NOT_FOUND (Global company "${compName}" does not exist in Company collection)`);
            }
        }
        console.log("------------------------------------------\n");

        // 6. Simulated GET /api/user-companies Payload
        console.log("--- 6. SIMULATED GET /api/user-companies RESPONSE ---");
        const list = await UserCompany.find({}).populate("companyId");
        for (const uc of list) {
            console.log(`\nWorkspace ID: ${uc._id}`);
            console.log(`  - Company ID: ${uc.companyId?._id || uc.companyId}`);
            console.log(`  - Company Name: ${uc.companyId?.name || "undefined"}`);
            console.log(`  - populate(companyId) succeeded? ${uc.companyId && uc.companyId.name ? "YES" : "NO"}`);
            
            let evs = 0;
            let pls = 0;
            if (uc.companyId) {
                evs = await Event.countDocuments({ userId: uc.userId, companyId: uc.companyId._id });
                pls = await Placement.countDocuments({ userId: uc.userId, companyId: uc.companyId._id });
            }
            console.log(`  - Number of Events: ${evs}`);
            console.log(`  - Number of Placements: ${pls}`);
        }
        console.log("------------------------------------------\n");

        process.exit(0);
    } catch (err) {
        console.error(err.stack || err);
        process.exit(1);
    }
};

runDiagnosis();
