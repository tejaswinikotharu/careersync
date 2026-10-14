const bodyExtractor = (body) => {
    if (!body) return {};

    const result = {};

    // 1. Package / CTC (e.g. 12 LPA, 12,00,000, 12 Lakhs, 12L)
    const packageRegex = /\b(\d+(\.\d+)?)\s*(lpa|lakhs|lakh|l|million|k|per annum|ctc)\b/gi;
    const packageMatches = body.match(packageRegex);
    if (packageMatches && packageMatches.length > 0) {
        result.package = packageMatches[0].trim();
    }

    // 1.b Fallback parser if package is not found
    if (!result.package) {
        const labels = [
            /compensation\/salary\s+details/i,
            /annual\s+compensation/i,
            /compensation/i,
            /salary\s+details/i,
            /salary/i,
            /package/i,
            /ctc/i
        ];
        
        const cleanBody = body.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");

        for (const label of labels) {
            const regex = new RegExp(label.source + `(?:\\s*[:\\-=\\s]\\s*|\\s+)(?:[a-zA-Z\\s\\-\\/]*?)\\b(\\d{1,2}(?:\\.\\d{1,2})?)\\b(?!%|\\s*cgpa|\\s*gpa|\\s*pointer|\\s*percent)`, "i");
            const match = cleanBody.match(regex);
            if (match) {
                const val = parseFloat(match[1]);
                if (val >= 1.5 && val <= 90) {
                    result.package = `${match[1]} LPA`;
                    break;
                }
            }
        }
    }

    // 2. CGPA (e.g. 7.5 CGPA, 7 CGPA, 8.0 CGPA)
    const cgpaMatch = body.match(/\b(\d\.\d+|\d)\s*(cgpa|gpa|pointer|gpa criteria|cgpa criteria)\b/i) || 
                      body.match(/\b(criteria|eligibility)\b[^\n]*\b(\d\.\d+|\d)\b/i);
    if (cgpaMatch) {
        result.cgpa = cgpaMatch[0].trim();
    }

    // 3. Location (e.g. Location: Bangalore, Work Location - Hyderabad, Work location Bangalore)
    const locationMatch = body.match(/(?:work\s+)?location\s*[:\-]?\s*([A-Z][a-zA-Z]+)/i) ||
                          body.match(/(?:work\s+)?location\s*[:\-]\s*([a-zA-Z\s,]+)/i) || 
                          body.match(/job\s+location\s*[:\-]\s*([a-zA-Z\s,]+)/i);
    if (locationMatch) {
        result.location = locationMatch[1].split("\n")[0].trim();
    }

    // 4. Role (e.g. Role: Software Engineer, SDE Intern)
    const roleMatch = body.match(/role\s*[:\-]\s*([a-zA-Z0-9\s\-\(\)\/\+]+)/i) || 
                      body.match(/profile\s*[:\-]\s*([a-zA-Z0-9\s\-\(\)\/\+]+)/i) ||
                      body.match(/designation\s*[:\-]\s*([a-zA-Z0-9\s\-\(\)\/\+]+)/i);
    if (roleMatch) {
        result.role = roleMatch[1].split("\n")[0].trim();
    }

    const dateRegex = /\b(\d{1,2})[-/\s]([a-z]{3}|\d{1,2})([-/\s]\d{2,4})?\b/i;
    
    // 5. Registration Deadline
    const regDeadlineMatch = body.match(/(registration|apply|application|submission)\s+deadline\b[^\n]*\b(\d{1,2}[-/\s]([a-z]{3}|\d{1,2})([-/\s]\d{2,4})?)\b/i) ||
                             body.match(/last\s+date\s+to\s+apply\b[^\n]*\b(\d{1,2}[-/\s]([a-z]{3}|\d{1,2})([-/\s]\d{2,4})?)\b/i);
    if (regDeadlineMatch) {
        result.registrationDeadline = regDeadlineMatch[2].trim();
    }

    // 6. Test Date
    const testDateMatch = body.match(/(coding|online|mock|assessment|exam)\s+test\s+date\b[^\n]*\b(\d{1,2}[-/\s]([a-z]{3}|\d{1,2})([-/\s]\d{2,4})?)\b/i) ||
                          body.match(/(test|exam|assessment)\s+date\s*[:\-]\s*([^\n]+)/i);
    if (testDateMatch) {
        const potentialDate = testDateMatch[2] || testDateMatch[1];
        const dateMatch = potentialDate.match(dateRegex);
        if (dateMatch) {
            result.testDate = dateMatch[0].trim();
        }
    }

    // 7. Interview Date
    const interviewDateMatch = body.match(/(interview|discussion|gd)\s+date\b[^\n]*\b(\d{1,2}[-/\s]([a-z]{3}|\d{1,2})([-/\s]\d{2,4})?)\b/i) ||
                               body.match(/interview\s+date\s*[:\-]\s*([^\n]+)/i);
    if (interviewDateMatch) {
        const potentialDate = interviewDateMatch[2] || interviewDateMatch[1];
        const dateMatch = potentialDate.match(dateRegex);
        if (dateMatch) {
            result.interviewDate = dateMatch[0].trim();
        }
    }

    // 8. Attempt company name extraction from body text patterns
    const companyBodyMatch = body.match(/(hiring|recruitment|drive)\s+of\s+([A-Z][a-zA-Z0-9]+)/i) || 
                             body.match(/welcome\s+to\s+([A-Z][a-zA-Z0-9]+)/i) ||
                             body.match(/opportunity\s+at\s+([A-Z][a-zA-Z0-9]+)/i);
    if (companyBodyMatch) {
        result.company = companyBodyMatch[2].trim();
        result.companyConfidence = 70;
    }

    return result;
};

module.exports = { bodyExtractor };
