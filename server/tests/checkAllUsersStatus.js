require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { getAuthenticatedClientForUser, isAuthError } = require("../services/gmail/gmailAuthService");

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const users = await User.find({});
        for (const u of users) {
            console.log(`\n==========================================`);
            console.log(`User: ${u.email} (${u._id})`);
            console.log(`Tokens object:`, JSON.stringify(u.googleTokens, null, 2));

            if (!u.googleTokens || !u.googleTokens.refresh_token) {
                console.log(`Status outcome: NOT_CONNECTED (Missing refresh token)`);
                continue;
            }

            try {
                console.log("Simulating status check...");
                const gmailAuthService = require("../services/gmail/gmailAuthService");
                const gmail = await gmailAuthService.getAuthenticatedClientForUser(u);
                const profileRes = await gmail.users.getProfile({ userId: "me" });
                console.log(`Status outcome: CONNECTED (Email: ${profileRes.data.emailAddress})`);
            } catch (err) {
                console.log("Token verification failed with error:", err.message);
                const gmailAuthService = require("../services/gmail/gmailAuthService");
                if (gmailAuthService.isAuthError(err)) {
                    console.log(`Status outcome: RECONNECT_REQUIRED`);
                } else {
                    console.log(`Status outcome: TRANSIENT_ERROR (Reason: ${err.message})`);
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

run();
