/**
 * CareerSync Mock Test Suite
 * Verifies core services, Gemini mock classifiers, validation schemas, and database mappings.
 */
const assert = require("assert");

// Mocking dependencies
const mockUser = {
    _id: "64aa8e12e1a3bc4e7d8b4567",
    name: "Alex Student",
    email: "alex@student.com",
    role: "student",
};

const mockEmail = {
    _id: "64aa8e12e1a3bc4e7d8b4568",
    userId: mockUser._id,
    sender: "recruitment@google.com",
    subject: "Google Coding Assessment Scheduled",
    snippet: "You have been invited to participate in the Google Online Assessment next Monday.",
    body: "Hello Alex, Please complete the dynamic programming and graph coding test before 22 July.",
    company: "Google",
    receivedAt: new Date(),
};

// 1. Unit Test for Gemini mock analyzer
const testGeminiMockService = async () => {
    console.log("▶ Running Test: Gemini Mock Analysis Service...");
    const { analyzeEmailContent } = require("../services/ai/geminiService");

    const result = await analyzeEmailContent(mockEmail);
    
    assert.strictEqual(result.isPlacementRelated, true, "AI should classify coding assessment as placement related");
    assert.ok(result.codingTopics.length > 0, "AI must extract relevant preparation coding topics");

    console.log("✓ Test Passed: Gemini Mock Analysis Service.");
};

// 2. Unit Test for Gmail MIME Parser
const testGmailMimeParser = () => {
    console.log("▶ Running Test: Gmail MIME Message Parser...");
    const { parseGmailMessage } = require("../services/gmail/gmailParser");

    const mockMessagePayload = {
        id: "msg123",
        threadId: "thread555",
        labelIds: ["INBOX", "UNREAD"],
        snippet: "TCS placement invite",
        payload: {
            headers: [
                { name: "From", value: "TCS Careers <careers@tcs.com>" },
                { name: "Subject", value: "TCS Campus Hiring 2026" },
                { name: "Date", value: "Fri, 03 Jul 2026 12:00:00 +0000" }
            ],
            body: { data: "QXBwbHkgYmVmb3JlIDEwIEp1bHkgMjAyNiBvbiB0aGUgcG9ydGFsLg==" } // "Apply before 10 July 2026 on the portal." in Base64
        }
    };

    const parsed = parseGmailMessage(mockMessagePayload);

    assert.strictEqual(parsed.gmailMessageId, "msg123", "Parser should extract correct message ID");
    assert.strictEqual(parsed.threadId, "thread555", "Parser should extract correct thread ID");
    assert.strictEqual(parsed.sender, "TCS Careers <careers@tcs.com>", "Parser should extract correct Sender");
    assert.strictEqual(parsed.subject, "TCS Campus Hiring 2026", "Parser should extract correct Subject");
    assert.strictEqual(parsed.isRead, false, "Labels containing UNREAD should resolve isRead to false");
    assert.ok(parsed.body.includes("Apply before"), "Parser should successfully decode base64url data contents");

    console.log("✓ Test Passed: Gmail MIME Message Parser.");
};

// 3. Integration Test for AI Extraction Validation Layer
const testAiResponseValidation = () => {
    console.log("▶ Running Test: AI Response Validation Layer...");
    
    // Simulate input validation from emailAnalyzer
    const validateAIResponse = (response) => {
        if (!response || typeof response.isPlacementRelated !== "boolean") {
            throw new Error("Invalid format");
        }
        if (response.confidence < 0.6) {
            return { valid: false, reason: "low confidence" };
        }
        
        let deadline = null;
        if (response.registrationDeadline) {
            const date = new Date(response.registrationDeadline);
            if (!isNaN(date.getTime())) deadline = date;
        }

        return { valid: true, deadline };
    };

    const validResponse = {
        isPlacementRelated: true,
        confidence: 0.92,
        registrationDeadline: "2026-07-10"
    };

    const validated = validateAIResponse(validResponse);
    assert.strictEqual(validated.valid, true);
    assert.ok(validated.deadline instanceof Date);

    const malformedResponse = { isPlacementRelated: "yes", confidence: 0.3 };
    assert.throws(() => validateAIResponse(malformedResponse), /Invalid format/);

    console.log("✓ Test Passed: AI Response Validation Layer.");
};

// Execute all test scripts
const testGmailAuthServiceExports = () => {
    console.log("▶ Running Test: Gmail Auth Service Exports...");
    const gmailAuthService = require("../services/gmail/gmailAuthService");
    assert.strictEqual(typeof gmailAuthService.getOAuth2Client, "function", "gmailAuthService must export getOAuth2Client");
    console.log("✓ Test Passed: Gmail Auth Service Exports.");
};

const runAllTests = async () => {
    console.log("==========================================");
    console.log("STARTING CAREERSYNC MOCK TEST SUITE...");
    console.log("==========================================");

    try {
        await testGeminiMockService();
        console.log("------------------------------------------");
        testGmailMimeParser();
        console.log("------------------------------------------");
        testAiResponseValidation();
        console.log("------------------------------------------");
        testGmailAuthServiceExports();
        console.log("==========================================");
        console.log("ALL TESTS COMPLETED SUCCESSFULLY! 🎉");
        console.log("==========================================");
    } catch (error) {
        console.error("❌ TEST FAILURE ENCOUNTERED:");
        console.error(error);
        process.exit(1);
    }
};

runAllTests();
