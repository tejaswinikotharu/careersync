const UserCompany = require("../models/UserCompany");
const Company = require("../models/Company");
const RawEmail = require("../models/RawEmail");
const Event = require("../models/Event");
const Placement = require("../models/Placement");
const { parseStructuredEmail } = require("../parser/structuredParser");
const { getDeterministicContext } = require("./ai/companyDirectoryService");

/**
 * Audit and repair tool to resolve orphaned UserCompany workspaces.
 * Rebuilds missing Company records from RawEmail canonical sources of truth.
 * 
 * @param {Object} options
 * @param {boolean} options.dryRun - If true, scans only without writing updates
 * @returns {Promise<Object>} Diagnosis and repair statistics
 */
const repairCompanyConsistency = async (options = { dryRun: false }) => {
    const startedAt = Date.now();
    console.log(`[CompanyRepair] Starting consistency repair scan. dryRun: ${options.dryRun}`);

    const diagnostics = {
        workspacesChecked: 0,
        companiesMissing: 0,
        companiesRepaired: 0,
        companiesSkipped: 0,
        repairedList: [],
        skippedList: [],
        repairDurationMs: 0
    };

    try {
        // Run migration: Populate canonicalCompanyName for existing UserCompany records where possible
        const allWorkspaces = await UserCompany.find({});
        for (const ws of allWorkspaces) {
            if (!ws.canonicalCompanyName && ws.companyId) {
                const comp = await Company.findById(ws.companyId);
                if (comp && comp.name) {
                    ws.canonicalCompanyName = comp.name;
                    await ws.save();
                    console.log(`[CompanyRepair Migration] Migrated workspace ${ws._id}: set canonicalCompanyName = "${comp.name}"`);
                }
            }
        }

        // Fetch all workspaces for consistency checks
        const workspaces = await UserCompany.find({});
        diagnostics.workspacesChecked = workspaces.length;

        // Group workspaces by companyId for missing checks
        for (const ws of workspaces) {
            if (!ws.companyId) {
                console.warn(`[CompanyRepair] Workspace ${ws._id} has null or undefined companyId. Manual review required.`);
                diagnostics.companiesSkipped++;
                diagnostics.skippedList.push({ workspaceId: ws._id, reason: "Null or undefined companyId" });
                continue;
            }

            // Check if global Company document exists
            const compExists = await Company.findById(ws.companyId);
            if (compExists) {
                continue; // Workspace is healthy
            }

            // Company is missing!
            diagnostics.companiesMissing++;
            console.log(`[CompanyRepair] Inconsistency detected! Workspace: ${ws._id} references missing Company ID: ${ws.companyId}`);

            // Use canonicalCompanyName as the source of truth for the company name
            const matchedCompanyName = ws.canonicalCompanyName;

            // Guard against "Unknown" or empty company names
            if (!matchedCompanyName || matchedCompanyName.toLowerCase() === "unknown") {
                console.error(`[CompanyRepair] Repair failed. Reason: Missing canonical company name. Workspace: ${ws._id}. Action Required: Manual review.`);
                diagnostics.companiesSkipped++;
                diagnostics.skippedList.push({ workspaceId: ws._id, companyId: ws.companyId, reason: "Missing canonical company name" });
                continue;
            }

            // Log dry run mapping
            if (options.dryRun) {
                console.log(`[CompanyRepair] [Dry-Run] Will repair Company: "${matchedCompanyName}" with ID: ${ws.companyId}`);
                diagnostics.companiesRepaired++;
                diagnostics.repairedList.push(matchedCompanyName);
            } else {
                // Perform actual database restoration
                console.log(`[CompanyRepair] Reconstructing Company: "${matchedCompanyName}" with ID: ${ws.companyId}...`);
                
                const context = getDeterministicContext(matchedCompanyName);
                const slug = matchedCompanyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

                await Company.create({
                    _id: ws.companyId,
                    name: matchedCompanyName,
                    slug,
                    website: context.website || "",
                    headquarters: context.headquarters || "Unknown Location",
                    overview: context.description || "Company workspace automatically reconstructed by consistency service.",
                    type: "Product"
                });

                // Trigger async background intelligence enrichment
                try {
                    const { enrichCompany } = require("./ai/companyIntelligenceService");
                    enrichCompany(ws.companyId).catch(err => {
                        console.error(`[CompanyRepair] Enrichment queue trigger failed for ${matchedCompanyName}:`, err.message);
                    });
                } catch (queueErr) {
                    console.warn(`[CompanyRepair] Enrichment service load failed for ${matchedCompanyName}:`, queueErr.message);
                }

                diagnostics.companiesRepaired++;
                diagnostics.repairedList.push(matchedCompanyName);
            }
        }

        diagnostics.repairDurationMs = Date.now() - startedAt;
        console.log(`[CompanyRepair] Repair scan completed. Diagnostics:`, JSON.stringify(diagnostics, null, 2));
        return diagnostics;
    } catch (err) {
        console.error(`[CompanyRepair] Critical error during consistency repair execution:`, err.message);
        throw err;
    }
};

module.exports = {
    repairCompanyConsistency
};
