const express = require("express");
const router = express.Router();
const { getUserProfile, updateUserProfile, deleteUserAccount } = require("../controllers/userController");
const { protect } = require("../middleware/auth");

router.route("/profile")
    .get(protect, getUserProfile)
    .put(protect, updateUserProfile)
    .delete(protect, deleteUserAccount);

module.exports = router;
