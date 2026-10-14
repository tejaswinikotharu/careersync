require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { getGmailStatus } = require("../controllers/gmailController");

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const user = await User.findOne({ email: "onboarded@careersync.com" });
        if (!user) {
            console.error("User onboarded@careersync.com not found!");
            process.exit(1);
        }

        const req = {
            user: { _id: user._id }
        };
        const res = {
            status: function(code) {
                console.log(`[Mock Res] Set HTTP Status: ${code}`);
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log(`[Mock Res] JSON Payload:`, JSON.stringify(data, null, 2));
                return this;
            }
        };
        const next = (err) => {
            console.error("\n[Mock Next] Express Error Handler Called with Stack:");
            console.error(err.stack || err);
        };

        console.log(`Executing getGmailStatus for user: ${user.email} (${user._id})`);
        await getGmailStatus(req, res, next);

        process.exit(0);
    } catch (err) {
        console.error(err.stack || err);
        process.exit(1);
    }
};

run();
