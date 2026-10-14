const express = require("express");
const router = express.Router();
const {
    connectGmail,
    syncGmail,
    getEmails,
    getEmailsByCompany,
    getGmailStatus,
    disconnectGmail,
} = require("../controllers/gmailController");
const { protect } = require("../middleware/auth");

router.post("/connect", protect, connectGmail);
router.post("/disconnect", protect, disconnectGmail);
router.post("/sync", protect, syncGmail);
router.get("/status", protect, getGmailStatus);
router.get("/emails", protect, getEmails);
router.get("/emails/:company", protect, getEmailsByCompany);

module.exports = router;
