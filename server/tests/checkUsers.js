require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/careersync");
        console.log("Connected to MongoDB.");

        const users = await User.find({});
        console.log("Users in database:");
        console.log(JSON.stringify(users.map(u => ({ _id: u._id, email: u.email, name: u.name, isOnboarded: u.isOnboarded, googleTokens: u.googleTokens ? "present" : "missing" })), null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

checkUsers();
