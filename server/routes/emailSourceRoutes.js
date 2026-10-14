const express = require("express");
const router = express.Router();
const {
    getEmailSources,
    addEmailSource,
    updateEmailSource,
    deleteEmailSource,
    testEmailSource
} = require("../controllers/emailSourceController");
const { protect } = require("../middleware/auth");

router.route("/")
    .get(protect, getEmailSources)
    .post(protect, addEmailSource);

router.route("/:id")
    .put(protect, updateEmailSource)
    .delete(protect, deleteEmailSource);

router.route("/:id/test")
    .post(protect, testEmailSource);

module.exports = router;
