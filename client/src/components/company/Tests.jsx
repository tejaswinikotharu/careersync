function Tests({ userCompany, onToggleMockTest }) {
    const mockTests = userCompany?.mockTests || [];

    return (
        <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 shadow-md">
            <h2 className="text-2xl font-bold mb-2 text-white">
                Mock Tests Checklist
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Check off mock tests as you complete them. These steps are automatically synced from incoming placement preparation emails.
            </p>

            {mockTests.length > 0 ? (
                <div className="space-y-3.5">
                    {mockTests.map((test) => (
                        <label 
                            key={test._id} 
                            className="flex items-center gap-3.5 p-3.5 bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl transition cursor-pointer select-none"
                        >
                            <input
                                type="checkbox"
                                checked={test.completed}
                                onChange={(e) => onToggleMockTest(test._id, e.target.checked)}
                                className="w-4.5 h-4.5 rounded border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                            />
                            <span className={`text-sm font-semibold transition ${
                                test.completed ? "text-slate-500 line-through font-normal" : "text-slate-200"
                            }`}>
                                {test.name}
                            </span>
                        </label>
                    ))}
                </div>
            ) : (
                <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs italic">
                    No mock tests extracted for this company yet.
                </div>
            )}
        </div>
    );
}

export default Tests;