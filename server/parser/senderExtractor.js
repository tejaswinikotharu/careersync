const senderExtractor = (sender) => {
    if (!sender) return { company: "Unknown", confidence: 0 };

    const emailMatch = sender.match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1].trim().toLowerCase() : sender.trim().toLowerCase();
    
    const domainMatch = email.match(/@([^>]+)/);
    if (!domainMatch) return { company: "Unknown", confidence: 0 };

    const domain = domainMatch[1].trim().toLowerCase();
    const collegeDomains = ["gitam.in", "gitam.edu", "sathyabama.ac.in", "sathyabama.edu", "srmist.edu.in", "vit.ac.in"];
    const publicMailDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "mail.com"];

    if (collegeDomains.some(d => domain.includes(d)) || publicMailDomains.some(d => domain.includes(d))) {
        return { company: "Unknown", confidence: 0 };
    }

    const domainParts = domain.split(".");
    if (domainParts.length >= 2) {
        const companyPart = domainParts[domainParts.length - 2];
        if (companyPart) {
            const capitalized = companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
            return { company: capitalized, confidence: 95 };
        }
    }

    return { company: "Unknown", confidence: 0 };
};

module.exports = { senderExtractor };
