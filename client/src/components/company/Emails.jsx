function Emails({ emails }) {

    if (!emails || emails.length === 0) {
        return (
            <div className="bg-slate-900 p-8 rounded-xl">
                No Emails
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {emails.map((mail) => (

                <div
                    key={mail.id}
                    className="bg-slate-900 p-6 rounded-xl border border-slate-800"
                >

                    <h2 className="font-bold">
                        {mail.subject}
                    </h2>

                    <p className="text-sm text-gray-400">
                        {mail.sender}
                    </p>

                    <p className="mt-4">
                        {mail.body}
                    </p>

                </div>

            ))}

        </div>
    );
}

export default Emails;