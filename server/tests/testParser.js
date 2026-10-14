const { parsePlacementEmail } = require("../parser/placementParser");

const runParserTests = async () => {
    console.log("==========================================");
    console.log("RUNNING DETERMINISTIC PLACEMENT PARSER TESTS...");
    console.log("==========================================");

    let passed = 0;
    let failed = 0;

    // Test Case 1: ZopSmart Gitam Subject delimiter
    const email1 = {
        _id: "6a47be00aa5902333545b8d9",
        userId: "6a47be00aa5902333545b8d2",
        sender: "asraya_cgcv2@gitam.in",
        subject: "Sarthaka IISK-VCS270002 || ZopSmart || 2027 Batch || Deadline 22-Jun",
        plainText: "We invite you to apply. Package is 12 LPA and CGPA criteria is 7.5. Apply at https://careers.zopsmart.com/jobs/apply",
        attachments: []
    };

    try {
        const parsed1 = await parsePlacementEmail(email1);
        console.log("▶ Test Case 1: ZopSmart Gitam Subject delimiter");
        
        if (parsed1.company !== "ZopSmart") {
            throw new Error(`Expected company ZopSmart, got ${parsed1.company}`);
        }
        if (parsed1.batch !== "2027") {
            throw new Error(`Expected batch 2027, got ${parsed1.batch}`);
        }
        if (parsed1.event !== "Registration") {
            throw new Error(`Expected event Registration, got ${parsed1.event}`);
        }
        if (parsed1.package !== "12 LPA") {
            throw new Error(`Expected package 12 LPA, got ${parsed1.package}`);
        }
        if (parsed1.registrationLink !== "https://careers.zopsmart.com/jobs/apply") {
            throw new Error(`Expected apply link, got ${parsed1.registrationLink}`);
        }
        console.log("✓ Test Case 1 Passed!");
        passed++;
    } catch (err) {
        console.error("✗ Test Case 1 Failed:", err.message);
        failed++;
    }

    // Test Case 2: Corporate Domain
    const email2 = {
        _id: "6a47be00aa5902333545b8da",
        userId: "6a47be00aa5902333545b8d2",
        sender: "careers@google.com",
        subject: "Your Application Status Update",
        plainText: "Thank you for applying to the Software Engineer role at Google. Work location Bangalore.",
        attachments: []
    };

    try {
        const parsed2 = await parsePlacementEmail(email2);
        console.log("\n▶ Test Case 2: Corporate Domain matching");
        
        if (parsed2.company !== "Google") {
            throw new Error(`Expected company Google, got ${parsed2.company}`);
        }
        if (parsed2.role !== "Software Engineer") {
            throw new Error(`Expected role Software Engineer, got ${parsed2.role}`);
        }
        if (parsed2.location !== "Bangalore") {
            throw new Error(`Expected location Bangalore, got ${parsed2.location}`);
        }
        console.log("✓ Test Case 2 Passed!");
        passed++;
    } catch (err) {
        console.error("✗ Test Case 2 Failed:", err.message);
        failed++;
    }

    // Test Case 3: Unknown Fallback
    const email3 = {
        _id: "6a47be00aa5902333545b8db",
        userId: "6a47be00aa5902333545b8d2",
        sender: "unknown-coordinator@gitam.in",
        subject: "URGENT update for 2027 batch",
        plainText: "The test date is 10-Jul. Please ensure all documents are ready.",
        attachments: []
    };

    try {
        const parsed3 = await parsePlacementEmail(email3);
        console.log("\n▶ Test Case 3: Unknown Fallback verification");
        
        if (parsed3.company !== "Unknown") {
            throw new Error(`Expected company Unknown, got ${parsed3.company}`);
        }
        console.log("✓ Test Case 3 Passed!");
        passed++;
    } catch (err) {
        console.error("✗ Test Case 3 Failed:", err.message);
        failed++;
    }

    // Test Case 4: Numeric-only Compensation Formats (Positive cases)
    const testCases4 = [
        { label: "SDE - 10.00", text: "Compensation/Salary Details: SDE - 10.00", expected: "10.00 LPA" },
        { label: "Package: 8", text: "Package: 8", expected: "8 LPA" },
        { label: "Compensation : 12.5", text: "Compensation : 12.5", expected: "12.5 LPA" },
        { label: "Salary Details : 18", text: "Salary Details : 18", expected: "18 LPA" }
    ];

    console.log("\n▶ Test Case 4: Numeric-only Compensation Formats");
    for (const tc of testCases4) {
        const email = {
            subject: "Sarthaka ||SK-VCS270001 || TCS || 2027 Batch || Deadline 11-Jul",
            plainText: tc.text,
            attachments: []
        };
        try {
            const parsed = await parsePlacementEmail(email);
            if (parsed.package !== tc.expected) {
                throw new Error(`For "${tc.label}", expected "${tc.expected}", but got "${parsed.package}"`);
            }
            console.log(`  ✓ Passed: "${tc.label}" -> ${parsed.package}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ Failed: "${tc.label}" - ${err.message}`);
            failed++;
        }
    }

    // Test Case 5: Fallback Parser Negative Cases
    const testCases5 = [
        { label: "Eligibility: 8 CGPA", text: "Eligibility: 8 CGPA" },
        { label: "Deadline: 22-Jun-2026 11:00 AM", text: "Deadline: 22-Jun-2026 11:00 AM" }
    ];

    console.log("\n▶ Test Case 5: Fallback Parser Negative Cases (should remain N/A)");
    for (const tc of testCases5) {
        const email = {
            subject: "Sarthaka ||SK-VCS270001 || TCS || 2027 Batch || Deadline 11-Jul",
            plainText: tc.text,
            attachments: []
        };
        try {
            const parsed = await parsePlacementEmail(email);
            if (parsed.package !== "N/A") {
                throw new Error(`For "${tc.label}", expected "N/A", but got "${parsed.package}"`);
            }
            console.log(`  ✓ Passed: "${tc.label}" -> ${parsed.package}`);
            passed++;
        } catch (err) {
            console.error(`  ✗ Failed: "${tc.label}" - ${err.message}`);
            failed++;
        }
    }

    console.log("\n==========================================");
    console.log(`PARSER TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================");

    if (failed > 0) {
        process.exit(1);
    }
};

runParserTests();
