require("dotenv").config();
const mongoose = require("mongoose");
const Email = require("./models/Email");
const RawEmail = require("./models/RawEmail");
const Placement = require("./models/Placement");
const UserCompany = require("./models/UserCompany");
const Company = require("./models/Company");
const Event = require("./models/Event");
const Notification = require("./models/Notification");
const Document = require("./models/Document");
const User = require("./models/User");

const clear = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for data clearance...");

        // Clear RawEmail and Placement
        const rawEmailResult = await RawEmail.deleteMany({});
        console.log(`Deleted ${rawEmailResult.deletedCount} raw emails.`);

        const placementResult = await Placement.deleteMany({});
        console.log(`Deleted ${placementResult.deletedCount} placements.`);

        // 1. Delete all synced emails
        const emailResult = await Email.deleteMany({});
        console.log(`Deleted ${emailResult.deletedCount} emails.`);

        // 2. Delete all tracked companies (workspaces)
        const userCompanyResult = await UserCompany.deleteMany({});
        console.log(`Deleted ${userCompanyResult.deletedCount} user company tracking records.`);

        // 3. Delete all master companies to ensure company list is completely empty
        const companyResult = await Company.deleteMany({});
        console.log(`Deleted ${companyResult.deletedCount} master companies.`);

        // 4. Delete all calendar events
        const eventResult = await Event.deleteMany({});
        console.log(`Deleted ${eventResult.deletedCount} events.`);

        // 5. Delete all notifications
        const notificationResult = await Notification.deleteMany({});
        console.log(`Deleted ${notificationResult.deletedCount} notifications.`);

        // 6. Delete all documents (since they are placement documents)
        const documentResult = await Document.deleteMany({});
        console.log(`Deleted ${documentResult.deletedCount} documents.`);

        // 7. Reset user specific sync markers, but KEEP user accounts, oauth tokens, and trusted senders.
        const userUpdateResult = await User.updateMany({}, {
            $unset: {
                lastGmailSyncedHistoryId: 1,
                gmailWatchExpiration: 1
            }
        });
        console.log(`Reset sync metadata for ${userUpdateResult.modifiedCount} users.`);

        console.log("Database cleared successfully! Kept all user profiles, OAuth credentials, and Trusted Send lists.");
        process.exit(0);
    } catch (error) {
        console.error("Clearance failed:", error.message);
        process.exit(1);
    }
};

clear();
