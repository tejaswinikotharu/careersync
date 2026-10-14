const express = require("express");
const router = express.Router();
const { getCompanySummary } = require("../controllers/aiController");
const { protect } = require("../middleware/auth");

router.get("/company-summary/:companyId", protect, getCompanySummary);

module.exports = router;
