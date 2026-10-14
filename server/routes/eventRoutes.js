const express = require("express");
const router = express.Router();
const { getEvents, createEvent, updateEvent, deleteEvent } = require("../controllers/eventController");
const { protect } = require("../middleware/auth");
const { mongoIdValidation } = require("../middleware/validator");

router.route("/")
    .get(protect, getEvents)
    .post(protect, createEvent);

router.route("/:id")
    .put(protect, mongoIdValidation("id"), updateEvent)
    .delete(protect, mongoIdValidation("id"), deleteEvent);

module.exports = router;
