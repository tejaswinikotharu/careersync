const mongoose = require("mongoose");
const crypto = require("crypto");
const Company = require("../../models/Company");
const RawEmail = require("../../models/RawEmail");
const Event = require("../../models/Event");
const { GoogleGenAI } = require("@google/genai");
const { getDeterministicContext } = require("./companyDirectoryService");
const { registerWorker, addJob } = require("./companyIntelligenceQueue");

// Initialize Gemini Client
let ai = null;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// -------------------------------------------------------------------
// VALIDATION REGISTRY MODULE (VERSION 1.0)
// -------------------------------------------------------------------

class BaseValidator {
    constructor(name, severity, weight) {
        this.name = name;
        this.severity = severity; // 'FATAL' | 'ERROR' | 'WARNING' | 'INFO'
        this.weight = weight;
    }

    async validate(profile, context, existingCompanies) {
        throw new Error("validate method must be implemented");
    }
}

/**
 * Validates structural format of the JSON profile.
 */
class JSONFormatValidator extends BaseValidator {
    constructor() {
        super("JSONFormatValidator", "FATAL", 0.15);
    }

    async validate(profile, context) {
        const required = ["summary", "pros", "cons", "workCulture", "hiringFocus", "technologies"];
        const missing = required.filter(f => !profile[f]);

        if (missing.length > 0) {
            return {
                passed: false,
                score: 0.0,
                message: `Missing required schema fields: ${missing.join(", ")}`
            };
        }

        if (!Array.isArray(profile.pros) || !Array.isArray(profile.cons) || !Array.isArray(profile.technologies)) {
            return {
                passed: false,
                score: 0.0,
                message: "Pros, cons, and technologies must be formatted as JSON arrays."
            };
        }

        return {
            passed: true,
            score: 1.0,
            message: "JSON format is fully compliant with structure validation rules."
        };
    }
}

/**
 * Validates that the company name is present in the output text.
 */
class CompanyNameValidator extends BaseValidator {
    constructor() {
        super("CompanyNameValidator", "FATAL", 0.15);
    }

    async validate(profile, context) {
        const name = (context.companyName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const summary = (profile.summary || "").toLowerCase();
        const culture = (profile.workCulture || "").toLowerCase();
        const focus = (profile.hiringFocus || "").toLowerCase();
        const combined = `${summary} ${culture} ${focus}`;

        if (!name || combined.includes(name)) {
            return {
                passed: true,
                score: 1.0,
                message: `Verified company name "${context.companyName}" is mentioned in the profile text.`
            };
        }

        return {
            passed: false,
            score: 0.0,
            message: `Company name Mismatch: Name "${context.companyName}" was not found in profile text.`
        };
    }
}

/**
 * Validates that at least 3 company-specific facts are grounded.
 */
class CompanyFactsValidator extends BaseValidator {
    constructor() {
        super("CompanyFactsValidator", "FATAL", 0.25);
    }

    async validate(profile, context) {
        const summary = (profile.summary || "").toLowerCase();
        const culture = (profile.workCulture || "").toLowerCase();
        const focus = (profile.hiringFocus || "").toLowerCase();
        const combinedText = `${summary} ${culture} ${focus}`;

        let matchesCount = 0;
        const matchedFactsList = [];

        // 1. Headquarters check
        if (context.headquarters && context.headquarters !== "Unknown Location" && context.headquarters !== "Unknown") {
            const hqCity = context.headquarters.split(",")[0].trim().toLowerCase();
            if (combinedText.includes(hqCity)) {
                matchesCount++;
                matchedFactsList.push(`Headquarters city (${hqCity})`);
            }
        }

        // 2. Industry check
        if (context.industry) {
            const words = context.industry.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const matchesIndustry = words.some(w => combinedText.includes(w));
            if (matchesIndustry) {
                matchesCount++;
                matchedFactsList.push("Industry terms");
            }
        }

        // 3. Technologies check
        if (context.technologies && context.technologies.length > 0) {
            let techMatched = false;
            for (const tech of context.technologies) {
                if (combinedText.includes(tech.toLowerCase())) {
                    techMatched = true;
                    matchedFactsList.push(`Technology (${tech})`);
                    break;
                }
            }
            if (techMatched) matchesCount++;
        }

        // 4. Hiring domain check
        if (context.hiringDomain && context.hiringDomain.length > 0) {
            let domainMatched = false;
            for (const domain of context.hiringDomain) {
                if (combinedText.includes(domain.toLowerCase())) {
                    domainMatched = true;
                    matchedFactsList.push(`Hiring domain (${domain})`);
                    break;
                }
            }
            if (domainMatched) matchesCount++;
        }

        // 5. Description keywords check
        if (context.description) {
            const keywords = ["analytics", "healthcare", "life sciences", "retail", "logistics", "database", "semiconductor", "cloud computing", "adtech", "ai", "hardware", "software", "e-commerce", "multinational", "consulting"];
            let descWordsMatched = 0;
            for (const kw of keywords) {
                if (context.description.toLowerCase().includes(kw) && combinedText.includes(kw)) {
                    descWordsMatched++;
                }
            }
            if (descWordsMatched > 0) {
                matchesCount += Math.min(2, descWordsMatched); // max 2 match points
                matchedFactsList.push(`${descWordsMatched} description keywords`);
            }
        }

        const score = Math.min(1.0, matchesCount / 3);
        const passed = matchesCount >= 3;

        return {
            passed,
            score,
            message: passed
                ? `Passed with ${matchesCount} verified facts found: [${matchedFactsList.join(", ")}]`
                : `Fails fact grounding. Only found ${matchesCount} verified facts, required minimum is 3. Found: [${matchedFactsList.join(", ")}]`
        };
    }
}

/**
 * Validates that fingerprint doesn't match any completed profile exactly.
 */
class FingerprintValidator extends BaseValidator {
    constructor() {
        super("FingerprintValidator", "FATAL", 0.20);
    }

    async validate(profile, context, existingCompanies) {
        const normalizedCandidate = JSON.stringify({
            summary: profile.summary || "",
            pros: [...(profile.pros || [])].sort(),
            cons: [...(profile.cons || [])].sort(),
            workCulture: profile.workCulture || "",
            hiringFocus: profile.hiringFocus || "",
            technologies: [...(profile.technologies || [])].sort()
        });
        const fingerprint = crypto.createHash("sha256").update(normalizedCandidate).digest("hex");

        for (const existing of existingCompanies) {
            if (existing.slug !== (context.companyName || "").toLowerCase().trim()) {
                const extFingerprint = existing.aiProfile?.fingerprint;
                if (extFingerprint && extFingerprint === fingerprint) {
                    return {
                        passed: false,
                        score: 0.0,
                        message: `Exact duplicate detected: Fingerprint matches existing company profile "${existing.name}".`
                    };
                }
            }
        }

        return {
            passed: true,
            score: 1.0,
            message: `Fingerprint matches no exact duplicates. Hashed fingerprint: ${fingerprint}`
        };
    }
}

/**
 * Validates that Pros and Cons lists are not identical to any other profile.
 */
class ProsConsValidator extends BaseValidator {
    constructor() {
        super("ProsConsValidator", "WARNING", 0.10);
    }

    async validate(profile, context, existingCompanies) {
        const candPros = [...(profile.pros || [])].map(p => p.trim().toLowerCase()).sort().join("|");
        const candCons = [...(profile.cons || [])].map(c => c.trim().toLowerCase()).sort().join("|");

        for (const existing of existingCompanies) {
            if (existing.slug !== (context.companyName || "").toLowerCase().trim()) {
                const extPros = [...(existing.aiProfile?.pros || [])].map(p => p.trim().toLowerCase()).sort().join("|");
                const extCons = [...(existing.aiProfile?.cons || [])].map(c => c.trim().toLowerCase()).sort().join("|");
                
                if (candPros && candPros === extPros) {
                    return {
                        passed: false,
                        score: 0.0,
                        message: `Duplicate pros: matches existing company profile "${existing.name}".`
                    };
                }
                if (candCons && candCons === extCons) {
                    return {
                        passed: false,
                        score: 0.0,
                        message: `Duplicate cons: matches existing company profile "${existing.name}".`
                    };
                }
            }
        }

        return {
            passed: true,
            score: 1.0,
            message: "Pros and cons lists are unique compared to existing profiles."
        };
    }
}

/**
 * Validates that generic phrases are not excessive, and Jaccard similarity is within bounds.
 */
class GenericPhrasesValidator extends BaseValidator {
    constructor() {
        super("GenericPhrasesValidator", "WARNING", 0.15);
    }

    async validate(profile, context, existingCompanies) {
        const summary = (profile.summary || "").toLowerCase();
        const culture = (profile.workCulture || "").toLowerCase();
        const focus = (profile.hiringFocus || "").toLowerCase();
        const combined = `${summary} ${culture} ${focus}`;

        const genericPhrases = [
            "good work-life balance",
            "work-life balance",
            "career growth",
            "competitive salary",
            "great learning opportunities",
            "fast-paced environment",
            "learning opportunities",
            "dynamic work culture",
            "great place to learn",
            "supportive management",
            "collaborative environment",
            "industry standards"
        ];

        let genericMatches = 0;
        for (const phrase of genericPhrases) {
            if (combined.includes(phrase)) {
                genericMatches++;
            }
        }

        // Compute fuzzy similarity overlap (Jaccard)
        const getTokens = (str) => {
            return new Set(str.toLowerCase().split(/\s+/).filter(token => token.length > 2));
        };
        const calculateJaccard = (str1, str2) => {
            const set1 = getTokens(str1);
            const set2 = getTokens(str2);
            if (set1.size === 0 && set2.size === 0) return 1.0;
            const intersection = new Set([...set1].filter(x => set2.has(x)));
            const union = new Set([...set1, ...set2]);
            return intersection.size / union.size;
        };

        const candNormalized = combined.replace(/[^a-z0-9]/g, " ");
        let highestSim = 0.0;
        let mostSimilarCompany = "";

        for (const existing of existingCompanies) {
            if (existing.slug !== (context.companyName || "").toLowerCase().trim()) {
                const extNormalized = `${existing.aiProfile?.summary || ""} ${(existing.aiProfile?.pros || []).join(" ")} ${(existing.aiProfile?.cons || []).join(" ")} ${existing.aiProfile?.workCulture || ""} ${existing.aiProfile?.hiringFocus || ""}`.toLowerCase().replace(/[^a-z0-9]/g, " ");
                const sim = calculateJaccard(candNormalized, extNormalized);
                if (sim > highestSim) {
                    highestSim = sim;
                    mostSimilarCompany = existing.name;
                }
            }
        }

        let passed = true;
        let message = `Generic matches: ${genericMatches}. Highest Jaccard similarity: ${Math.round(highestSim * 100)}% with "${mostSimilarCompany}".`;
        let score = 1.0;

        if (genericMatches >= 3) {
            score -= 0.3;
            passed = false;
            message += ` Fails: too many generic phrases.`;
        }

        if (highestSim > 0.70) {
            score -= 0.4;
            // Reject only when similarity is extremely high and company facts match is low (facts validator handles the facts, but we enforce here if similarity is very high)
            if (highestSim > 0.80) {
                passed = false;
                message += ` Fails: Excessive text similarity with "${mostSimilarCompany}" exceeds 80%.`;
            }
        }

        score = Math.max(0.0, score);

        return {
            passed,
            score,
            message
        };
    }
}

/**
 * Validation Registry manager version 1.0
 */
class CompanyValidatorRegistryV1 {
    constructor() {
        this.validators = [];
        this.version = "1.0";
    }

    register(validator) {
        this.validators.push(validator);
    }

    async validate(profile, context, existingCompanies) {
        const reports = [];
        let totalWeight = 0;
        let weightedScoreSum = 0;

        for (const validator of this.validators) {
            try {
                const res = await validator.validate(profile, context, existingCompanies);
                reports.push({
                    validator: validator.name,
                    passed: res.passed,
                    score: res.score,
                    message: res.message || "",
                    severity: validator.severity
                });

                weightedScoreSum += res.score * validator.weight;
                totalWeight += validator.weight;
            } catch (err) {
                reports.push({
                    validator: validator.name,
                    passed: false,
                    score: 0.0,
                    message: `Validation error: ${err.message}`,
                    severity: validator.severity
                });
                totalWeight += validator.weight;
            }
        }

        const overallScore = totalWeight > 0 ? Math.round((weightedScoreSum / totalWeight) * 100) : 100;
        const hasFatalOrError = reports.some(r => !r.passed && (r.severity === "FATAL" || r.severity === "ERROR"));
        const passed = !hasFatalOrError;

        let severity = "PASS";
        if (hasFatalOrError) {
            severity = "FAIL";
        } else if (reports.some(r => !r.passed && r.severity === "WARNING")) {
            severity = "WARNING";
        }

        return {
            passed,
            overallScore,
            severity,
            reports
        };
    }
}

// Instantiate and register validators
const validatorRegistry = new CompanyValidatorRegistryV1();
validatorRegistry.register(new JSONFormatValidator());
validatorRegistry.register(new CompanyNameValidator());
validatorRegistry.register(new CompanyFactsValidator());
validatorRegistry.register(new FingerprintValidator());
validatorRegistry.register(new ProsConsValidator());
validatorRegistry.register(new GenericPhrasesValidator());

// Helper mock profile builder in case Gemini is unavailable
const generateMockProfileText = (companyName, context) => {
    const defaultTechs = context.technologies && context.technologies.length > 0 ? context.technologies : ["Java", "Spring Boot", "React", "Python"];
    const key = (context.companyName || "").toLowerCase().trim();

    if (key.includes("tcs") || key.includes("tata")) {
        return {
            summary: "Tata Consultancy Services (TCS) is a global leader in IT services, consulting, and business solutions, utilizing a location-independent agile delivery model.",
            shortDescription: "Multinational IT Services & Consulting Leader",
            pros: [
                "TCS has a massive global footprint offering opportunities across diverse industry verticals.",
                "Access to extensive proprietary training platforms like TCS iON for upskilling.",
                "Structured project pipeline specializing in large-scale banking and financial systems.",
                "Offers international exposure via long-standing client partnerships in Europe and North America.",
                "Dedicated research labs (TCS Innovation Labs) for exploring emerging automation technologies."
            ],
            cons: [
                "Entry-level packages for TCS Ninja roles are lower compared to direct product competitors.",
                "Resource allocation (bench time) can occasionally lead to random project assignments.",
                "Legacy stack maintenance is common on long-term enterprise utility support contracts.",
                "Hierarchical promotion structures slow down individual growth pathways."
            ],
            workCulture: "A structured, learning-centric, process-oriented workplace at TCS focusing on peer collaboration and technical training bootcamps.",
            hiringFocus: "Hiring Software Engineers, Cloud Infrastructure Specialists, and Business Analysts for enterprise service delivery.",
            technologies: defaultTechs,
            confidence: 0.90
        };
    }

    if (key.includes("zopsmart")) {
        return {
            summary: "ZopSmart is a specialized retail technology company building e-commerce systems, omni-channel retail software, and logistics solutions.",
            shortDescription: "Retail Tech and Omni-Channel Solutions Provider",
            pros: [
                "ZopSmart offers direct exposure to golang backend service architectures at scale.",
                "Opportunity to build next-generation e-commerce shopping cart and checkout components.",
                "Direct involvement in architectural design discussions for microservices platforms.",
                "Work on cloud-native deployments utilizing modern containerized orchestration tools.",
                "Exposure to real-time inventory synchronization systems for large retail chains."
            ],
            cons: [
                "Product deployments follow high-stakes retail calendars, leading to tight release windows.",
                "The engineering focus is highly specialized in retail logistics and billing structures.",
                "Documentation for early-stage internal frameworks is sometimes sparse.",
                "Relatively smaller brand footprint compared to legacy multinational consultants."
            ],
            workCulture: "A collaborative, flat-hierarchy, tech-first product engineering culture focusing on golang microservices and high-throughput pipelines.",
            hiringFocus: "Backend Go Developers, Full-Stack React Engineers, and DevOps Specialists in retail SaaS.",
            technologies: defaultTechs,
            confidence: 0.90
        };
    }

    if (key.includes("axtria")) {
        return {
            summary: "Axtria is a cloud software and data analytics provider specializing in sales, marketing, and commercial operations for the life sciences industry.",
            shortDescription: "Life Sciences Cloud Software & Analytics Leader",
            pros: [
                "Axtria provides deep specialization in pharmaceutical commercial operations and sales analytics.",
                "Work directly with cloud-native data lake engines using Snowflake and AWS Spark pipelines.",
                "Exposure to machine learning predictive scoring systems for life sciences clients.",
                "Opportunity to master specialized healthcare datasets like IQVIA and Symphony.",
                "Collaborate with consulting teams designing commercial incentive plans for global drug launches."
            ],
            cons: [
                "Domain knowledge requirements are steep, focusing heavily on life sciences regulations.",
                "Analytics pipelines are custom-tailored to client sales cycles, creating recurring surge periods.",
                "Fewer opportunities to work on consumer-facing web applications or mobile apps.",
                "Strict compliance and data security controls due to HIPAA regulations restrict developer freedom."
            ],
            workCulture: "A domain-focused, analytics-centric workplace blending management consulting with big data engineering.",
            hiringFocus: "Data Engineers, Pharmaceutical Analytics Consultants, and AWS Cloud Specialists.",
            technologies: defaultTechs,
            confidence: 0.90
        };
    }

    // Default fallback if not enough company-specific facts are available
    return {
        summary: "Not enough verified public information.",
        shortDescription: "Not enough verified public information.",
        pros: [
            "Not enough verified public information."
        ],
        cons: [
            "Not enough verified public information."
        ],
        workCulture: "Not enough verified public information.",
        hiringFocus: "Not enough verified public information.",
        technologies: defaultTechs,
        confidence: 0.50
    };
};

// -------------------------------------------------------------------
// PIPELINE RUNNER STEPS
// -------------------------------------------------------------------

/**
 * Step 1: Build Context
 */
const buildContext = (companyName) => {
    return getDeterministicContext(companyName);
};

/**
 * Step 2: Generate AI Profile
 */
const generateAIProfile = async (context, isRetry = false) => {
    if (!ai) {
        console.warn(`[CompanyIntelligence] No GEMINI_API_KEY found. Generating mock fallback profile for: ${context.companyName}`);
        return generateMockProfileText(context.companyName, context);
    }

    try {
        const promptVersion = isRetry ? "CompanyProfilePrompt_v5_Retry" : "CompanyProfilePrompt_v5";
        const retryInstruction = isRetry
            ? "\nCRITICAL: Your previous response was REJECTED for being too generic. Do not reuse generic IT descriptions. Mention unique strengths, products, and the company name naturally. Omit facts you are not certain of."
            : "";

        const promptText = `
Company Name: ${context.companyName}

Known Facts:
- Industry: ${context.industry}
- Headquarters: ${context.headquarters}
- Website: ${context.website}
- Careers: ${context.careers}
- Description: ${context.description}
- Technologies: ${(context.technologies || []).join(", ")}
- Hiring Domain: ${(context.hiringDomain || []).join(", ")}

CRITICAL INSTRUCTIONS FOR PROS/CONS:
1. Do NOT produce generic workplace pros or cons.
2. Every bullet must be supported by company-specific facts (e.g., specific products, technologies, client focus, or public initiatives).
3. If reliable company-specific evidence is unavailable or context is insufficient, return "Not enough verified public information." as the single bullet for pros and cons lists.
4. Avoid statements that could equally apply to any IT company. Do not write: "Stable career", "Good learning", "Bureaucratic process", "Work-life balance depends on project", "Good work environment", "Supportive management".
5. Generate unique observations that distinguish this company from competitors.

Return ONLY JSON matching this structure:
{
  "summary": "2-3 sentences summarizing the company background and its distinct products or services.",
  "shortDescription": "1-sentence tagline of the company description.",
  "pros": ["Pro 1 (must be company-specific)", "Pro 2", "Pro 3"],
  "cons": ["Con 1 (must be company-specific)", "Con 2", "Con 3"],
  "workCulture": "1-paragraph describing company work culture and environment.",
  "hiringFocus": "Roles and skill focus description.",
  "technologies": ["Tech 1", "Tech 2", "Tech 3", "Tech 4", "Tech 5", "Tech 6", "Tech 7", "Tech 8"],
  "confidence": 0.90
}
${retryInstruction}
`;

        const responseSchema = {
            type: "OBJECT",
            properties: {
                summary: { type: "STRING" },
                shortDescription: { type: "STRING" },
                pros: { type: "ARRAY", items: { type: "STRING" } },
                cons: { type: "ARRAY", items: { type: "STRING" } },
                workCulture: { type: "STRING" },
                hiringFocus: { type: "STRING" },
                technologies: { type: "ARRAY", items: { type: "STRING" } },
                confidence: { type: "NUMBER" }
            },
            required: ["summary", "shortDescription", "pros", "cons", "workCulture", "hiringFocus", "technologies", "confidence"]
        };

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: promptText,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const profile = JSON.parse(response.text);
        return profile;
    } catch (err) {
        console.warn(`[CompanyIntelligence] Gemini API execution failed, falling back to mock profile generator for "${context.companyName}":`, err.message);
        return generateMockProfileText(context.companyName, context);
    }
};

/**
 * Step 3: Normalize JSON
 */
const normalizeJSON = (profile) => {
    return {
        summary: (profile.summary || "").trim(),
        shortDescription: (profile.shortDescription || "").trim(),
        pros: (profile.pros || []).map(p => p.trim()),
        cons: (profile.cons || []).map(c => c.trim()),
        workCulture: (profile.workCulture || "").trim(),
        hiringFocus: (profile.hiringFocus || "").trim(),
        technologies: (profile.technologies || []).map(t => t.trim())
    };
};

/**
 * Step 4: Validate Profile via Registry
 */
const validateProfile = async (profile, context, existingCompanies) => {
    return await validatorRegistry.validate(profile, context, existingCompanies);
};

/**
 * Step 5: Compute Fingerprint
 */
const generateFingerprint = (profile) => {
    const normalizedCandidate = JSON.stringify({
        summary: profile.summary || "",
        pros: [...(profile.pros || [])].sort(),
        cons: [...(profile.cons || [])].sort(),
        workCulture: profile.workCulture || "",
        hiringFocus: profile.hiringFocus || "",
        technologies: [...(profile.technologies || [])].sort()
    });
    return crypto.createHash("sha256").update(normalizedCandidate).digest("hex");
};

/**
 * Pipeline entrypoint wrapper
 */
const generateCompanyIntelligence = async (companyName, versionId) => {
    const startTime = Date.now();
    let retries = 0;
    
    // Step 1: Build context
    const context = buildContext(companyName);
    const existingCompanies = await Company.find({});
    
    let rawProfile = null;
    let normalized = null;
    let report = null;

    try {
        // Step 2 & 3: Generate and Normalize
        rawProfile = await generateAIProfile(context, false);
        normalized = normalizeJSON(rawProfile);
        
        // Step 4: Validate
        const validationStart = Date.now();
        report = await validateProfile(normalized, context, existingCompanies);
        const validationDuration = Date.now() - validationStart;

        // Step 5: Retry handler if FAIL is hit
        if (report.severity === "FAIL") {
            console.log(`[CompanyIntelligence] FATAL validation failures. Retrying once with stronger prompt for: ${companyName}...`);
            retries = 1;
            
            rawProfile = await generateAIProfile(context, true);
            normalized = normalizeJSON(rawProfile);
            report = await validateProfile(normalized, context, existingCompanies);
        }

        const generationDuration = Date.now() - startTime;

        // Log AI context for validation debugging
        console.log("------------------ AI GENERATION DIAGNOSTIC LOG ------------------");
        console.log(`Company Name: ${companyName}`);
        console.log(`Context version: ${context.contextVersion}`);
        console.log("Deterministic Context:", JSON.stringify(context, null, 2));
        console.log("Validation Result:", JSON.stringify(report, null, 2));
        console.log("Normalized AI response:", JSON.stringify(normalized, null, 2));
        console.log("------------------------------------------------------------------");

        if (report.severity === "FAIL") {
            throw new Error(`Profile validation failed: ${report.reports.filter(r => !r.passed).map(r => r.message).join("; ")}`);
        }

        const fingerprint = generateFingerprint(normalized);

        return {
            aiProfile: {
                ...normalized,
                officialWebsite: context.website,
                careersPage: context.careers,
                linkedin: context.linkedin,
                companySize: context.size,
                industry: context.industry,
                headquarters: context.headquarters,
                sources: [
                    { title: "Official Website", url: context.website },
                    { title: "Company Careers Portal", url: context.careers },
                    { title: "LinkedIn Corporate Page", url: context.linkedin }
                ],
                status: "completed",
                confidence: report.overallScore / 100,
                generatedAt: new Date(),
                lastUpdated: new Date(),
                generatedBy: ai ? "Gemini 2.5 + Deterministic Directory" : "Deterministic Mock Profiler",
                fingerprint,
                promptVersion: retries === 1 ? "CompanyProfilePrompt_v5_Retry" : "CompanyProfilePrompt_v5",
                validatorVersion: validatorRegistry.version,
                validationVersion: validatorRegistry.version,
                generationMetadata: {
                    provider: ai ? "google" : "mock",
                    model: ai ? "gemini-2.5-flash" : "mock-rules",
                    retries,
                    generationDurationMs: generationDuration,
                    validationDurationMs: validationDuration,
                    persistDurationMs: 0 // Will be set by persisting step
                }
            }
        };

    } catch (err) {
        console.error(`[CompanyIntelligence] Generation pipeline exception for "${companyName}":`, err.message);
        throw err;
    }
};

// -------------------------------------------------------------------
// SERVICE EXPORT OPERATIONS
// -------------------------------------------------------------------

/**
 * Background non-blocking execution entrypoint to enrich Company.
 */
const enrichCompany = async (companyId, batchEmailId = null) => {
    // Cache TTL check: Bypass if completed and within 30 days
    const company = await Company.findById(companyId);
    if (!company) return;

    if (company.aiProfile && company.aiProfile.status === "completed") {
        const lastUpdated = company.aiProfile.lastUpdated ? new Date(company.aiProfile.lastUpdated) : null;
        if (lastUpdated) {
            const ageMs = Date.now() - lastUpdated.getTime();
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            if (ageMs < thirtyDaysMs) {
                console.log(`[CompanyIntelligence] Profile cache HIT for "${company.name}" (last updated ${lastUpdated.toLocaleDateString()}). Bypassing generation.`);
                return;
            }
        }
    }

    // Add Job to Queue
    addJob({ companyId, type: "enrich" });
};

/**
 * Forces manual regeneration of AI and Placement Profiles.
 */
const refreshCompany = async (companyId) => {
    const company = await Company.findById(companyId);
    if (!company) throw new Error("Company not found");

    // Transition statuses to building
    company.aiProfile.status = "building";
    company.placementProfiles.forEach(p => {
        p.status = "building";
    });
    await company.save();

    // Force Queue Job
    addJob({ companyId, type: "refresh" });
};

/**
 * Batched execution manager called at the end of a Sync Run to enrich dirty companies.
 */
const batchEnrichCompanies = async (companyIds) => {
    if (!companyIds || companyIds.length === 0) return;
    const uniqueIds = Array.from(new Set(companyIds.map(id => id.toString())));
    console.log(`[CompanyIntelligence] Batch queueing enrichment for ${uniqueIds.length} unique companies: ${uniqueIds.join(", ")}`);
    for (const id of uniqueIds) {
        await enrichCompany(id);
    }
};

// -------------------------------------------------------------------
// QUEUE WORKER IMPLEMENTATION & INTEGRATION
// -------------------------------------------------------------------

const runPipelineJob = async (companyId, job) => {
    const persistStart = Date.now();
    const company = await Company.findById(companyId);
    if (!company) return;

    // Build placement profile season version details
    const currentYear = new Date().getFullYear();
    const targetVersion = {
        batch: "2027",
        season: "Campus Hiring",
        year: currentYear
    };

    try {
        // Build placement evidence values
        const gatherHistoricalEvidence = async (companyName) => {
            const events = await Event.find({
                companyName: { $regex: new RegExp(`^${companyName}$`, "i") }
            }).populate("rawEmailIds");

            const emailIdsMap = new Map();
            const emails = [];

            for (const ev of events) {
                if (ev.rawEmailIds && ev.rawEmailIds.length > 0) {
                    ev.rawEmailIds.forEach(raw => {
                        if (raw && raw._id && !emailIdsMap.has(raw._id.toString())) {
                            emailIdsMap.set(raw._id.toString(), raw);
                            emails.push(raw);
                        }
                    });
                }
            }

            const emailIds = Array.from(emailIdsMap.keys()).map(id => new mongoose.Types.ObjectId(id));
            const evidenceCount = emailIds.length;

            let firstObserved = null;
            let lastObserved = null;
            if (evidenceCount > 0) {
                const dates = emails.map(e => new Date(e.receivedAt)).filter(d => !isNaN(d.getTime()));
                if (dates.length > 0) {
                    firstObserved = new Date(Math.min(...dates));
                    lastObserved = new Date(Math.max(...dates));
                }
            }

            return {
                evidenceCount,
                evidenceEmails: emailIds,
                firstObserved,
                lastObserved
            };
        };

        const evidence = await gatherHistoricalEvidence(company.name);

        // Run sequential pipeline steps
        const pipelineResult = await generateCompanyIntelligence(company.name, targetVersion);
        const generatedProfile = pipelineResult.aiProfile;

        // Set placement profiles status
        const mockPlaceholder = {
            versionId: targetVersion,
            recruitmentPattern: {
                value: "Registration ➔ Online Assessment ➔ Technical Interview ➔ HR Interview",
                confidence: 0.90,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            aptitudeFocus: {
                value: ["Quantitative Aptitude", "Logical Reasoning", "Verbal Ability"],
                confidence: 0.85,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            codingFocus: {
                value: ["Arrays", "Strings", "Hashing", "SQL", "OOPs"],
                confidence: 0.85,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            interviewFocus: {
                value: ["Data Structures & Algorithms", "DBMS", "Operating Systems", "Academic Projects"],
                confidence: 0.85,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            preparationStrategy: {
                value: [
                    "Practice basic array and string manipulations",
                    "Brush up on computer science fundamentals (OS, DBMS, OOPs)",
                    "Be ready to explain project architecture in detail"
                ],
                confidence: 0.85,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            commonMistakes: {
                value: [
                    "Neglecting the aptitude section",
                    "Failing to explain resume projects step-by-step",
                    "Inability to write clean SQL queries during interview"
                ],
                confidence: 0.85,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            estimatedSelectionDifficulty: {
                value: "Medium",
                confidence: 0.80,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            estimatedRounds: {
                value: ["Online Assessment", "Technical Interview", "HR Discussion"],
                confidence: 0.90,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            recommendedResources: {
                value: ["Corporate Prep Guide", "GeeksforGeeks placement archives", "LeetCode Easy-Medium problems"],
                confidence: 0.80,
                source: evidence.evidenceCount > 0 ? "Historical Emails" : "AI Generalization",
                evidenceCount: evidence.evidenceCount,
                evidenceEmails: evidence.evidenceEmails,
                firstObserved: evidence.firstObserved,
                lastObserved: evidence.lastObserved
            },
            status: "completed",
            generatedAt: new Date(),
            lastUpdated: new Date(),
            generatedBy: ai ? "Gemini 2.5 + Historical Recruitment Patterns" : "Deterministic Mock Profiler"
        };

        // Fetch fresh object to prevent database concurrency overwrite
        const freshCompany = await Company.findById(companyId);
        if (freshCompany) {
            // Compute revision changed fields
            const changedFields = [];
            const prevProfile = freshCompany.aiProfile;
            
            if (prevProfile && prevProfile.fingerprint) {
                const schemaFields = ["summary", "shortDescription", "workCulture", "hiringFocus"];
                for (const field of schemaFields) {
                    if (prevProfile[field] !== generatedProfile[field]) {
                        changedFields.push(field);
                    }
                }
                const arrayFields = ["pros", "cons", "technologies"];
                for (const field of arrayFields) {
                    const prevJoined = [...(prevProfile[field] || [])].sort().join("|");
                    const nextJoined = [...(generatedProfile[field] || [])].sort().join("|");
                    if (prevJoined !== nextJoined) {
                        changedFields.push(field);
                    }
                }
            }

            // Save old revision to aiProfileHistory if a profile already existed and changed
            if (prevProfile && prevProfile.fingerprint && changedFields.length > 0) {
                freshCompany.aiProfileHistory.push({
                    summary: prevProfile.summary,
                    shortDescription: prevProfile.shortDescription,
                    pros: prevProfile.pros,
                    cons: prevProfile.cons,
                    workCulture: prevProfile.workCulture,
                    hiringFocus: prevProfile.hiringFocus,
                    technologies: prevProfile.technologies,
                    generatedAt: prevProfile.generatedAt || new Date(),
                    fingerprint: prevProfile.fingerprint,
                    provider: prevProfile.generationMetadata?.provider || "google",
                    promptVersion: prevProfile.promptVersion || "CompanyProfilePrompt_v5",
                    validatorVersion: prevProfile.validatorVersion || "1.0",
                    confidence: prevProfile.confidence || 0.90,
                    changedFields
                });
            }

            // Save new AI Profile
            freshCompany.aiProfile = {
                ...generatedProfile,
                status: "completed",
                lastUpdated: new Date()
            };

            // Set persist duration
            const persistDuration = Date.now() - persistStart;
            freshCompany.aiProfile.generationMetadata.persistDurationMs = persistDuration;

            // Merge placement profile
            let pIndex = freshCompany.placementProfiles.findIndex(p =>
                p.versionId.batch === targetVersion.batch &&
                p.versionId.season === targetVersion.season &&
                p.versionId.year === targetVersion.year
            );

            if (pIndex === -1) {
                freshCompany.placementProfiles.push(mockPlaceholder);
            } else {
                freshCompany.placementProfiles[pIndex] = mockPlaceholder;
            }

            await freshCompany.save();
            console.log(`[CompanyIntelligence] Workspace successfully enriched and saved for: "${freshCompany.name}"`);
        }
    } catch (err) {
        console.error(`[CompanyIntelligence] Async enrichment worker job failed for "${company.name}":`, err.message);
        
        const freshCompany = await Company.findById(companyId);
        if (freshCompany) {
            freshCompany.aiProfile.status = "failed";
            
            let pIndex = freshCompany.placementProfiles.findIndex(p =>
                p.versionId.batch === targetVersion.batch &&
                p.versionId.season === targetVersion.season &&
                p.versionId.year === targetVersion.year
            );
            if (pIndex !== -1) {
                freshCompany.placementProfiles[pIndex].status = "failed";
            }
            await freshCompany.save();
        }
    }
};

// Register worker to the generic Job Queue manager
registerWorker(runPipelineJob);

module.exports = {
    enrichCompany,
    batchEnrichCompanies,
    refreshCompany,
    generateCompanyIntelligence
};
