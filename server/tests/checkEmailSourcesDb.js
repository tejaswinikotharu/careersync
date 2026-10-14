require("dotenv").config();
const mongoose = require("mongoose");
const EmailSource = require("../models/EmailSource");

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        const tkotharuUserId = "6a4fb6bb270918758ae20389";
        const sources = await EmailSource.find({ userId: tkotharuUserId });
        console.log(`Configured Email Sources for tkotharu@gitam.in:`);
        console.log(JSON.stringify(sources, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err.stack || err);
        process.exit(1);
    }
};

run();
