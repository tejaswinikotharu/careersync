const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const { uploadDocument, getDocumentsByCompany, deleteDocument } = require("../controllers/documentController");
const { protect } = require("../middleware/auth");

// Ensure uploads folder exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB size limit
});

router.post("/upload", protect, upload.single("file"), uploadDocument);
router.get("/company/:companyId", protect, getDocumentsByCompany);
router.delete("/:id", protect, deleteDocument);

module.exports = router;
