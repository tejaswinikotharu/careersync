require("dotenv").config();
const mongoose = require("mongoose");
const { repairCompanyConsistency } = require("../services/companyRepairService");

const runRepair = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB database.");

        const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-d");
        const diagnostics = await repairCompanyConsistency({ dryRun });
        
        console.log("\n==========================================");
        console.log("REPAIR COMPLETED:");
        console.log(`Dry Run:           ${dryRun}`);
        console.log(`Workspaces Checked: ${diagnostics.workspacesChecked}`);
        console.log(`Companies Missing:  ${diagnostics.companiesMissing}`);
        console.log(`Companies Repaired: ${diagnostics.companiesRepaired}`);
        console.log(`Companies Skipped:  ${diagnostics.companiesSkipped}`);
        console.log(`Duration:           ${diagnostics.repairDurationMs}ms`);
        console.log("==========================================");
        process.exit(0);
    } catch (err) {
        console.error("CLI Repair execution failed:", err.message);
        process.exit(1);
    }
};

runRepair();
