const { subjectExtractor } = require("./subjectExtractor");
const { bodyExtractor } = require("./bodyExtractor");
const { linkExtractor } = require("./linkExtractor");
const { attachmentExtractor } = require("./attachmentExtractor");
const { classifyEmail } = require("./classificationEngine");
const Company = require("../models/Company");

const parseDateString = (dateStr) => {
    if (!dateStr) return null;
    const cleanStr = dateStr.replace(/[^\w\s-]/g, "").trim();
    let d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const currentYear = new Date().getFullYear();
        if (year < currentYear - 5 || year > currentYear + 10) {
            const withYear = new Date(`${cleanStr} ${currentYear}`);
            if (!isNaN(withYear.getTime())) {
                d = withYear;
            }
        }
        return d;
    }
    const currentYear = new Date().getFullYear();
    const withYear = new Date(`${cleanStr} ${currentYear}`);
    if (!isNaN(withYear.getTime())) {
        return withYear;
    }
    return null;
};

const parseDateWithContext = (text, keyword) => {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(keyword.toLowerCase());
    if (idx === -1) return null;
    const substring = text.substring(idx, idx + 150);
    const dateRegex = /\b(\d{1,2})[-/\s]([a-z]{3}|\d{1,2})([-/\s]\d{2,4})?\b/i;
    const match = substring.match(dateRegex);
    return match ? parseDateString(match[0]) : null;
};

const parseTimeWithContext = (text, keyword) => {
    if (!text) return "";
    const lowerText = text.toLowerCase();
    const idx = lowerText.indexOf(keyword.toLowerCase());
    if (idx === -1) {
        const globalMatch = text.match(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i) || text.match(/\b\d{2}:\d{2}\b/);
        return globalMatch ? globalMatch[0] : "";
    }
    const substring = text.substring(idx, idx + 150);
    const match = substring.match(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i) || substring.match(/\b\d{2}:\d{2}\b/);
    return match ? match[0] : "";
};

const extractDepartments = (text) => {
    const list = [];
    const depts = ["CSE", "ECE", "EEE", "IT", "ME", "CE", "MCA", "MBA", "B.Tech", "M.Tech"];
    for (const d of depts) {
        const escaped = d.replace(".", "\\.");
        if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
            list.push(d);
        }
    }
    return list;
};

const extractSpecializations = (text) => {
    const list = [];
    const specs = ["AI/ML", "AI", "ML", "Data Science", "Cyber Security", "IoT", "Cloud Computing"];
    for (const s of specs) {
        if (new RegExp(`\\b${s.replace("/", "\\/")}\\b`, "i").test(text)) {
            list.push(s);
        }
    }
    return list;
};

const parseStructuredEmail = async (rawEmail) => {
    const { subject = "", plainText = "", html = "", body = "", sender = "", attachments = [] } = rawEmail;
    const emailBody = plainText || html || body || "";
    const lowerSub = subject.toLowerCase();
    const lowerBody = emailBody.toLowerCase();

    // 1. Run Classification Engine
    const { category, eventType } = classifyEmail(subject, emailBody);

    // 2. Run deterministic helpers
    const subjectRes = subjectExtractor(subject);
    const linksRes = linkExtractor(emailBody);
    const bodyRes = bodyExtractor(emailBody);
    const attachmentsRes = attachmentExtractor(attachments);

    // Define isBlockedName helper
    const isBlockedName = (name) => {
        if (!name) return true;
        const lowerName = name.toLowerCase().trim();
        if (lowerName === "unknown" || lowerName === "") return true;

        if (lowerName.includes("cancelled")) return true;
        if (lowerName.includes("revised")) return true;
        if (lowerName.includes("syllabus")) return true;
        if (lowerName.includes("details")) return true;
        if (lowerName.includes("ct3")) return true;

        const parsedDate = new Date(name);
        if (!isNaN(parsedDate.getTime()) && /\b\d{1,2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(name)) {
            return true;
        }

        if (/\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(lowerName)) {
            return true;
        }

        const blockWords = [
            "only", "eligible", "registered", "students", "student", "department", 
            "departments", "specialization", "specializations", "branch", "branches", 
            "girls", "boys", "eece", "cse", "ece", "eee", "mech", "civil", "mca", "mba", 
            "btech", "mtech", "batch", "year", "passout", "class", "gitam", "campus", 
            "university", "college", "academic", "academics", "all", "select", "selected", 
            "shortlist", "shortlisted", "deadline", "registration", "apply", "link", 
            "placement", "internship", "job", "role", "test", "exam", "assessment", 
            "interview", "schedule", "hiring", "recruitment", "update", "alert", 
            "notification", "important", "reminder", "joined", "offer", "congratulations", 
            "sk-vcs", "mock", "prep", "training", "workshop", "webinar", "urgent", "your",
            "our", "their", "this", "that", "with", "from", "info", "mail", "email", "status",
            "career", "careers", "opportunity", "opportunities", "for", "please", "to", "the",
            "revised", "cancelled", "ct3", "syllabus", "details"
        ];

        const tokens = lowerName.split(/[\s|&_\-/]+/);
        const allTokensBlocked = tokens.every(token => {
            const cleaned = token.replace(/[^a-z0-9]/g, "");
            if (cleaned.length <= 1) return true;
            return blockWords.includes(cleaned);
        });

        if (allTokensBlocked) return true;

        const invalidPhrases = [
            "eligible students", "registered students", "only girls", "only boys", 
            "eece only", "cse only", "ece only", "eee only", "2027 batch", "2026 batch",
            "batch of", "july to", "june to", "august to", "september to", "syllabus", "details"
        ];
        if (invalidPhrases.some(phrase => lowerName.includes(phrase))) {
            return true;
        }

        return false;
    };

    // 2.a Extract Company
    let company = "";
    let confidence = 95;
    let reason = "Subject Parsing";
    let corporateName = "";

    // Priority 1: Corporate Name in Body
    const corpMatch = emailBody.match(/Corporate\s+Name\s*:\s*([^\r\n]+)/i) || 
                      emailBody.match(/Company\s*:\s*([^\r\n]+)/i);
    if (corpMatch && corpMatch[1]) {
        const candidate = corpMatch[1].trim();
        if (!isBlockedName(candidate)) {
            corporateName = candidate;
        }
    }

    if (corporateName) {
        company = corporateName;
        reason = "Corporate Name Extraction";
        confidence = 99;
    } else {
        // Priority 2: Subject Parsing
        const mongoose = require("mongoose");
        let companies = [];
        if (mongoose.connection && mongoose.connection.readyState !== 0) {
            try {
                companies = await Company.find({});
            } catch (dbErr) {
                console.warn("Database lookup failed in structured parser:", dbErr.message);
            }
        }
        
        let matchedKnownCompany = null;
        for (const comp of companies) {
            const escapedName = comp.name.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedName}\\b`, "i");
            if (!isBlockedName(comp.name) && regex.test(lowerSub)) {
                matchedKnownCompany = comp.name;
                break;
            }
        }

        if (matchedKnownCompany) {
            company = matchedKnownCompany;
            reason = "Known Company Match in Subject";
            confidence = 98;
        } else if (subjectRes && subjectRes.company && subjectRes.company !== "Unknown" && !isBlockedName(subjectRes.company)) {
            company = subjectRes.company;
            confidence = subjectRes.confidence || 95;
            reason = subjectRes.reason || "Subject Segmentation";
        }
    }

    if (!company || company === "Unknown") {
        const bodyMatch = emailBody.match(/(?:hiring|recruitment|drive)\s+of\s+([A-Z][a-zA-Z0-9]+)/i) || 
                          emailBody.match(/welcome\s+to\s+([A-Z][a-zA-Z0-9]+)/i) ||
                          emailBody.match(/opportunity\s+at\s+([A-Z][a-zA-Z0-9]+)/i) ||
                          emailBody.match(/role\s+at\s+([A-Z][a-zA-Z0-9]+)/i) ||
                          emailBody.match(/position\s+at\s+([A-Z][a-zA-Z0-9]+)/i) ||
                          emailBody.match(/applying\s+to\s+([A-Z][a-zA-Z0-9]+)/i) ||
                          emailBody.match(/careers\s+at\s+([A-Z][a-zA-Z0-9]+)/i);
        if (bodyMatch && bodyMatch[1]) {
            const candidate = bodyMatch[1].trim();
            if (!isBlockedName(candidate)) {
                company = candidate;
                reason = "Body Pattern Matching";
                confidence = 70;
            }
        }
    }

    // Set fallback if still blocked or invalid
    if (isBlockedName(company)) {
        const firstWord = subject.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, "");
        if (firstWord && firstWord.length > 2 && !isBlockedName(firstWord)) {
            company = firstWord;
            confidence = 60;
            reason = "First Word Subject Fallback";
        } else {
            company = "Unknown";
            confidence = 30;
            reason = "Failed to extract valid company name";
        }
    }

    // Track parsed corporateName for return payload

    // 3. Job ID Extraction (e.g. SK-VCS270001)
    let jobId = "";
    const jobIdMatch = emailBody.match(/\b([A-Z0-9]{2,4}-VCS\d+)\b/i) || 
                       emailBody.match(/\b([A-Z]{2,4}-[A-Z0-9]{6,10})\b/) ||
                       subject.match(/\b([A-Z0-9]{2,4}-VCS\d+)\b/i) || 
                       subject.match(/\b([A-Z]{2,4}-[A-Z0-9]{6,10})\b/);
    if (jobIdMatch) {
        jobId = jobIdMatch[1].trim().toUpperCase();
    }

    // 4. Detailed Dates Extraction
    const regDeadlineVal = subjectRes.deadline || bodyRes.registrationDeadline;
    const registrationDeadline = parseDateString(regDeadlineVal);
    const mockTestDate = parseDateWithContext(emailBody, "mock") || parseDateWithContext(emailBody, "practice");
    const mockTestTime = parseTimeWithContext(emailBody, "mock") || parseTimeWithContext(emailBody, "practice");
    const trainingDate = parseDateWithContext(emailBody, "training") || parseDateWithContext(emailBody, "workshop") || parseDateWithContext(emailBody, "webinar");
    const assessmentDate = parseDateWithContext(emailBody, "assessment") || parseDateWithContext(emailBody, "coding test") || parseDateWithContext(emailBody, "exam");
    const interviewDate = parseDateWithContext(emailBody, "interview") || parseDateWithContext(emailBody, "discussion") || parseDateWithContext(emailBody, "gd");
    const interviewTime = parseTimeWithContext(emailBody, "interview") || parseTimeWithContext(emailBody, "discussion") || parseTimeWithContext(emailBody, "gd");
    const offerDate = parseDateWithContext(emailBody, "offer") || parseDateWithContext(emailBody, "selection");
    const joiningDate = parseDateWithContext(emailBody, "joining") || parseDateWithContext(emailBody, "boarding") || parseDateWithContext(emailBody, "doj");

    // Establish the primary date of the event based on event type
    let date = new Date(rawEmail.receivedAt || new Date());
    let time = "";
    if (eventType.includes("Deadline") && registrationDeadline) {
        date = registrationDeadline;
    } else if (eventType.includes("Mock") && mockTestDate) {
        date = mockTestDate;
        time = mockTestTime;
    } else if (eventType.includes("Training") && trainingDate) {
        date = trainingDate;
    } else if (eventType.includes("Assessment") && assessmentDate) {
        date = assessmentDate;
    } else if (eventType.includes("Interview") && interviewDate) {
        date = interviewDate;
        time = interviewTime;
    } else if (eventType.includes("Offer") && offerDate) {
        date = offerDate;
    } else if (eventType.includes("Joining") && joiningDate) {
        date = joiningDate;
    } else if (registrationDeadline || mockTestDate || assessmentDate || interviewDate) {
        date = registrationDeadline || mockTestDate || assessmentDate || interviewDate;
    }

    // 5. Link extraction
    let registrationLink = linksRes.registrationLink || "";
    let eventLink = "";
    const testKeywords = ["assessment", "test", "exam", "assessment.tcs", "faceprep", "zoom", "meet.google", "teams.microsoft"];
    for (const url of linksRes.links || []) {
        if (testKeywords.some(kw => url.toLowerCase().includes(kw))) {
            eventLink = url;
            break;
        }
    }
    if (!eventLink && linksRes.links && linksRes.links.length > 0) {
        eventLink = linksRes.links[0];
    }

    // 6. Recruitment-specific details
    const batch = subjectRes.batch !== "Unknown" ? subjectRes.batch : (bodyRes.batch || "Unknown");
    const cgpa = bodyRes.cgpa || "N/A";
    const pkg = bodyRes.package || "N/A";
    const location = bodyRes.location || "Unknown";
    const role = bodyRes.role || "Software Engineer";
    const jobType = lowerBody.includes("internship") ? (lowerBody.includes("fte") || lowerBody.includes("full time") ? "FTE + Internship" : "Internship") : "Full Time";
    const departments = extractDepartments(emailBody);
    const specializations = extractSpecializations(emailBody);

    // Heuristic important instructions extraction
    const importantInstructions = [];
    const lines = emailBody.split("\n");
    const instructionKeywords = ["must", "note:", "important", "mandatory", "instructions", "please make sure", "warning"];
    for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.length > 10 && cleanLine.length < 150) {
            if (instructionKeywords.some(kw => cleanLine.toLowerCase().includes(kw))) {
                importantInstructions.push(cleanLine);
            }
        }
        if (importantInstructions.length >= 5) break;
    }

    return {
        company,
        category,
        eventType,
        title: subjectRes.title || subject,
        jobId,
        role,
        jobType,
        cgpa,
        package: pkg,
        location,
        departments,
        specializations,
        registrationLink,
        eventLink,
        deadline: registrationDeadline,
        mockTestDate,
        mockTestTime,
        trainingDate,
        assessmentDate,
        interviewDate,
        interviewTime,
        offerDate,
        joiningDate,
        date,
        time,
        link: eventLink || registrationLink || "",
        importantInstructions,
        batch,
        confidence,
        reason,
        corporateName,
    };
};

module.exports = { parseStructuredEmail };
