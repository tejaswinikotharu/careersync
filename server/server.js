require("dotenv").config();

// Validate critical environment configuration variables at startup
const requiredEnv = ["MONGO_URI", "JWT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const missingEnv = requiredEnv.filter((envName) => !process.env[envName]);

if (missingEnv.length > 0) {
    console.error("==================================================");
    console.error("CRITICAL STARTUP ERROR: Missing Environment Variables!");
    console.error("Ensure the following keys exist in your .env file:");
    missingEnv.forEach((env) => console.error(`  - ${env}`));
    console.error("==================================================");
    process.exit(1);
}

const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const { initSocket } = require("./config/socket");
const { initScheduler } = require("./services/scheduler/cronScheduler");
const { initQueueService } = require("./services/queues/queueService");

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Real-Time WebSockets
initSocket(server);

// Initialize Cron Schedulers and Job Queues
initScheduler();
initQueueService();

// Logger Middleware
if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
} else {
    app.use(morgan("combined"));
}

// Security & Production Middlewares
app.use(helmet());
app.use(compression());
app.use(mongoSanitize());
app.use(cookieParser());

// CORS Whitelist Configuration
const allowedOrigins = ["http://localhost:5173", "http://localhost:5174"];
if (process.env.CORS_ORIGIN) {
    allowedOrigins.push(process.env.CORS_ORIGIN);
}

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== "production") {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "development" ? 10000 : 200, // Limit each IP to 10000 requests in development
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes",
    },
});
app.use("/api/", apiLimiter);

// Input Parser Middlewares
app.use(express.json({ limit: "10kb" })); // Body limit to prevent DDoS
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// Basic Status Route
app.get("/status", (req, res) => {
    res.json({ success: true, message: "CareerSync API is running" });
});

// Serve static upload file directory
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Mount Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/auth/google", require("./routes/googleAuthRoutes"));
app.use("/api/companies", require("./routes/companyRoutes"));
app.use("/api/user-companies", require("./routes/userCompanyRoutes"));
app.use("/api/gmail", require("./routes/gmailRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));
app.use("/api/search", require("./routes/searchRoutes"));
app.use("/api/student-updates", require("./routes/studentUpdateRoutes"));
app.use("/api/settings/email-sources", require("./routes/emailSourceRoutes"));

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
});
