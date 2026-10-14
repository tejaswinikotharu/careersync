require("dotenv").config();
const mongoose = require("mongoose");
const RawEmail = require("../models/RawEmail");
const User = require("../models/User");

const debugUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB.");

        const activeUserId = "6a4bab90b29f1b38c3237376";
        const user = await User.findById(activeUserId);
        if (!user) {
            console.log("Active user not found in DB.");
            process.exit(1);
        }
        console.log(`Active User: ${user.email} (${user._id})`);

        const rawEmails = await RawEmail.find({ userId: activeUserId });
        console.log(`\nFound ${rawEmails.length} raw emails for active user:`);
        for (const email of rawEmails) {
            console.log(`- Subject: "${email.subject}"`);
            console.log(`  Sender: "${email.sender}"`);
            console.log(`  Processed: ${email.processed}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugUser();
