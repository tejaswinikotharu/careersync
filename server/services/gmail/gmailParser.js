// Helper to decode Base64url encoded strings from Google APIs
const decodeBase64 = (data) => {
    if (!data) return "";
    const buff = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return buff.toString("utf8");
};

const parseGmailMessage = (messagePayload) => {
    const { id: gmailMessageId, threadId, labelIds: labels, snippet } = messagePayload;
    
    const headers = messagePayload.payload.headers || [];
    const getHeader = (name) => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : "";
    };

    const sender = getHeader("From");
    const subject = getHeader("Subject");
    const dateStr = getHeader("Date");
    const receivedAt = dateStr ? new Date(dateStr) : new Date();

    let body = "";
    let hasAttachments = false;
    const attachments = [];

    // Recursively parse MIME message parts
    const parseParts = (parts) => {
        if (!parts) return;
        for (const part of parts) {
            if (part.mimeType === "text/plain" && part.body && part.body.data) {
                body += decodeBase64(part.body.data) + "\n";
            } else if (part.mimeType === "text/html" && body === "" && part.body && part.body.data) {
                // fallback to HTML body if plain text is empty
                body += decodeBase64(part.body.data);
            }
            
            // Check for attachment parts
            if (part.filename && part.body && part.body.attachmentId) {
                hasAttachments = true;
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body.size,
                    attachmentId: part.body.attachmentId,
                });
            }

            if (part.parts) {
                parseParts(part.parts);
            }
        }
    };

    if (messagePayload.payload.parts) {
        parseParts(messagePayload.payload.parts);
    } else if (messagePayload.payload.body && messagePayload.payload.body.data) {
        body = decodeBase64(messagePayload.payload.body.data);
    }

    const isRead = labels ? !labels.includes("UNREAD") : true;

    return {
        gmailMessageId,
        threadId,
        sender,
        subject,
        snippet,
        body: body.trim() || snippet || "",
        receivedAt,
        labels: labels || [],
        isRead,
        hasAttachments,
        attachments,
    };
};

module.exports = {
    parseGmailMessage,
};
