const linkExtractor = (body) => {
    if (!body) return { company: "Unknown", links: [], confidence: 0 };

    const linkRegex = /https?:\/\/[^\s"'<>\(\)]+/gi;
    const links = body.match(linkRegex) || [];

    const collegeKeywords = ["gitam", "google.com/forms", "docs.google", "forms.gle", "zoom.us", "meet.google", "teams.microsoft", "webex"];
    const genericKeywords = ["linkedin.com", "github.com", "youtube.com", "twitter.com", "facebook.com", "medium.com"];

    let company = "Unknown";
    let maxConfidence = 0;

    for (const url of links) {
        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            
            const isCollegeOrGeneric = collegeKeywords.some(kw => hostname.includes(kw)) || 
                                     genericKeywords.some(kw => hostname.includes(kw));
            if (!isCollegeOrGeneric) {
                const parts = hostname.split(".");
                if (parts.length >= 2) {
                    const domainName = parts[parts.length - 2];
                    if (domainName && domainName !== "co" && domainName !== "com" && domainName !== "org" && domainName !== "net") {
                        company = domainName.charAt(0).toUpperCase() + domainName.slice(1);
                        maxConfidence = 90;
                        break;
                    }
                }
            }
        } catch (e) {
            // invalid URL
        }
    }

    const validLinks = links.filter(url => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    });

    let registrationLink = null;
    const formKeywords = ["form", "register", "apply", "careers", "job", "signup", "typeform", "docs.google.com/forms", "forms.gle"];
    for (const url of validLinks) {
        const lowerUrl = url.toLowerCase();
        if (formKeywords.some(kw => lowerUrl.includes(kw))) {
            registrationLink = url;
            break;
        }
    }

    if (!registrationLink && validLinks.length > 0) {
        registrationLink = validLinks[0];
    }

    return { company, registrationLink, links: validLinks, confidence: maxConfidence };
};

module.exports = { linkExtractor };
