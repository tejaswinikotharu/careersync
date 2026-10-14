const { GoogleGenAI } = require("@google/genai");

// Initialize Gemini Client
let ai = null;
if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Gemini AI Client initialized successfully using process.env.GEMINI_API_KEY");
} else {
    console.warn("process.env.GEMINI_API_KEY is missing. Gemini AI will run in mock analysis fallback mode.");
}

// structured JSON Schema returned by Gemini API (insights only)
const responseSchema = {
    type: "OBJECT",
    properties: {
        isPlacementRelated: { type: "BOOLEAN" },
        confidence: { type: "NUMBER" },
        summary: { type: "STRING" },
        importantInstructions: { type: "ARRAY", items: { type: "STRING" } },
        prepStrategy: { type: "STRING" },
        upcomingSteps: { type: "ARRAY", items: { type: "STRING" } },
        codingTopics: { type: "ARRAY", items: { type: "STRING" } },
        interviewTopics: { type: "ARRAY", items: { type: "STRING" } },
        mockTests: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    name: { type: "STRING" },
                    date: { type: "STRING" }
                },
                required: ["name"]
            }
        },
        requiredDocuments: { type: "ARRAY", items: { type: "STRING" } },
        checklist: { type: "ARRAY", items: { type: "STRING" } },
        faqs: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    answer: { type: "STRING" }
                },
                required: ["question", "answer"]
            }
        }
    },
    required: [
        "isPlacementRelated",
        "confidence",
        "summary",
        "importantInstructions",
        "prepStrategy",
        "upcomingSteps",
        "codingTopics",
        "interviewTopics",
        "mockTests",
        "requiredDocuments",
        "checklist",
        "faqs"
    ]
};

const analyzeEmailContent = async (emailData) => {
    if (!ai) {
        return mockGeminiAnalysis(emailData);
    }

    const { sender, subject, snippet, body, company } = emailData;

    const promptText = `
Analyze the following email which is received by a student. Classify if it is related to campus placements, job offers, tests, or recruitment updates.
Input Email Details:
Sender: ${sender}
Subject: ${subject}
Snippet: ${snippet}
Body: ${body}
Resolved Company: ${company || "Not specified"}

Instructions:
1. Determine if the email is placement/recruitment related (isPlacementRelated).
2. Rate confidence level from 0.0 to 1.0.
3. Provide a concise 1-sentence summary of the message.
4. Extract a list of importantInstructions / guidelines for the student. If none, return [].
5. Formulate a tailored preparation prepStrategy / suggestions.
6. Extract a list of upcomingSteps.
7. Extract or suggest codingTopics (e.g. "Dynamic Programming", "Trees") for preparation.
8. Extract or suggest interviewTopics (e.g. "OOPs", "System Design") for preparation.
9. Extract any Mock Tests scheduled (e.g. name: "Mock Test 1", date: "Monday") and return as array mockTests. If none, return [].
10. Extract a list of requiredDocuments specified in the email (e.g. "resume", "college ID card"). If none, return [].
11. Generate a checklist of preparation tasks for this event.
12. Generate a list of frequently asked questions (FAQs) with answers relevant to this company and event.

CRITICAL: Do NOT attempt to extract or return company names, registration links, coding test dates, or interview dates. Those are handled deterministically. Focus strictly on summarization, FAQs, checklists, and strategy/preparation insights.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: promptText,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const resultText = response.text;
        return JSON.parse(resultText);
    } catch (error) {
        console.error("Gemini API call failed, falling back to mock parser:", error.message);
        return mockGeminiAnalysis(emailData);
    }
};

const generateCompanyProfile = async (companyName) => {
    if (!ai) {
        return {
            website: `https://${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
            headquarters: "Bengaluru, India",
            overview: `${companyName} is a leading global technology company specializing in advanced engineering and software solutions.`,
            type: "Product"
        };
    }

    const promptText = `
Generate a stable company profile for the company: ${companyName}.
Do not include any student-specific, year-specific, or placement-specific information. Only provide static global details about the company itself.
Return a JSON object conforming exactly to this schema:
{
  "website": "official URL of the company",
  "headquarters": "City, Country",
  "overview": "A description of the company (2-3 sentences)",
  "type": "Product" or "Service" or "Startup"
}
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: promptText,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        website: { type: "STRING" },
                        headquarters: { type: "STRING" },
                        overview: { type: "STRING" },
                        type: { type: "STRING" }
                    },
                    required: ["website", "headquarters", "overview", "type"]
                }
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("Failed to generate company profile via Gemini, falling back to defaults:", error.message);
        return {
            website: `https://${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
            headquarters: "Unknown Location",
            overview: `${companyName} is a global company.`,
            type: "Product"
        };
    }
};

const extractCompanyName = (subject, body, sender) => {
    if (subject) {
        const separators = ["||", "|", " - ", " : ", "–"];
        let segments = [subject];
        for (const sep of separators) {
            if (subject.includes(sep)) {
                segments = subject.split(sep);
                break;
            }
        }

        const ignoreKeywords = [
            "deadline", "registration", "apply", "link", "batch", "class", "lpa", "cgpa", 
            "eligible", "eligibility", "sarthaka", "placement", "internship", "job", "role", 
            "gitam", "university", "college", "campus", "drive", "test", "exam", "assessment", 
            "interview", "schedule", "hiring", "recruitment", "update", "alert", "notification", 
            "important", "reminder", "batch of", "joined", "offer", "congratulations"
        ];

        for (let seg of segments) {
            seg = seg.replace(/[\[\]\(\)]/g, "").trim();
            if (!seg) continue;
            
            const lowerSeg = seg.toLowerCase();
            const shouldIgnore = ignoreKeywords.some(keyword => lowerSeg.includes(keyword));
            if (!shouldIgnore && seg.length > 1 && seg.length < 30) {
                return seg;
            }
        }
    }

    return "Unknown";
};

// Mock analyzer supporting seed values for offline testing (insights only)
const mockGeminiAnalysis = (emailData) => {
    const text = `${emailData.subject} ${emailData.body} ${emailData.snippet}`.toLowerCase();
    const companyName = emailData.company || extractCompanyName(emailData.subject, emailData.body, emailData.sender);

    let requiredDocuments = [];
    let importantInstructions = [];
    let mockTests = [];
    let upcomingSteps = ["Practice Coding", "Check dates"];
    let prepStrategy = "Focus on DSA and system design patterns.";
    let codingTopics = ["Arrays", "Strings"];
    let interviewTopics = ["OOPs", "Resume discussion"];
    let checklist = ["Revise sorting algorithms", "Prepare resume overview"];
    let faqs = [
        { question: `What is the typical selection process for ${companyName}?`, answer: "It usually involves an Online Assessment (Coding + Aptitude) followed by 1-2 Technical Interviews and an HR Round." },
        { question: "What resources should I use to prepare?", answer: "Focus on GeeksforGeeks, Leetcode (easy-medium), and core computer science fundamentals (OS, DBMS, OOPs)." }
    ];

    if (text.includes("test") || text.includes("exam") || text.includes("assessment")) {
        requiredDocuments = ["College ID Card", "Government Photo ID"];
        importantInstructions = ["Keep camera enabled throughout the test", "Do not toggle tabs or windows"];
        upcomingSteps = ["Revise DSA Arrays & Strings", `Complete ${companyName} mock assessment`].filter(Boolean);
        codingTopics = ["Arrays", "Strings", "Recursion"];
        checklist.push("Take mock test to check camera settings");
    } else if (text.includes("interview")) {
        requiredDocuments = ["Government Photo ID", "Resume Copy"];
        importantInstructions = ["Join the interview link 10 minutes early", "Ensure a quiet room with good internet"];
        upcomingSteps = ["Review OOPS concepts", "Read system design guidelines"];
        interviewTopics = ["OOPs", "System Design", "Networking"];
        checklist.push("Mock interview practice");
    } else if (text.includes("apply") || text.includes("registration") || text.includes("deadline")) {
        requiredDocuments = ["Resume PDF", "Latest GPA Transcript"];
        importantInstructions = ["Make sure all details match your college records", "Incomplete applications will be rejected"];
        upcomingSteps = ["Fill out portal details", "Upload latest resume"];
    } else if (text.includes("mock")) {
        mockTests = [
            { name: "Mock Test 1", date: "Monday" },
            { name: "Mock Test 2", date: "Wednesday" },
            { name: "Technical Mock Interview", date: "Friday" }
        ];
        upcomingSteps = ["Revise aptitude questions", "Prepare mock presentation"];
    }

    return {
        isPlacementRelated: text.includes("placement") || text.includes("interview") || text.includes("test") || text.includes("registration") || companyName !== "Unknown",
        confidence: 0.95,
        summary: `Synched recruitment update related to ${companyName} processes.`,
        importantInstructions,
        prepStrategy,
        upcomingSteps,
        codingTopics,
        interviewTopics,
        mockTests,
        requiredDocuments,
        checklist,
        faqs
    };
};

module.exports = {
    analyzeEmailContent,
    generateCompanyProfile,
};
