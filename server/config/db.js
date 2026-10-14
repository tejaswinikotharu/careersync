const mongoose = require("mongoose");

const connectDB = async () => {
    let conn;
    try {
        conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error to Atlas: ${error.message}`);
        console.log("Attempting local MongoDB connection fallback (mongodb://127.0.0.1:27017/careersync)...");
        try {
            conn = await mongoose.connect("mongodb://127.0.0.1:27017/careersync");
            console.log(`MongoDB Connected to fallback local server: ${conn.connection.host}`);
        } catch (localError) {
            console.error(`Local MongoDB fallback connection also failed: ${localError.message}`);
            process.exit(1);
        }
    }

    // Run database cleanup to remove invalid legacy companies
    try {
        const Company = require("../models/Company");
        const UserCompany = require("../models/UserCompany");
        const Placement = require("../models/Placement");
        
        const invalidNames = [
            "EECE ONLY", "CSE ONLY", "ECE ONLY", "EEE ONLY", "CT3", "Revised", 
            "Cancelled", "Interview", "Training", "Workshop", "Mock Test", 
            "Practice Assessment", "Aptitude Test", "Registration", "Deadline", 
            "Syllabus & Details", "Syllabus", "Details", "3 July to 12 July 2026", 
            "2027 Batch", "Departments", "Specializations", "CancelledTMCGGCGCMastering",
            "Google"
        ];
        
        // Find and delete Company docs matching invalidNames (case-insensitive)
        const deletedResult = await Company.deleteMany({
            name: { $in: invalidNames.map(name => new RegExp(`^${name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, "i")) }
        });
        if (deletedResult.deletedCount > 0) {
            console.log(`Cleaned up ${deletedResult.deletedCount} legacy invalid/unwanted companies from the database.`);
        }
    } catch (cleanErr) {
        console.warn("Legacy database cleanup failed at startup:", cleanErr.message);
    }

    // Seed default EmailSource records for all existing users
    try {
        const User = require("../models/User");
        const EmailSource = require("../models/EmailSource");
        const users = await User.find({});
        
        for (const user of users) {
            // Placement sender
            const pExists = await EmailSource.findOne({ userId: user._id, email: "asraya_cgcv2@gitam.in" });
            if (!pExists) {
                await EmailSource.create({
                    userId: user._id,
                    email: "asraya_cgcv2@gitam.in",
                    type: "placement",
                    isActive: true,
                    priority: 1
                });
                console.log(`Seeded default placement email source for user ${user.email}`);
            }
            
            // Student Update sender
            const uExists = await EmailSource.findOne({ userId: user._id, email: "vspgitstudents_2027@gitam.in" });
            if (!uExists) {
                await EmailSource.create({
                    userId: user._id,
                    email: "vspgitstudents_2027@gitam.in",
                    type: "update",
                    isActive: true,
                    priority: 1
                });
                console.log(`Seeded default student update email source for user ${user.email}`);
            }
        }
    } catch (seedErr) {
        console.warn("Seeding default email sources failed at startup:", seedErr.message);
    }
};

module.exports = connectDB;
