const RawEmail = require("../../models/RawEmail");
const Placement = require("../../models/Placement");
const Company = require("../../models/Company");
const UserCompany = require("../../models/UserCompany");
const StudentUpdate = require("../../models/StudentUpdate");
const EmailProcessingLog = require("../../models/EmailProcessingLog");
const { parseStructuredEmail } = require("../../parser/structuredParser");
const { resolveWorkspace } = require("../workspaceResolver");
const { resolveEvent } = require("../eventResolver");

// Import automation modules
const { createNotificationFromAI } = require("./notificationService");

/**
 * Executes the entire email parsing, resolution, aggregation, and AI enrichment pipeline.
 * 
 * @param {string} emailId - ID of the RawEmail document
 * @param {string} syncRunId - ID of the active SyncRun document
 * @returns {Promise<Object>} Ingestion result summary
 */
const processEmailWithAI = async (emailId, syncRunId, sourceConfig = null) => {
    // 1. Fetch raw email
    const rawEmail = await RawEmail.findById(emailId);
    if (!rawEmail) {
        throw new Error("RawEmail not found in database.");
    }

    const extractEmailAddress = (senderStr) => {
        const match = senderStr.match(/<([^>]+)>/);
        return match ? match[1].trim().toLowerCase() : senderStr.trim().toLowerCase();
    };
    const senderEmail = extractEmailAddress(rawEmail.sender);

    // 2. Structured deterministic parser first
    const parsed = await parseStructuredEmail(rawEmail);
    parsed.userId = rawEmail.userId;

    // Check if the sender is a Student Update source
    let source = sourceConfig;
    if (!source) {
        const EmailSource = require("../../models/EmailSource");
        source = await EmailSource.findOne({
            userId: rawEmail.userId,
            email: senderEmail.toLowerCase(),
            isActive: true
        });
    }

    if (source && source.type === "update") {
        // --- STUDENT UPDATE PIPELINE ---
        const studentUpdate = await StudentUpdate.create({
            userId: rawEmail.userId,
            company: parsed.company || "Unknown",
            category: parsed.eventType || "General Notice",
            sourceType: source.type || "update",
            eventType: parsed.eventType || "General Notice",
            title: parsed.title || rawEmail.subject,
            date: parsed.date || new Date(),
            summary: rawEmail.snippet || "",
            rawEmailId: rawEmail._id
        });

        rawEmail.processed = true;
        await rawEmail.save();

        await EmailProcessingLog.create({
            userId: rawEmail.userId,
            syncRunId,
            sender: rawEmail.sender,
            subject: rawEmail.subject,
            companyDetected: parsed.company || "Unknown",
            category: "Student Update",
            workspaceFound: false,
            action: "UPDATE_WORKSPACE",
            reasonCode: "WORKSPACE_UPDATED",
            reason: `Successfully processed Student Update email: "${rawEmail.subject}"`
        });

        // Real-Time Socket Updates
        try {
            const { sendRealTimeUpdate } = require("../../config/socket");
            sendRealTimeUpdate(rawEmail.userId, "student_update_created", studentUpdate);
            sendRealTimeUpdate(rawEmail.userId, "email_analyzed", {
                id: rawEmail._id,
                company: parsed.company || "Unknown",
                sender: rawEmail.sender,
                subject: rawEmail.subject,
                snippet: rawEmail.snippet,
                body: rawEmail.plainText || rawEmail.html || "",
                receivedAt: rawEmail.receivedAt,
                category: parsed.eventType || "General Notice",
            });
        } catch (socketErr) {
            console.warn("Socket update failed for student update:", socketErr.message);
        }

        return {
            action: "CREATE_UPDATE",
            reasonCode: "STUDENT_UPDATE_CREATED",
            reason: "Student update created successfully",
            category: parsed.eventType || "General Notice",
            companyDetected: parsed.company || "Unknown",
            workspaceFound: false
        };
    }

    // 3. Resolve Workspace (separate global vs user workspace tracking levels)
    const resolution = await resolveWorkspace({
        userId: rawEmail.userId,
        companyName: parsed.company,
        senderEmail
    });

    if (resolution.action === "IGNORE") {
        // Log IGNORE action in processing log
        await EmailProcessingLog.create({
            userId: rawEmail.userId,
            syncRunId,
            sender: rawEmail.sender,
            subject: rawEmail.subject,
            companyDetected: parsed.company || "Unknown",
            category: parsed.category || "Unknown",
            workspaceFound: resolution.company ? true : false,
            action: "IGNORE",
            reasonCode: resolution.reasonCode,
            reason: resolution.reason
        });

        rawEmail.processed = true;
        await rawEmail.save();

        return {
            action: "IGNORE",
            reasonCode: resolution.reasonCode,
            reason: resolution.reason,
            category: parsed.category,
            companyDetected: parsed.company,
            workspaceFound: resolution.company ? true : false
        };
    }

    const companyId = resolution.company._id;
    const companyName = resolution.company.name;
    const userCompany = resolution.workspace;

    // 4. Resolve and Aggregate Event (create or merge event)
    const event = await resolveEvent({
        userId: rawEmail.userId,
        companyId,
        companyName,
        title: parsed.title,
        date: parsed.date || new Date(),
        time: parsed.time || "",
        link: parsed.link || "",
        eventType: parsed.eventType || "General Notice",
        rawEmailId: rawEmail._id
    });

    // 5. Ingestion based on category (Placements or Updates)
    let category = "Unknown";
    if (parsed.category === "Placement") {
        category = "Placement";
        // Create placement record
        await Placement.create({
            userId: rawEmail.userId,
            company: companyName,
            companyId,
            role: parsed.role || "Software Engineer",
            event: parsed.eventType || "Registration Open",
            batch: parsed.batch || "Unknown",
            deadline: parsed.deadline,
            date: parsed.date,
            time: parsed.time,
            link: parsed.link,
            rawEmailId: rawEmail._id
        });
    } else {
        category = "Student Update";
        // Create student update record
        await StudentUpdate.create({
            userId: rawEmail.userId,
            company: companyName,
            category: "Student Update",
            eventType: parsed.eventType || "General Notice",
            title: parsed.title || rawEmail.subject,
            date: parsed.date || new Date(),
            summary: rawEmail.snippet || "",
            rawEmailId: rawEmail._id
        });
    }

    // 6. AI Enrichment (Cached check) - checklists, FAQs (last step)
    let aiResponse = rawEmail.aiAnalysis;
    if (!aiResponse) {
        console.log(`AI Analysis cache miss. Calling Gemini for email: "${rawEmail.subject}"...`);
        const { analyzeEmailContent } = require("./geminiService");
        try {
            aiResponse = await analyzeEmailContent({
                sender: rawEmail.sender,
                subject: rawEmail.subject,
                snippet: rawEmail.snippet,
                body: rawEmail.plainText || rawEmail.html || "",
                company: companyName,
            });
            rawEmail.aiAnalysis = aiResponse;
            await rawEmail.save();
        } catch (aiErr) {
            console.error("AI Enrichment call failed, using mock fallback:", aiErr.message);
            // mock fallback
            aiResponse = {
                summary: `Recruitment update related to ${companyName}.`,
                upcomingSteps: ["Practice Coding", "Check dates"],
                prepStrategy: "Focus on DSA and system design patterns.",
                codingTopics: ["Arrays", "Strings"],
                interviewTopics: ["OOPs", "Resume discussion"],
                importantInstructions: ["Make sure all details match your college records"],
                checklist: ["Revise sorting algorithms"],
                faqs: []
            };
        }
    } else {
        console.log(`AI Analysis cache hit! Reusing cached Gemini result.`);
    }

    // Update workspace (UserCompany) non-event metadata fields
    if (parsed.jobId) userCompany.jobId = parsed.jobId;
    if (parsed.role) userCompany.jobRole = parsed.role;
    if (parsed.jobType) userCompany.jobType = parsed.jobType;
    if (parsed.package && parsed.package !== "N/A") userCompany.package = parsed.package;
    if (parsed.cgpa && parsed.cgpa !== "N/A") userCompany.eligibility = parsed.cgpa;
    if (parsed.location && parsed.location !== "Unknown") userCompany.location = parsed.location;
    if (parsed.deadline) userCompany.deadline = parsed.deadline;

    if (parsed.link && !userCompany.registrationLinks.includes(parsed.link)) {
        userCompany.registrationLinks.push(parsed.link);
    }
    if (parsed.departments && parsed.departments.length > 0) {
        parsed.departments.forEach(dept => {
            if (!userCompany.departments.includes(dept)) userCompany.departments.push(dept);
        });
    }

    // Update AI properties on workspace
    userCompany.aiAnalysis = {
        summary: aiResponse.summary || "",
        upcomingSteps: aiResponse.upcomingSteps || [],
        prepStrategy: aiResponse.prepStrategy || "",
        codingTopics: aiResponse.codingTopics || [],
        interviewTopics: aiResponse.interviewTopics || [],
        importantInstructions: aiResponse.importantInstructions || [],
        checklist: aiResponse.checklist || [],
        faqs: aiResponse.faqs || []
    };

    await userCompany.save();

    rawEmail.processed = true;
    await rawEmail.save();

    // Log the successful processing action in database
    await EmailProcessingLog.create({
        userId: rawEmail.userId,
        syncRunId,
        sender: rawEmail.sender,
        subject: rawEmail.subject,
        companyDetected: companyName,
        category,
        workspaceFound: true,
        action: resolution.action,
        reasonCode: resolution.reasonCode,
        reason: resolution.reason
    });

    // Real-Time Socket Updates
    const { sendRealTimeUpdate } = require("../../config/socket");
    sendRealTimeUpdate(rawEmail.userId, "email_analyzed", {
        id: rawEmail._id,
        company: companyName,
        sender: rawEmail.sender,
        subject: rawEmail.subject,
        snippet: rawEmail.snippet,
        body: rawEmail.plainText || rawEmail.html || "",
        receivedAt: rawEmail.receivedAt,
        category,
    });
    
    sendRealTimeUpdate(rawEmail.userId, "event_created", event);

    // Dynamic Notifications
    await createNotificationFromAI(
        rawEmail.userId, 
        companyName, 
        parsed.eventType || "Update", 
        parsed.date
    );

    return {
        action: resolution.action,
        reasonCode: resolution.reasonCode,
        reason: resolution.reason,
        category,
        companyDetected: companyName,
        workspaceFound: true,
        companyId: companyId
    };
};

module.exports = {
    processEmailWithAI,
};
