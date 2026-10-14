const isBlockedName = (name) => {
    if (!name) return true;
    const lowerName = name.toLowerCase().trim();
    if (lowerName === "unknown" || lowerName === "") return true;

    // Check if string contains "cancelled" or "revised" or "syllabus" or "details" anywhere
    if (lowerName.includes("cancelled")) return true;
    if (lowerName.includes("revised")) return true;
    if (lowerName.includes("syllabus")) return true;
    if (lowerName.includes("details")) return true;
    if (lowerName.includes("ct3")) return true;

    // Check if the name is a date
    const parsedDate = new Date(name);
    if (!isNaN(parsedDate.getTime()) && /\b\d{1,2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(name)) {
        return true;
    }

    // Check date range patterns like "3 july to 12 july 2026"
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

    // Clean tokens and check if they are all blocked
    const tokens = lowerName.split(/[\s|&_\-/]+/);
    const allTokensBlocked = tokens.every(token => {
        const cleaned = token.replace(/[^a-z0-9]/g, "");
        if (cleaned.length <= 1) return true; // ignore single letters/digits
        return blockWords.includes(cleaned);
    });

    if (allTokensBlocked) return true;

    // Check invalid phrases
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

const subjectExtractor = (subject) => {
    if (!subject) {
        return { company: "Unknown", batch: "Unknown", event: "General Update", deadline: null, confidence: 0 };
    }

    let company = "Unknown";
    let batch = "Unknown";
    let event = "General Update";
    let deadline = null;
    let confidence = 0;

    // Detect Batch (e.g. 2027 Batch, 2027 class, 2027 Passout)
    const batchRegex = /\b(20\d{2})\b/i;
    const batchMatch = subject.match(batchRegex);
    if (batchMatch) {
        batch = batchMatch[1];
    }

    // Detect Event / Stage
    const lowerSubject = subject.toLowerCase();
    if (lowerSubject.includes("interview") || lowerSubject.includes("discussion") || lowerSubject.includes("gd")) {
        event = "Technical Interview";
    } else if (lowerSubject.includes("test") || lowerSubject.includes("exam") || lowerSubject.includes("assessment") || lowerSubject.includes("oa")) {
        event = "Coding Test";
    } else if (lowerSubject.includes("mock")) {
        event = "Mock Tests";
    } else if (lowerSubject.includes("register") || lowerSubject.includes("apply") || lowerSubject.includes("application") || lowerSubject.includes("deadline")) {
        event = "Registration";
    } else if (lowerSubject.includes("offer") || lowerSubject.includes("selected") || lowerSubject.includes("congratulations")) {
        event = "Offer";
    }

    // Detect Deadline from Subject (e.g. Deadline 22-Jun, Deadline: 10 Jul)
    const deadlineKeywords = ["deadline", "due by", "last date", "last date to apply", "close by"];
    for (const kw of deadlineKeywords) {
        if (lowerSubject.includes(kw)) {
            const index = lowerSubject.indexOf(kw);
            const substring = subject.substring(index + kw.length);
            const dateRegex = /\b(\d{1,2})[-/\s]([a-z]{3}|\d{1,2})([-/\s]\d{2,4})?\b/i;
            const dateMatch = substring.match(dateRegex);
            if (dateMatch) {
                deadline = dateMatch[0].trim();
                break;
            }
        }
    }

    // Segment tokenizer
    const separators = ["||", "|", " - ", " : ", "–"];
    let segments = [subject];
    for (const sep of separators) {
        if (subject.includes(sep)) {
            segments = subject.split(sep);
            break;
        }
    }

    const ignoreKeywords = [
        "deadline", "registration", "apply", "link", "batch", "class", "lpa", "cgpa", 
        "eligible", "eligibility", "sarthaka", "placement", "internship", "job", "role", 
        "gitam", "university", "college", "campus", "drive", "test", "exam", "assessment", 
        "interview", "schedule", "hiring", "recruitment", "update", "alert", "notification", 
        "important", "reminder", "batch of", "joined", "offer", "congratulations", "sk-vcs"
    ];

    for (let seg of segments) {
        seg = seg.replace(/[\[\]\(\)]/g, "").trim();
        if (!seg) continue;
        
        const lowerSeg = seg.toLowerCase();
        const shouldIgnore = ignoreKeywords.some(keyword => lowerSeg.includes(keyword)) || isBlockedName(seg);
        if (!shouldIgnore && seg.length > 1 && seg.length < 30) {
            company = seg;
            confidence = 95;
            break;
        }
    }

    return { company, batch, event, deadline, confidence };
};

module.exports = { subjectExtractor };
