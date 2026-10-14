import { useState, useEffect } from "react";
import documentService from "../../services/documentService";
import userCompanyService from "../../services/userCompanyService";

const categories = ["Resume", "Cover Letter", "Offer Letter", "Hall Ticket", "Certificate"];

function Documents({ company, userCompany, setUserCompany }) {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadType, setUploadType] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [docName, setDocName] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Manual checklist input state
    const [newItemName, setNewItemName] = useState("");
    const [addingItem, setAddingItem] = useState(false);

    const fetchDocuments = async () => {
        if (!company) return;
        try {
            setLoading(true);
            const res = await documentService.getDocumentsByCompany(company._id);
            setDocs(res.data || []);
        } catch (err) {
            console.error("Failed to load documents:", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [company]);

    const handleFileUpload = async (type) => {
        if (!selectedFile) {
            setError("Please select a file to upload first");
            return;
        }

        const name = docName.trim() || `${company.name} - ${type}`;
        setUploading(true);
        setError("");
        setSuccessMessage("");

        try {
            await documentService.uploadDocument(selectedFile, company._id, type, name);
            setSuccessMessage(`${type} uploaded successfully!`);
            setSelectedFile(null);
            setDocName("");
            setUploadType("");
            fetchDocuments();
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "File upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this document?")) return;
        try {
            await documentService.deleteDocument(id);
            setSuccessMessage("Document deleted successfully");
            fetchDocuments();
            setTimeout(() => setSuccessMessage(""), 3000);
        } catch (err) {
            setError("Delete operation failed");
        }
    };

    // Checklist toggling
    const handleToggleCheck = async (itemId) => {
        if (!userCompany) return;
        
        try {
            const updatedChecklist = userCompany.requiredDocuments.map(item => 
                item._id === itemId ? { ...item, completed: !item.completed } : item
            );
            
            const res = await userCompanyService.updateTracking(userCompany._id, {
                requiredDocuments: updatedChecklist
            });
            setUserCompany(res.data);
        } catch (err) {
            setError("Failed to update checklist item status");
        }
    };

    // Manual item addition
    const handleAddChecklistItem = async (e) => {
        e.preventDefault();
        if (!newItemName.trim() || !userCompany) return;
        
        setAddingItem(true);
        setError("");
        
        try {
            const updatedChecklist = [
                ...(userCompany.requiredDocuments || []),
                { name: newItemName.trim(), completed: false }
            ];
            
            const res = await userCompanyService.updateTracking(userCompany._id, {
                requiredDocuments: updatedChecklist
            });
            setUserCompany(res.data);
            setNewItemName("");
        } catch (err) {
            setError("Failed to add checklist item");
        } finally {
            setAddingItem(false);
        }
    };

    // Manual item deletion
    const handleDeleteChecklistItem = async (itemId) => {
        if (!userCompany || !window.confirm("Delete this checklist item?")) return;
        
        try {
            const updatedChecklist = userCompany.requiredDocuments.filter(item => item._id !== itemId);
            const res = await userCompanyService.updateTracking(userCompany._id, {
                requiredDocuments: updatedChecklist
            });
            setUserCompany(res.data);
        } catch (err) {
            setError("Failed to delete checklist item");
        }
    };

    const checklistItems = userCompany?.requiredDocuments || [];

    return (
        <div className="space-y-6">
            {/* AI Required Documents Checklist */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700/50 transition shadow-md">
                <div className="flex justify-between items-center mb-6 border-b border-slate-800/60 pb-3">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        📋 Required Documents Checklist
                    </h2>
                    <span className="text-[10px] text-blue-400 font-extrabold uppercase bg-blue-950 px-2.5 py-1 border border-blue-900 rounded-lg">
                        AI Extracted
                    </span>
                </div>

                {checklistItems.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs italic">
                        No required documents specified. Fill in below to add manually.
                    </div>
                ) : (
                    <div className="space-y-3 mb-6">
                        {checklistItems.map((item) => (
                            <div key={item._id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-xl hover:border-slate-800 transition">
                                <label className="flex items-center gap-3 cursor-pointer select-none text-xs font-semibold text-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={item.completed}
                                        onChange={() => handleToggleCheck(item._id)}
                                        className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-800 cursor-pointer accent-blue-600"
                                    />
                                    <span className={item.completed ? "line-through text-slate-500" : ""}>
                                        {item.name}
                                    </span>
                                </label>
                                <button
                                    onClick={() => handleDeleteChecklistItem(item._id)}
                                    className="text-red-400 hover:text-red-300 text-xxs font-bold uppercase transition"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Manual Checklist Item */}
                <form onSubmit={handleAddChecklistItem} className="flex gap-2.5">
                    <input
                        type="text"
                        placeholder="Add manual document checklist item (e.g. Transcripts)..."
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                    />
                    <button
                        type="submit"
                        disabled={addingItem}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
                    >
                        {addingItem ? "Adding..." : "+ Add"}
                    </button>
                </form>
            </div>

            {/* Optional Document Upload Manager */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700/50 transition shadow-md">
                <div className="flex justify-between items-center mb-6 border-b border-slate-800/60 pb-3">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        📁 Optional File Attachments
                    </h2>
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase bg-slate-950 px-2.5 py-1 border border-slate-850 rounded-lg">
                        Storage Manager
                    </span>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-500/20 text-red-400 rounded-xl text-xs">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-500/20 text-green-400 rounded-xl text-xs font-semibold">
                        {successMessage}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-xs animate-pulse">Loading documents catalog...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {categories.map((category) => {
                            const matchedDocs = docs.filter((d) => d.type === category);

                            return (
                                <div
                                    key={category}
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-850 rounded-xl hover:border-slate-800 transition"
                                >
                                    <div>
                                        <h3 className="font-bold text-white text-xs flex items-center gap-2">
                                            📁 {category}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            Attach PDF files for application reference.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        {matchedDocs.length > 0 ? (
                                            <div className="flex flex-col items-end gap-2">
                                                {matchedDocs.map((doc) => (
                                                    <div key={doc._id} className="flex items-center gap-3 bg-slate-900 px-3 py-1.5 border border-slate-850 rounded-lg text-[10px] font-semibold">
                                                        <span className="truncate text-slate-355 max-w-[120px]" title={doc.name}>
                                                            {doc.fileName}
                                                        </span>
                                                        <div className="flex gap-2.5">
                                                            <a
                                                                href={doc.fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                download
                                                                className="text-blue-400 hover:underline font-bold"
                                                            >
                                                                Open
                                                            </a>
                                                            <button
                                                                onClick={() => handleDelete(doc._id)}
                                                                className="text-red-400 hover:underline font-bold cursor-pointer"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div>
                                                {uploadType === category ? (
                                                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                                                        <input
                                                            type="text"
                                                            placeholder="File Description"
                                                            value={docName}
                                                            onChange={(e) => setDocName(e.target.value)}
                                                            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xxs text-slate-300 focus:outline-none"
                                                        />
                                                        <input
                                                            type="file"
                                                            onChange={(e) => setSelectedFile(e.target.files[0])}
                                                            className="text-xxs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-600/10 file:text-blue-400 cursor-pointer"
                                                        />
                                                        <div className="flex gap-2 mt-2 md:mt-0">
                                                            <button
                                                                onClick={() => handleFileUpload(category)}
                                                                disabled={uploading}
                                                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded text-[10px] font-bold cursor-pointer"
                                                            >
                                                                {uploading ? "Saving..." : "Save"}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setUploadType("");
                                                                    setSelectedFile(null);
                                                                    setDocName("");
                                                                }}
                                                                className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 rounded text-[10px] cursor-pointer"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setUploadType(category)}
                                                        className="px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xxs font-bold cursor-pointer transition"
                                                    >
                                                        + Upload File
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Documents;
