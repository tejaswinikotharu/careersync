const Company = require("../models/Company");
const UserCompany = require("../models/UserCompany");
const EmailSource = require("../models/EmailSource");
const { getDeterministicContext } = require("./ai/companyDirectoryService");

/**
 * Reusable resolver that determines company identity and enforces authorization boundaries
 * for creating global company records and user company tracking workspaces.
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.companyName - Clean candidate extracted name from parser
 * @param {string} params.senderEmail - Normalized sender email
 * @returns {Promise<Object>} Result descriptor containing { workspace, company, action, reasonCode, reason }
 */
const resolveWorkspace = async ({ userId, companyName, senderEmail }) => {
    const cleanName = (companyName || "").trim();
    if (!cleanName || cleanName.toLowerCase() === "unknown") {
        return {
            workspace: null,
            company: null,
            action: "IGNORE",
            reasonCode: "INVALID_COMPANY",
            reason: "Extracted company name is missing or invalid."
        };
    }

    // 1. Resolve Global Company document
    let company = await Company.findOne({
        name: { $regex: new RegExp(`^${cleanName}$`, "i") }
    });

    if (!company) {
        // Enforce authorization bounds check first before creating global Company document
        const sourceConfig = await EmailSource.findOne({
            userId,
            email: senderEmail.toLowerCase(),
            isActive: true
        });

        if (!sourceConfig || sourceConfig.type !== "placement") {
            return {
                workspace: null,
                company: null,
                action: "IGNORE",
                reasonCode: "WORKSPACE_NOT_FOUND",
                reason: `Student update or unconfigured source cannot create a new company/workspace for "${cleanName}".`
            };
        }

        console.log(`Global company "${cleanName}" not found. Fetching directory metadata...`);
        const context = getDeterministicContext(cleanName);
        const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        
        company = await Company.create({
            name: cleanName,
            slug,
            website: context.website || "",
            headquarters: context.headquarters || "Unknown Location",
            overview: context.description || "Company workspace automatically initialized.",
            type: "Product",
        });
        console.log(`Auto-created global Company record: "${company.name}"`);

        // Trigger initial background intelligence enrichment
        try {
            const { enrichCompany } = require("./ai/companyIntelligenceService");
            enrichCompany(company._id).catch(err => {
                console.error(`[CompanyIntelligence] Failed to trigger enrich for ${company.name}:`, err.message);
            });
        } catch (enrichErr) {
            console.warn("[CompanyIntelligence] Service load failed during company creation:", enrichErr.message);
        }
    }

    // 2. Resolve User Workspace (UserCompany)
    let workspace = await UserCompany.findOne({ userId, companyId: company._id });

    if (workspace) {
        return {
            workspace,
            company,
            action: "UPDATE_WORKSPACE",
            reasonCode: "WORKSPACE_UPDATED",
            reason: `Workspace for "${company.name}" matched and will be updated.`
        };
    }

    // 3. Authorization bounds check: Only Placement Sources can CREATE company workspaces
    const sourceConfig = await EmailSource.findOne({
        userId,
        email: senderEmail.toLowerCase(),
        isActive: true
    });

    if (!sourceConfig || sourceConfig.type !== "placement") {
        return {
            workspace: null,
            company,
            action: "IGNORE",
            reasonCode: "WORKSPACE_NOT_FOUND",
            reason: `Student update or unconfigured source cannot create a new workspace for "${company.name}".`
        };
    }

    // Initialize new User Workspace
    workspace = await UserCompany.create({
        userId,
        companyId: company._id,
        canonicalCompanyName: company.name,
        status: "Active",
        notes: "",
        currentRound: "Registration Open",
        progress: 0,
        requiredDocuments: [],
        importantInstructions: []
    });

    console.log(`Successfully initialized UserCompany workspace for user and company: "${company.name}"`);
    return {
        workspace,
        company,
        action: "CREATE_WORKSPACE",
        reasonCode: "COMPANY_CREATED",
        reason: `New workspace created for "${company.name}".`
    };
};

module.exports = {
    resolveWorkspace
};
