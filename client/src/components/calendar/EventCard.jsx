function EventCard({ event, onEdit, onDelete }) {
    // Map event types to specific colors
    const typeColors = {
        "Coding Test": "bg-red-600/10 text-red-400 border border-red-500/20",
        "Test": "bg-red-600/10 text-red-400 border border-red-500/20",
        "Interview": "bg-green-600/10 text-green-400 border border-green-500/20",
        "Assessment": "bg-yellow-600/10 text-yellow-400 border border-yellow-500/20",
        "Deadline": "bg-orange-600/10 text-orange-400 border border-orange-500/20",
        "Offer Expiry": "bg-purple-600/10 text-purple-400 border border-purple-500/20",
    };

    const typeClass = typeColors[event.type] || "bg-blue-600/10 text-blue-400 border border-blue-500/20";
    const displayName = event.companyName || event.company || "General Workspace";

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700/60 hover:shadow-lg transition">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-extrabold text-white">
                        {displayName}
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm">
                        {event.title}
                    </p>
                </div>

                <div className="text-right flex flex-col items-end gap-1.5">
                    <p className="text-blue-400 font-semibold text-sm">
                        📅 {event.date}
                    </p>
                    <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold select-none capitalize ${typeClass}`}>
                        {event.type}
                    </span>
                    
                    <div className="flex gap-3 mt-3 text-xxs font-semibold">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(event)}
                                className="text-slate-400 hover:text-blue-400 cursor-pointer transition uppercase tracking-wider"
                            >
                                Edit
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(event._id)}
                                className="text-slate-500 hover:text-red-400 cursor-pointer transition uppercase tracking-wider"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventCard;