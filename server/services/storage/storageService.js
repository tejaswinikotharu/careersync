const fs = require("fs");
const path = require("path");

// Swappable Storage Interface Definition
class LocalDiskStorageProvider {
    async upload(file) {
        // Multer handles the physical write to server/uploads/
        // We resolve the web access URL
        const fileUrl = `/uploads/${file.filename}`;
        return {
            fileUrl,
            fileName: file.originalname,
            fileSize: file.size,
        };
    }

    async delete(fileUrl) {
        // Resolve local path from the web URL and remove
        const filename = fileUrl.replace("/uploads/", "");
        const filePath = path.join(__dirname, "../../../uploads", filename);
        
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Local Storage: Deleted file from disk at ${filePath}`);
            }
        } catch (err) {
            console.error("Local Storage: Delete failed:", err.message);
        }
    }
}

// Swappable Cloud Provider placeholders (can easily be activated by re-assigning activeProvider)
class S3StorageProvider {
    async upload(file) { /* S3 SDK puts object */ }
    async delete(fileUrl) { /* S3 SDK deletes object */ }
}

// Instantiate active provider (Local Disk for development)
const activeProvider = new LocalDiskStorageProvider();

const uploadFile = async (file) => {
    return await activeProvider.upload(file);
};

const deleteFile = async (fileUrl) => {
    return await activeProvider.delete(fileUrl);
};

module.exports = {
    uploadFile,
    deleteFile,
};
