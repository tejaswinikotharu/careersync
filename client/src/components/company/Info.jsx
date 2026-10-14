function Info({ company, userCompany }) {
    const instructions = userCompany?.importantInstructions || [];

    return (
        <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 space-y-6">
            <div>
                <h2 className="text-3xl font-extrabold text-white">
                    {company.name}
                </h2>
                {userCompany?.currentRound && (
                    <span className="inline-block mt-3 px-3 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-lg uppercase">
                        Current stage: {userCompany.currentRound}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-y border-slate-800/60 py-6 text-sm">
                <div className="space-y-3">
                    <p className="text-slate-350"><strong className="text-white">Overview:</strong> {company.overview}</p>
                    <p className="text-slate-350"><strong className="text-white">Package:</strong> {company.package}</p>
                    <p className="text-slate-350"><strong className="text-white">Eligibility:</strong> {company.eligibility}</p>
                </div>
                <div className="space-y-3">
                    <p className="text-slate-350"><strong className="text-white">Headquarters:</strong> {company.headquarters}</p>
                    {company.website && (
                        <p className="text-slate-350">
                            <strong className="text-white">Website:</strong>{" "}
                            <a
                                href={company.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                            >
                                {company.website}
                            </a>
                        </p>
                    )}
                </div>
            </div>

            {instructions.length > 0 && (
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        ⚠️ Important AI-Extracted Instructions
                    </h3>
                    <ul className="space-y-2 text-xs text-slate-300 font-semibold list-disc list-inside">
                        {instructions.map((inst, index) => (
                            <li key={index} className="leading-relaxed">
                                {inst}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div>
                <h3 className="text-xl font-semibold mb-3">
                    Default Process
                </h3>
                {company.recruitmentProcess && company.recruitmentProcess.length > 0 ? (
                    <ul className="list-decimal list-inside space-y-1.5 text-xs text-slate-400 font-medium">
                        {company.recruitmentProcess.map((step, index) => (
                            <li key={index}>{step}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-xs text-slate-500 italic">No details available.</p>
                )}
            </div>
        </div>
    );
}

export default Info;