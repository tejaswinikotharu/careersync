# CareerSync: AI-Powered Placement Assistant

CareerSync is a modern, real-time, AI-driven placement tracking assistant. It automatically synchronizes student mailboxes using Gmail APIs, processes placement communication using Gemini AI, compiles recruitment milestones, schedules calendar events, and provides real-time notification updates using Socket.IO.

---

## Key Features

1.  **Automated Mailbox Synchronizer**: Links student Gmail inboxes to read and classify placement invites.
2.  **Gemini AI Analyzer**: Validates and extracts key entities (categories, deadlines, priorities) using structured JSON output.
3.  **Journey Milestones Track**: Triggers automated placement timeline stages and schedules calendar events.
4.  **Real-Time Socket Sync**: Pushes real-time dashboard notifications and statistic counts to client browsers without page refreshes.
5.  **Robust Task Queues**: Manages background sync routines via BullMQ (with in-memory execute fallbacks).
6.  **Production Hardening**: Hardened with Helmet headers, rate-limiting windows, query input sanitization, and morgan logging.

---

## Project Structure

```
careersync/
├── client/                     # React Frontend client scaffolded with Vite
│   ├── src/
│   │   ├── components/         # Common navigationbars and tab sub-elements
│   │   ├── services/           # Axios network API wrappers & WebSockets clients
│   │   ├── pages/              # Main layout views (Login, Dashboard, Workspace)
│   │   └── routes/             # Client routes and navigation guards
└── server/                     # Express Node.js Server API
    ├── config/                 # Socket.IO, database, and Redis connectors
    ├── controllers/            # Request routers & controller operations
    ├── middleware/             # Authorization, validator schema checks & rate-limiters
    ├── models/                 # Database schema models (User, Email, Event, Logs)
    ├── services/               # Cron schedulers, BullMQ worker queues & AI analyzers
    └── tests/                  # Mock testing scripts
```

---

## Environment Configuration

Create a `.env` file in the appropriate directories matching the templates below:

### Client: `client/.env`
```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
```

### Server: `server/.env`
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/careersync
JWT_SECRET=YOUR_JWT_SECRET_KEY
NODE_ENV=development
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=postmessage
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

---

## Installation & Local Execution

### Prerequisites
*   Node.js (v18+)
*   npm

### Step 1: Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Step 2: Run Verification Test Suite
Ensure mock classifiers and parser formats pass validation:
```bash
cd ../server
node tests/runTests.js
```

### Step 3: Run Seeder Data (Optional)
Inserts TCS, Google, Amazon, and Oracle default workspace schemas:
```bash
# Ensure MongoDB URI is configured in server/.env
node seed.js
```

### Step 4: Run Development Servers
```bash
# Start backend server API
cd ../server
npm start

# In a separate terminal, start Vite client
cd ../client
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Deployment Instructions

For complete cloud setup instructions (MongoDB Atlas clusters, Google OAuth consent settings, Gemini API Studio configurations, Render servers, and Vercel hosting), configure the appropriate cloud environment variables as outlined above.
