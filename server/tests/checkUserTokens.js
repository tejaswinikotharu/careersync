require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { getAuthenticatedClientForUser, isAuthError } = require("../services/gmail/gmailAuthService");

const checkTokens = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: "tkotharu@gitam.in" });
        if (!user) {
            console.error("User tkotharu@gitam.in not found.");
            process.exit(1);
        }

        console.log("User Google Tokens in Database:");
        console.log(JSON.stringify(user.googleTokens, null, 2));

        try {
            console.log("\nAttempting to get authenticated Gmail client...");
            const gmail = await getAuthenticatedClientForUser(user);
            console.log("Acquired Gmail client. Attempting users.getProfile...");
            const profile = await gmail.users.getProfile({ userId: "me" });
            console.log("Successfully fetched profile:", profile.data);
        } catch (err) {
            console.error("\nGoogle API error encountered:");
            console.error("Error Message:", err.message);
            console.error("Error Code:", err.code);
            console.error("Is Auth Error according to isAuthError?:", isAuthError(err));
            console.error("Full Error Object:", err);
        }

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

checkTokens();
