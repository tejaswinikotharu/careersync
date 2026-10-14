require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Email = require("./models/Email");

const extractEmail = (senderStr) => {
    const match = senderStr.match(/<([^>]+)>/);
    return match ? match[1].trim().toLowerCase() : senderStr.trim().toLowerCase();
};

const cleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for email cleanup...");

        const users = await User.find({});
        let totalDeleted = 0;

        for (const user of users) {
            const senders = (user.trustedSenders || []).map(s => s.toLowerCase());
            const emails = await Email.find({ userId: user._id });

            for (const email of emails) {
                const senderEmail = extractEmail(email.sender);
                const isTrusted = senders.includes(senderEmail);

                if (!isTrusted) {
                    await Email.deleteOne({ _id: email._id });
                    totalDeleted++;
                    console.log(`Deleted unrelated email from non-trusted sender: ${email.sender} - "${email.subject}"`);
                }
            }
        }

        console.log(`Email database cleanup complete. Deleted ${totalDeleted} unrelated emails.`);
        process.exit(0);
    } catch (err) {
        console.error("Cleanup failed:", err.message);
        process.exit(1);
    }
};

cleanup();
