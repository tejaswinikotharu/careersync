const attachmentExtractor = (attachments) => {
    if (!attachments || attachments.length === 0) return { company: "Unknown", confidence: 0 };

    const ignoreKeywords = ["syllabus", "guideline", "instructions", "schedule", "student", "list", "resume", "july", "june", "pdf"];
    
    for (const att of attachments) {
        const name = att.filename || "";
        const parts = name.split(/[_\-\s\.]+/);
        for (const part of parts) {
            const lowerPart = part.toLowerCase();
            if (lowerPart.length > 2 && !ignoreKeywords.includes(lowerPart) && isNaN(part)) {
                const company = part.charAt(0).toUpperCase() + part.slice(1);
                return { company, confidence: 60 };
            }
        }
    }

    return { company: "Unknown", confidence: 0 };
};

module.exports = { attachmentExtractor };
