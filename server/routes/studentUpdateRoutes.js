const express = require("express");
const router = express.Router();
const { getStudentUpdates } = require("../controllers/studentUpdateController");
const { protect } = require("../middleware/auth");

router.get("/", protect, getStudentUpdates);

module.exports = router;
