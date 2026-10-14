const { parseStructuredEmail } = require("./structuredParser");

const parsePlacementEmail = async (rawEmail) => {
    const res = await parseStructuredEmail(rawEmail);
    let event = "General Update";
    const lowerEvent = res.eventType.toLowerCase();
    if (lowerEvent.includes("interview") || lowerEvent.includes("discussion") || lowerEvent.includes("gd") || lowerEvent.includes("presentation") || lowerEvent.includes("ppt")) {
        event = "Technical Interview";
    } else if (lowerEvent.includes("coding test") || lowerEvent.includes("assessment") || lowerEvent.includes("test")) {
        event = "Coding Test";
    } else if (lowerEvent.includes("mock")) {
        event = "Mock Tests";
    } else if (lowerEvent.includes("register") || lowerEvent.includes("apply") || lowerEvent.includes("deadline")) {
        event = "Registration";
    } else if (lowerEvent.includes("offer")) {
        event = "Offer";
    }
    return {
        ...res,
        event,
    };
};

module.exports = { parsePlacementEmail };
