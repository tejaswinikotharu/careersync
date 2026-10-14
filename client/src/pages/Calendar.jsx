import { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import EventCard from "../components/calendar/EventCard";
import eventService from "../services/eventService";
import { getSocket } from "../services/socket";

function Calendar() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Modal Control States
    const [showModal, setShowModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null); // holds event object when editing
    
    // Form States
    const [companyName, setCompanyName] = useState("");
    const [title, setTitle] = useState("");
    const [dateString, setDateString] = useState("");
    const [eventType, setEventType] = useState("Interview");

    const fetchEvents = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const res = await eventService.getEvents();
            setEvents(res.data || []);
        } catch (err) {
            console.error(err);
            if (!silent) setError(err.response?.data?.message || err.message || "Failed to load calendar events");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();

        // Connect Socket and listen for real-time calendar updates
        const socketInstance = getSocket();
        if (socketInstance) {
            socketInstance.on("event_created", () => fetchEvents(true));
        }

        return () => {
            if (socketInstance) {
                socketInstance.off("event_created");
            }
        };
    }, []);

    const handleOpenCreateModal = () => {
        setEditingEvent(null);
        setCompanyName("");
        setTitle("");
        setDateString("");
        setEventType("Interview");
        setShowModal(true);
    };

    const handleOpenEditModal = (event) => {
        setEditingEvent(event);
        setCompanyName(event.companyName || "");
        setTitle(event.title || "");
        setDateString(event.date || "");
        setEventType(event.type || "Interview");
        setShowModal(true);
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                companyName,
                title,
                date: dateString,
                type: eventType,
            };

            if (editingEvent) {
                await eventService.updateEvent(editingEvent._id, payload);
            } else {
                await eventService.createEvent(payload);
            }

            setShowModal(false);
            fetchEvents(true);
        } catch (err) {
            alert(err.response?.data?.message || "Failed to save calendar event");
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm("Are you sure you want to delete this event?")) return;
        try {
            await eventService.deleteEvent(id);
            fetchEvents(true);
        } catch (err) {
            alert("Delete operation failed");
        }
    };

    return (
        <DashboardLayout>
            <div className="pb-6 border-b border-slate-800 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white">
                        Placement Calendar
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">
                        View assessment targets, interviews, and manual reminders.
                    </p>
                </div>
                <button
                    onClick={handleOpenCreateModal}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer shadow-md shadow-blue-500/10"
                >
                    + Schedule Event
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm animate-pulse">Loading Placement Calendar...</p>
                </div>
            ) : error ? (
                <div className="p-8 bg-red-950/20 border border-red-500/30 text-red-400 rounded-2xl text-center my-10 max-w-lg mx-auto">
                    <p className="text-lg font-bold">Failed to load Calendar</p>
                    <p className="text-sm mt-2">{error}</p>
                    <button
                        onClick={() => fetchEvents()}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <div className="space-y-5 mt-8">
                    {events.length > 0 ? (
                        events.map((event) => (
                            <EventCard
                                key={event._id}
                                event={event}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteEvent}
                            />
                        ))
                    ) : (
                        <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl text-slate-500">
                            <span className="text-4xl">📅</span>
                            <p className="text-lg font-bold mt-3 text-slate-400">No scheduled events yet</p>
                            <p className="text-xs mt-1">Schedule manual events or sync your Gmail inbox to import automated timelines.</p>
                            <button
                                onClick={handleOpenCreateModal}
                                className="mt-4 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-xl transition cursor-pointer"
                            >
                                Add Manual Event
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Event Form Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 relative">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white cursor-pointer"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-extrabold text-white mb-6">
                            {editingEvent ? "📝 Edit Calendar Event" : "📅 Schedule Calendar Event"}
                        </h2>

                        <form onSubmit={handleSaveEvent} className="space-y-4">
                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Company Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Google"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Event Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Technical Interview Round 1"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Event Date</label>
                                <input
                                    type="date"
                                    required
                                    value={dateString}
                                    onChange={(e) => setDateString(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-500 text-[10px] uppercase font-bold mb-1.5 select-none">Event Type</label>
                                <select
                                    value={eventType}
                                    onChange={(e) => setEventType(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                    <option value="Interview">Interview</option>
                                    <option value="Coding Test">Coding Test</option>
                                    <option value="Test">Aptitude / Written Test</option>
                                    <option value="Assessment">OA / Assessment</option>
                                    <option value="Deadline">Registration Deadline</option>
                                    <option value="Offer Expiry">Offer Expiry</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold text-slate-400 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                                >
                                    Save Event
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

export default Calendar;