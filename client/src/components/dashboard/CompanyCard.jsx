import { Link } from "react-router-dom";

function CompanyCard({ company }) {
    return (
        <Link to={`/company/${company.slug}`}>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-500 transition cursor-pointer">

                <div className="flex justify-between items-center">

                    <h2 className="text-xl font-semibold">
                        {company.name}
                    </h2>

                    <span
                        className={`px-3 py-1 rounded-full text-sm ${company.status === "Active"
                                ? "bg-green-600"
                                : "bg-gray-700"
                            }`}
                    >
                        {company.status}
                    </span>

                </div>

                <p className="text-gray-400 mt-3">
                    Next Event
                </p>

                <p className="text-white mt-1">
                    {company.nextEvent}
                </p>

            </div>
        </Link>
    );
}

export default CompanyCard;