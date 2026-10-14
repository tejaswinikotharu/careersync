const Event = require("../models/Event");

/**
 * Reusable resolver that aggregates raw emails into recruitment activity Event documents
 * and respects field-level locks for manually edited events.
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.companyId
 * @param {string} params.companyName
 * @param {string} params.title
 * @param {Date} params.date
 * @param {string} params.time
 * @param {string} params.link
 * @param {string} params.eventType - Enum type (e.g. Registration, Mock Test)
 * @param {string} params.rawEmailId
 * @returns {Promise<Event>} Saved Mongoose Event document
 */
const resolveEvent = async ({
    userId,
    companyId,
    companyName,
    title,
    date,
    time,
    link,
    eventType,
    rawEmailId
}) => {
    // Map dynamic eventType to core Event schema enum validation keys
    const mapCoreEventType = (detailType) => {
        const t = (detailType || "").toLowerCase();
        if (t.includes("registration open") || t.includes("registration closed")) {
            return "Registration";
        }
        if (t.includes("deadline")) {
            return "Deadline";
        }
        if (t.includes("mock") || t.includes("practice")) {
            return "Mock Test";
        }
        if (t.includes("prep kit")) {
            return "Prep Kit";
        }
        if (t.includes("training") || t.includes("workshop") || t.includes("webinar") || t.includes("bootcamp")) {
            return "Training";
        }
        if (t.includes("test") || t.includes("assessment") || t.includes("oa")) {
            return "Online Assessment";
        }
        if (t.includes("interview") || t.includes("discussion") || t.includes("schedule") || t.includes("ppt") || t.includes("presentation")) {
            return "Interview";
        }
        if (t.includes("offer") || t.includes("joining") || t.includes("selection")) {
            return "Offer";
        }
        return "General Notice";
    };

    const coreType = mapCoreEventType(eventType);

    // 1. Check if same-day matching event type exists for this company
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let event = await Event.findOne({
        userId,
        companyId,
        type: coreType,
        date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (event) {
        console.log(`Matching Event found for "${companyName}" stage "${coreType}" on date ${startOfDay.toLocaleDateString()}. Merging...`);
        
        // Append rawEmailId if not already present
        if (rawEmailId && !event.rawEmailIds.includes(rawEmailId)) {
            event.rawEmailIds.push(rawEmailId);
        }
        event.latestRawEmailId = rawEmailId;
        event.sourceCount = event.rawEmailIds.length;

        // Apply edits only if locks are false
        if (!event.titleLocked && title) event.title = title;
        if (!event.timeLocked && time) event.time = time;
        if (!event.linkLocked && link) event.link = link;

        await event.save();
        return event;
    }

    // 2. Create new Event if no match
    event = await Event.create({
        userId,
        companyId,
        companyName,
        title: title || `${eventType} - ${companyName}`,
        date,
        time: time || "",
        link: link || "",
        type: coreType,
        rawEmailIds: rawEmailId ? [rawEmailId] : [],
        latestRawEmailId: rawEmailId || null,
        sourceCount: rawEmailId ? 1 : 0
    });

    console.log(`Created new aggregated Event: "${event.title}"`);
    return event;
};

module.exports = {
    resolveEvent
};
