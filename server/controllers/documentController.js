const Document = require("../models/Document");
const { uploadFile, deleteFile } = require("../services/storage/storageService");

// @desc    Upload document file
// @route   POST /api/documents/upload
// @access  Private
const uploadDocument = async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400);
            throw new Error("No file was uploaded");
        }

        const { companyId, type, name } = req.body;

        if (!type || !name) {
            res.status(400);
            throw new Error("Document type and name are required");
        }

        // Upload using swappable storage service provider
        const storageResult = await uploadFile(req.file);

        const newDoc = await Document.create({
            userId: req.user._id,
            companyId: companyId || null, // null companyId represents global profile documents (like main Resume)
            name,
            type,
            fileUrl: storageResult.fileUrl,
            fileName: storageResult.fileName,
            fileSize: storageResult.fileSize,
        });

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: newDoc,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all documents for a specific company workspace
// @route   GET /api/documents/company/:companyId
// @access  Private
const getDocumentsByCompany = async (req, res, next) => {
    try {
        const { companyId } = req.params;

        const list = await Document.find({
            userId: req.user._id,
            companyId: companyId === "global" ? null : companyId,
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: list,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete document from storage and database
// @route   DELETE /api/documents/:id
// @access  Private
const deleteDocument = async (req, res, next) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) {
            res.status(404);
            throw new Error("Document not found");
        }

        // Verify ownership
        if (doc.userId.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error("Not authorized");
        }

        // Remove from physical storage
        await deleteFile(doc.fileUrl);

        // Remove from database
        await doc.deleteOne();

        res.status(200).json({
            success: true,
            message: "Document deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadDocument,
    getDocumentsByCompany,
    deleteDocument,
};
