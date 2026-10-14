const classifyEmail = (subject, bodyText) => {
    const sub = subject.toLowerCase();
    const body = bodyText.toLowerCase();
    const combined = `${sub} ${body}`;

    let category = "Placement";
    let eventType = "General Notice";

    // 1. Check for specific event type matches in order of precision

    // Mock Test / Practice Assessment
    if (combined.includes("practice assessment") || combined.includes("practice test") || combined.includes("prep assessment")) {
        eventType = "Practice Assessment";
    } else if (combined.includes("mock assessment") || combined.includes("mock test") || combined.includes("mock exam") || combined.includes("nqt mock")) {
        eventType = "Mock Test";
    }
    // Prep Kit
    else if (combined.includes("prep kit") || combined.includes("prepkit") || combined.includes("preparation kit") || combined.includes("preparation material") || combined.includes("prep material")) {
        eventType = "Prep Kit";
    }
    // Training / Workshop / Webinar
    else if (combined.includes("workshop") || combined.includes("bootcamp")) {
        eventType = "Workshop";
    } else if (combined.includes("webinar") || combined.includes("seminar") || combined.includes("guest lecture")) {
        eventType = "Webinar";
    } else if (combined.includes("company training") || combined.includes("specific training") || combined.includes("training session") || combined.includes("onboarding training")) {
        eventType = "Company Training";
    }
    // Tests (Aptitude, Coding, Technical, Online Assessment)
    else if (combined.includes("coding test") || combined.includes("coding assessment") || combined.includes("coding round") || combined.includes("hackerearth test") || combined.includes("hackerrank")) {
        eventType = "Coding Test";
    } else if (combined.includes("aptitude test") || combined.includes("aptitude assessment") || combined.includes("quant test") || combined.includes("logical reasoning")) {
        eventType = "Aptitude Test";
    } else if (combined.includes("technical test") || combined.includes("tech test") || combined.includes("technical assessment") || combined.includes("technical round test")) {
        eventType = "Technical Test";
    } else if (combined.includes("online assessment") || combined.includes("online test") || sub.includes(" oa ") || combined.includes("amcat") || combined.includes("cocubes") || combined.includes("nqt assessment")) {
        eventType = "Online Assessment";
    }
    // Interviews (Technical, HR, Group Discussion, PPT, Presentation, Schedule)
    else if (combined.includes("hr interview") || combined.includes("hr round") || combined.includes("hr discussion") || combined.includes("fitment round")) {
        eventType = "HR Interview";
    } else if (combined.includes("group discussion") || sub.includes(" gd ") || combined.includes("gd round")) {
        eventType = "Group Discussion";
    } else if (combined.includes("pre placement talk") || combined.includes("pre-placement talk") || combined.includes(" ppt ") || sub.includes("ppt ")) {
        eventType = "Company PPT";
    } else if (combined.includes("company presentation") || combined.includes("corporate presentation")) {
        eventType = "Company Presentation";
    } else if (combined.includes("interview schedule") || combined.includes("interview slot") || combined.includes("interview date") || combined.includes("interview link")) {
        eventType = "Interview Schedule";
    } else if (combined.includes("technical interview") || combined.includes("tech interview") || combined.includes("coding interview") || combined.includes("technical round")) {
        eventType = "Technical Interview";
    }
    // Offer Letter / Joining Details / Document Verification
    else if (combined.includes("offer letter") || combined.includes("intent to hire") || combined.includes("job offer") || combined.includes("selection mail") || combined.includes("selected for")) {
        eventType = "Offer Letter";
    } else if (combined.includes("joining details") || combined.includes("joining date") || combined.includes("date of joining") || combined.includes("doj") || combined.includes("onboarding details")) {
        eventType = "Joining Details";
    } else if (combined.includes("document verification") || sub.includes("dv ") || combined.includes("verify documents") || combined.includes("upload certificates") || combined.includes("bgv")) {
        eventType = "Document Verification";
    }
    // Registration Open, Deadline, Closed
    else if (combined.includes("registration open") || combined.includes("registration starts") || combined.includes("apply now") || combined.includes("register now") || combined.includes("applications are open")) {
        eventType = "Registration Open";
    } else if (combined.includes("registration closed") || combined.includes("applications closed") || combined.includes("registration is closed") || combined.includes("closed registration")) {
        eventType = "Registration Closed";
    } else if (combined.includes("registration deadline") || combined.includes("last date to register") || combined.includes("last date to apply") || combined.includes("registration closes") || combined.includes("deadline")) {
        eventType = "Registration Deadline";
    }

    // Default to Placement Category for all target workspace events
    if (eventType === "General Notice") {
        // Fallback checks
        if (combined.includes("sarthaka") || combined.includes("campus drive") || combined.includes("eligibility") || combined.includes("package")) {
            eventType = "Registration Open";
        } else {
            category = "Student Update";
            eventType = "General Notice";
        }
    }

    return { category, eventType };
};

module.exports = { classifyEmail };
