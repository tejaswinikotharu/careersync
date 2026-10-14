require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const clearTrustedSenders = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const result = await User.updateMany({}, { $set: { trustedSenders: [] } });
        console.log(`Successfully cleared trustedSenders for ${result.modifiedCount} users.`);
        process.exit(0);
    } catch (err) {
        console.error("Failed to clear trusted senders:", err.message);
        process.exit(1);
    }
};

clearTrustedSenders();
