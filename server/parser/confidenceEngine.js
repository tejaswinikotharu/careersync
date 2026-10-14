const confidenceEngine = (results) => {
    const { subjectRes, senderRes, linksRes, bodyRes, attachmentsRes } = results;

    let company = "Unknown";
    let finalConfidence = 0;
    let reason = "Unknown";

    // 1. Sender (Domain matches exactly) -> Highest priority
    if (senderRes.company !== "Unknown" && senderRes.confidence > finalConfidence) {
        company = senderRes.company;
        finalConfidence = senderRes.confidence;
        reason = "Domain";
    }

    // 2. Subject Extraction -> Second highest priority
    if (subjectRes.company !== "Unknown" && subjectRes.confidence > finalConfidence) {
        company = subjectRes.company;
        finalConfidence = subjectRes.confidence;
        reason = "Subject";
    }

    // 3. Links Domain Extraction -> Third priority
    if (linksRes.company !== "Unknown" && linksRes.confidence > finalConfidence) {
        company = linksRes.company;
        finalConfidence = linksRes.confidence;
        reason = "Links";
    }

    // 4. Body Pattern Matching -> Fourth priority
    if (bodyRes.company && bodyRes.companyConfidence > finalConfidence) {
        company = bodyRes.company;
        finalConfidence = bodyRes.companyConfidence;
        reason = "Body";
    }

    // 5. Attachments Filename Extraction -> Lowest priority
    if (attachmentsRes.company !== "Unknown" && attachmentsRes.confidence > finalConfidence) {
        company = attachmentsRes.company;
        finalConfidence = attachmentsRes.confidence;
        reason = "Attachments";
    }

    const THRESHOLD = 50;
    if (finalConfidence < THRESHOLD) {
        company = "Unknown";
        reason = "Low Confidence";
    }

    return { company, confidence: finalConfidence, reason };
};

module.exports = { confidenceEngine };
