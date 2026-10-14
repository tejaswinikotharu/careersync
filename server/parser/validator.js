const validator = async (placementData, RawEmailModel, PlacementModel) => {
    // 1. Check confidence score and company name
    if (placementData.confidence < 50 || !placementData.company || placementData.company.toLowerCase() === "unknown") {
        placementData.company = "Unknown";
        placementData.category = "Needs Review";
        placementData.confidence = placementData.confidence || 30;
    }

    // 2. Verify Dates
    if (placementData.deadline && isNaN(new Date(placementData.deadline).getTime())) {
        placementData.deadline = null;
    }
    if (placementData.testDate && isNaN(new Date(placementData.testDate).getTime())) {
        placementData.testDate = null;
    }
    if (placementData.interviewDate && isNaN(new Date(placementData.interviewDate).getTime())) {
        placementData.interviewDate = null;
    }

    // 3. Verify URLs
    if (placementData.registrationLink && placementData.registrationLink !== "#") {
        try {
            new URL(placementData.registrationLink);
        } catch (e) {
            placementData.registrationLink = ""; // Clear invalid URL
        }
    }

    // 4. Duplicate Check (Only if not Needs Review and company is known)
    if (placementData.category !== "Needs Review" && placementData.company !== "Unknown") {
        const query = {
            userId: placementData.userId,
            company: { $regex: new RegExp(`^${placementData.company}$`, "i") },
            event: { $regex: new RegExp(`^${placementData.eventType || placementData.event}$`, "i") },
        };
        if (placementData.deadline) {
            query.deadline = placementData.deadline;
        }
        const duplicate = await PlacementModel.findOne(query);
        if (duplicate) {
            return { isValid: false, reason: "Duplicate placement entry for this company, event, and deadline." };
        }
    }

    return { isValid: true, data: placementData };
};

module.exports = { validator };
