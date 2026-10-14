const companyDirectory = {
    tcs: {
        website: "https://www.tcs.com",
        careers: "https://www.tcs.com/careers",
        linkedin: "https://www.linkedin.com/company/tata-consultancy-services",
        description: "Tata Consultancy Services (TCS) is an Indian multinational information technology (IT) services and consulting company headquartered in Mumbai.",
        industry: "IT Services & IT Consulting",
        size: "10,000+ employees",
        headquarters: "Mumbai, India",
        technologies: ["Java", "Spring Boot", "React", "Node.js", "SQL", "Docker", "AWS", "Python", "Kubernetes"],
        hiringDomain: ["Enterprise Systems", "Consulting", "Information Technology", "Cloud Infrastructure"]
    },
    zopsmart: {
        website: "https://www.zopsmart.com",
        careers: "https://www.zopsmart.com/careers",
        linkedin: "https://www.linkedin.com/company/zopsmart",
        description: "ZopSmart is a technology company offering retail tech solutions, specializing in building e-commerce systems, omni-channel retail software, and logistics solutions.",
        industry: "Software Development",
        size: "201-500 employees",
        headquarters: "Bengaluru, India",
        technologies: ["Golang", "React", "Python", "Docker", "GCP", "Kubernetes", "PostgreSQL", "Kafka"],
        hiringDomain: ["Retail Tech", "E-commerce Solutions", "Logistics", "SaaS"]
    },
    axtria: {
        website: "https://www.axtria.com",
        careers: "https://www.axtria.com/careers",
        linkedin: "https://www.linkedin.com/company/axtria",
        description: "Axtria is a global software and data analytics provider to the life sciences and healthcare industries, offering cloud-based commercial solutions.",
        industry: "Biotechnology Research & Analytics",
        size: "1,001-5,000 employees",
        headquarters: "Berkeley Heights, NJ, USA",
        technologies: ["Python", "Spark", "SQL", "AWS", "Snowflake", "R", "Scala", "Tableau", "PowerBI"],
        hiringDomain: ["Life Sciences Analytics", "Healthcare Consulting", "Cloud Data Platforms", "Commercial Operations"]
    },
    amazon: {
        website: "https://www.amazon.jobs",
        careers: "https://www.amazon.jobs",
        linkedin: "https://www.linkedin.com/company/amazon",
        description: "Amazon.com, Inc. is an American multinational technology company focusing on e-commerce, cloud computing, online advertising, and artificial intelligence.",
        industry: "Software Development",
        size: "10,000+ employees",
        headquarters: "Seattle, WA, USA",
        technologies: ["Java", "C++", "Python", "Go", "AWS", "DynamoDB", "Linux", "Kubernetes"],
        hiringDomain: ["E-commerce Systems", "Cloud Computing", "Artificial Intelligence", "Logistics Tech"]
    },
    oracle: {
        website: "https://www.oracle.com",
        careers: "https://www.oracle.com/careers",
        linkedin: "https://www.linkedin.com/company/oracle",
        description: "Oracle Corporation is an American computer technology corporation offering database software, cloud engineering systems, and enterprise software products.",
        industry: "Software Development",
        size: "10,000+ employees",
        headquarters: "Austin, TX, USA",
        technologies: ["Java", "SQL", "PL/SQL", "Oracle Database", "Docker", "OCI", "JavaScript", "C++"],
        hiringDomain: ["Database Management Systems", "Cloud Engineering", "Enterprise Software", "Analytics"]
    },
    nvidia: {
        website: "https://www.nvidia.com",
        careers: "https://www.nvidia.com/careers",
        linkedin: "https://www.linkedin.com/company/nvidia",
        description: "Nvidia is an American multinational technology company specializing in artificial intelligence hardware, graphic processing units (GPUs), and mobile technologies.",
        industry: "Semiconductor Manufacturing & AI",
        size: "10,000+ employees",
        headquarters: "Santa Clara, CA, USA",
        technologies: ["CUDA", "C++", "Python", "PyTorch", "TensorFlow", "C", "Linux", "Docker"],
        hiringDomain: ["GPU Hardware Design", "Deep Learning Architectures", "Autonomous Driving", "Gaming Systems"]
    },
    google: {
        website: "https://www.google.com",
        careers: "https://careers.google.com",
        linkedin: "https://www.linkedin.com/company/google",
        description: "Google LLC is an American multinational technology company focusing on search engine technology, online advertising, cloud computing, computer software, and quantum computing.",
        industry: "Software Development & Internet Services",
        size: "10,000+ employees",
        headquarters: "Mountain View, CA, USA",
        technologies: ["Go", "C++", "Python", "Java", "JavaScript", "Kubernetes", "GCP", "Angular", "TensorFlow"],
        hiringDomain: ["Search Engines", "Cloud Services", "Consumer Electronics", "AI Research", "AdTech"]
    },
    accenture: {
        website: "https://www.accenture.com",
        careers: "https://www.accenture.com/careers",
        linkedin: "https://www.linkedin.com/company/accenture",
        description: "Accenture is a global professional services company specializing in digital, cloud, and security services across multiple industries.",
        industry: "IT Services & Consulting",
        size: "10,000+ employees",
        headquarters: "Dublin, Ireland",
        technologies: ["Java", "Spring Boot", "React", "AWS", "Azure", "GCP", "SQL", "Salesforce", "SAP"],
        hiringDomain: ["Digital Transformation Consulting", "System Integration", "Cloud Consulting", "Cybersecurity"]
    }
};

/**
 * Returns deterministic company metadata from directory or fallback.
 * @param {string} companyName
 * @returns {Object} Deterministic company facts
 */
const getDeterministicContext = (companyName) => {
    const key = (companyName || "").toLowerCase().trim();
    const cleanName = companyName || "Unknown Enterprise";
    
    if (companyDirectory[key]) {
        return {
            companyName: cleanName,
            ...companyDirectory[key],
            contextVersion: "directory_v1.0"
        };
    }
    
    // Normalized fallback for unknown companies
    const domainPart = key.replace(/[^a-z0-9]/g, "");
    return {
        companyName: cleanName,
        website: `https://www.${domainPart}.com`,
        careers: `https://www.${domainPart}.com/careers`,
        linkedin: `https://www.linkedin.com/company/${domainPart}`,
        description: `${cleanName} is a global business enterprise.`,
        industry: "Technology Services",
        size: "1,000-5,000 employees",
        headquarters: "Unknown Location",
        technologies: ["Java", "React", "Python", "SQL", "AWS"],
        hiringDomain: ["Software Engineering", "Systems Operations"],
        contextVersion: "directory_v1.0"
    };
};

module.exports = {
    getDeterministicContext
};
