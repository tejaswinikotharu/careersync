const UserCompany = require("../models/UserCompany");
const Email = require("../models/Email");

// @desc    Get dynamic AI prep summary and learning diagnostics for a company workspace
// @route   GET /api/ai/company-summary/:companyId
// @access  Private
const getCompanySummary = async (req, res, next) => {
    try {
        const { companyId } = req.params;
        const userCompany = await UserCompany.findOne({ userId: req.user._id, companyId }).populate("companyId");
        if (!userCompany) {
            res.status(404);
            throw new Error("No tracking record found for this company");
        }

        const companyName = userCompany.companyId.name;
        
        // Find user timelines
        const completed = userCompany.timeline.filter(t => t.status === "completed").map(t => t.title);
        const upcoming = userCompany.timeline.filter(t => t.status === "upcoming" || t.status === "current").map(t => t.title);

        // Customize dynamic AI advice depending on company name
        let advice = "Continue practicing mock coding tests and reviewing core computer science concepts.";
        const nameLower = companyName.toLowerCase();
        
        if (nameLower.includes("google")) {
            advice = "Google focus: Revise Dynamic Programming, Graph algorithms (DFS/BFS), and hash tables. Practice writing clean code on Google Docs.";
        } else if (nameLower.includes("amazon")) {
            advice = "Amazon focus: Deeply study leadership principles. Practice string manipulation, binary trees, and sliding window questions.";
        } else if (nameLower.includes("tcs")) {
            advice = "TCS focus: Practice basic quantitative aptitude, SQL join queries, C/C++ memory management, and OOPs paradigms.";
        } else if (nameLower.includes("oracle")) {
            advice = "Oracle focus: Master database indexations, SQL normalization, core Java multithreading, and REST APIs design.";
        }

        res.status(200).json({
            success: true,
            data: {
                company: companyName,
                currentStage: userCompany.currentRound || userCompany.status || "Pending",
                completed: completed.length > 0 ? completed : ["Application"],
                upcoming: upcoming.length > 0 ? upcoming : ["Interview Round"],
                aiAdvice: advice,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCompanySummary,
};
