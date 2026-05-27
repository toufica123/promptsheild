# PromptShield AI - Enterprise LLM Data Firewall & Compliance Gateway

**PromptShield** is an enterprise-grade security layer that prevents sensitive data (PII, API keys, corporate secrets) from leaking to external LLM providers while actively auditing AI-generated code for copyleft license violations (GPL v2/v3, AGPL).

Works seamlessly with **ChatGPT**, **Google Gemini**, **Claude**, **DeepSeek**, and other AI chat platforms.

---

## 🏗️ System Architecture

PromptShield operates as a three-tier stack:

```
┌─────────────────────────────────────────────────────────────────┐
│ User Input (ChatGPT / Gemini / Claude)                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────▼────────────────┐
         │ PromptShield Chrome Ext (MV3) │  ← Intercepts prompts
         │ • Content Scripts             │  ← DOM MutationObserver
         │ • Popup Dashboard             │  ← Unmasking streams
         └─────────────┬──────────────────┘
                       │ HTTP API (localhost:5000)
         ┌─────────────▼──────────────────────┐
         │ AI Firewall Backend (Express)      │  ← Masking & Unmasking
         │ • /api/proxy/mask                  │  ← Token mapping
         │ • /api/proxy/unmask                │  ← License scanning
         │ • /api/proxy/chat                  │  ← Audit logging
         └─────────────┬──────────────────────┘
                       │
         ┌─────────────┴──────────────────┐
         │                                 │
    ┌────▼──────────┐         ┌──────────▼────┐
    │ Omnishield     │         │ MongoDB        │
    │ Core SDK       │         │ Audit Logs &   │
    │ • PII Scanner  │         │ Secret Maps    │
    │ • AST Parser   │         │                │
    │ • License      │         │                │
    │   Matcher      │         │                │
    └────────────────┘         └────────────────┘
```

### Component Overview

| Component | Location | Purpose | Tech Stack |
|-----------|----------|---------|-----------|
| **Chrome Extension** | `promptshield-chrome-extension/` | Intercept & unmask in real-time | Manifest V3, DOM APIs |
| **Backend Gateway** | `ai-firewall-backend/` | Masking, unmasking, audit logs | Express, MongoDB, Mongoose |
| **Core SDK** | `sdk_module/omnishield-core-sdk/` | PII detection, AST parsing, license scanning | Node.js, zero-dependencies |
| **Frontend Dashboard** | `app/` | Admin UI (Next.js) | Next.js 16, React 19, Tailwind |

---

## 🔄 Data Flow

### Outbound Flow: Masking Sensitive Data

1. **User types a prompt** with sensitive info (e.g., `API_KEY=sk-proj-abc123` or `email@company.com`)
2. **Extension intercepts** the contenteditable element (Quill, ProseMirror)
3. **POST to `/api/proxy/mask`** with raw prompt text
4. **Backend scans** using Omnishield SDK:
   - Detects API keys, emails, SSNs, IP addresses, URLs
   - Detects proprietary project names via local LLM (Ollama)
   - Detects prompt injection patterns
5. **Generates tokens** (e.g., `[omni-gcp-sk123]`, `[omni-email-456]`)
6. **Stores mapping** in MongoDB (tied to session ID)
7. **Returns masked prompt** to extension
8. **Extension swaps text** in the DOM and sends to LLM

### Inbound Flow: Unmasking & Compliance Audit

1. **LLM streams response** back through backend proxy
2. **Backend AST parser** scans code blocks for:
   - GPL v2/v3 / AGPL copyleft signatures (75%+ threshold)
   - Malicious patterns
3. **If violations found**:
   - Log audit record to MongoDB
   - Prepend compliance warning banner
4. **Extension receives response**:
   - MutationObserver scans for placeholders
   - Requests unmasking via background worker
   - Dynamically restores original values in DOM
5. **User sees unmasked response** with compliance warnings (if any)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ ([download](https://nodejs.org))
- **MongoDB** (local or cloud):
  - Local: `mongod` running on `mongodb://localhost:27017`
  - Cloud: MongoDB Atlas connection string in `.env`
- **Google Chrome** browser (for extension testing)

### 1️⃣ Backend Setup

```bash
# Navigate to backend
cd ai-firewall-backend

# Create .env file
cat > .env << EOF
PORT=5000
MONGO_URI=mongodb://localhost:27017/promptshield
GROQ_API_KEY=your_groq_key_here
OPENAI_API_KEY=your_openai_key_here
NODE_ENV=development
EOF

# Install dependencies
npm install

# Start server
npm run dev
# Server runs on http://localhost:5000
```

### 2️⃣ Chrome Extension Setup

1. Open `chrome://extensions` in Google Chrome
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select `promptshield-chrome-extension/` folder
5. Click the extension icon in the toolbar

### 3️⃣ Test It Out

Open a prompt in **ChatGPT** or **Gemini**:

```
My API key is sk-proj-1234567890abcdef and my email is dev@mycompany.com
```

Click the **PromptShield** extension button. The text should be masked with placeholders before sending to the LLM.

---

## 📋 Testing Prompts (Console)

Run these in the browser console (`F12`) while the extension is active:

```javascript
// Test 1: Check gateway health
chrome.runtime.sendMessage({ action: 'checkHealth' }, (res) => {
  console.log('Gateway Status:', res);
});

// Test 2: Mask a sensitive prompt
const testPrompt = "API Key: AIzaSyB... Email: admin@internal.com";
chrome.runtime.sendMessage(
  { action: 'maskPrompt', data: testPrompt },
  (res) => console.log('Masked:', res)
);

// Test 3: Update stats in UI
chrome.storage.local.set({
  stats: {
    keysBlocked: 10,
    emailsShielded: 25,
    piiProtected: 15,
    complianceWarnings: 3
  }
});
```

---

## 📁 Project Structure

```
promptsheild/
├── README.md                              # This file
├── CONTEXT.md                             # Full technical reference
├── AGENTS.md                              # AI coding agent rules
├── CLAUDE.md                              # Claude-specific instructions
├── package.json                           # Root workspace
├── tsconfig.json                          # TypeScript config
│
├── app/                                   # Next.js admin dashboard
│   ├── layout.tsx                         # Root layout
│   ├── page.tsx                           # Home page
│   └── globals.css                        # Global styles
│
├── components/
│   └── ui/                                # Reusable components
│       └── button.tsx
│
├── lib/
│   └── utils.ts                           # Helper functions
│
├── promptshield-chrome-extension/         # MV3 Chrome Extension
│   ├── manifest.json                      # Extension config
│   ├── background.js                      # Service worker
│   ├── content.js                         # DOM injection
│   ├── popup.html                         # Dashboard UI
│   ├── popup.css                          # Styling
│   └── popup.js                           # Popup logic
│
├── ai-firewall-backend/                   # Express Gateway (Port 5000)
│   ├── server.js                          # Entry point
│   ├── package.json                       # Dependencies
│   │
│   ├── config/
│   │   └── db.js                          # MongoDB connection
│   │
│   ├── models/
│   │   └── AuditLog.js                    # Mongoose schema
│   │
│   ├── controllers/
│   │   └── proxyController.js             # Route handlers
│   │
│   ├── routes/
│   │   └── proxyRoutes.js                 # API routes
│   │
│   ├── middleware/
│   │   └── logger.js                      # Request logging
│   │
│   ├── services/
│   │   ├── maskingService.js              # Token masking
│   │   ├── openaiService.js               # LLM integration
│   │   ├── promptInjectionService.js      # Injection detection
│   │   ├── riskService.js                 # Risk scoring
│   │   └── codeAnalysis/
│   │       ├── astParser.js               # JS/TS AST parsing
│   │       ├── licenseMatcher.js          # License detection
│   │       └── textExtractor.js           # Code extraction
│   │
│   └── test/
│       └── code-analysis.test.js          # Test suite
│
└── sdk_module/
    └── omnishield-core-sdk/               # Standalone SDK
        ├── index.js                       # Public API
        ├── ai-scanner.js                  # LLM-based scanner
        ├── test-sdk.js                    # Integration tests
        └── test-edge-cases.js             # Stress tests
```

---

## 🔐 Security Features

### Outbound Protection
- ✅ **API Key Detection**: AWS, GCP, OpenAI, Hugging Face, etc.
- ✅ **PII Redaction**: SSNs, emails, phone numbers, credit cards
- ✅ **Proprietary Data**: Project names, financial figures (via local LLM)
- ✅ **Prompt Injection Detection**: Filters bypass attempts before masking
- ✅ **URL & IP Filtering**: Blocks internal IPs and corporate URLs

### Inbound Protection
- ✅ **Copyleft License Detection**: GPL v2/v3, AGPL (75%+ structural similarity)
- ✅ **AST Parsing**: JavaScript/TypeScript code analysis (Acorn)
- ✅ **Audit Logging**: All mask/unmask events stored in MongoDB
- ✅ **Risk Scoring**: Severity-based compliance warnings

---

## 🛠️ API Endpoints

All endpoints are proxied through the Express gateway on `http://localhost:5000`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/proxy/mask` | POST | Mask sensitive data in prompts |
| `/api/proxy/unmask` | POST | Restore masked placeholders |
| `/api/proxy/chat` | POST | Proxy LLM chat with license scanning |
| `/api/audit/logs` | GET | Retrieve audit logs |

See [CONTEXT.md](CONTEXT.md) for full request/response schemas.

---

## 🧪 Running Tests

### Backend Code Analysis Tests
```bash
cd ai-firewall-backend
npm test
# Output: 10/10 tests passing ✅
```

### SDK Validation
```bash
cd sdk_module/omnishield-core-sdk
node test-sdk.js
node test-edge-cases.js
```

---

## 📞 Support & Troubleshooting

### Extension Not Detecting Prompts?
1. Ensure backend is running: `npm run dev` in `ai-firewall-backend/`
2. Check `chrome://extensions` → PromptShield → "Errors" section
3. Verify MongoDB is running
4. Test with console script: `chrome.runtime.sendMessage({ action: 'checkHealth' }, console.log)`

### Backend Server Won't Start?
```bash
# Check if port 5000 is in use
netstat -ano | findstr :5000

# Verify MongoDB connection
mongo mongodb://localhost:27017/promptshield

# Check .env file exists with valid MONGO_URI
```

### License Detection Not Working?
- Verify AST parser (Acorn) is installed: `npm ls acorn`
- Check code blocks are properly isolated in `textExtractor.js`

---

## 📚 Documentation

- **[CONTEXT.md](CONTEXT.md)** - Complete technical reference, schemas, and API specs
- **[AGENTS.md](AGENTS.md)** - AI coding agent configuration
- **[CLAUDE.md](CLAUDE.md)** - Claude-specific instructions

---

## 📝 License

PromptShield is proprietary enterprise software. All rights reserved.
5. The PromptShield icon will appear on your toolbar. Verify the glassmorphic card HUD shows "SHIELD SECURED" (green pulsing indicator).

---

## Testing the Pipeline

### 1. Core SDK Test Suite (test-sdk.js)
The core security scanner has a robust standalone test suite covering lexical matching rules, validation boundaries, and regex parsing pipelines.
- **File Location**: sdk_module/omnishield-core-sdk/test-sdk.js
- **How to Run**:
  ```bash
  cd sdk_module/omnishield-core-sdk
  node test-sdk.js
  ```
- **Test Scopes**:
  - PII pattern identification (GCP credentials, AWS secrets, emails, IP structures, URLs).
  - Validation limits and character boundary thresholds.

### 2. Edge Case Testing (test-edge-cases.js)
To test boundaries, syntax tolerances, and stress boundaries inside the SDK:
- **File Location**: sdk_module/omnishield-core-sdk/test-edge-cases.js
- **How to Run**:
  ```bash
  cd sdk_module/omnishield-core-sdk
  node test-edge-cases.js
  ```

### 3. Backend Gateway AST and Copyleft Matchers (code-analysis.test.js)
To verify the Core SDK's AST analysis, multi-language tokenizers, and copyleft sliding-window similarity metrics:
- **File Location**: ai-firewall-backend/test/code-analysis.test.js
- **How to Run**:
  ```bash
  cd ai-firewall-backend
  node test/code-analysis.test.js
  ```
- **Test Scopes**:
  - Markdown text parsing and clean backtick extraction.
  - Acorn AST syntax node normalization.
  - Bigram calculations and Jaccard-distance similarity alignment.
  - Textual SPDX license comment detection.

### 4. Manual Mask/Unmask Verification
1. Open Google Gemini (gemini.google.com) or ChatGPT (chatgpt.com).
2. Type a test prompt:
   > "Draft an email to deal-lead@samsung-internal.com. Explain that we successfully registered the Gemini key AIzaSyB3nXkMpR9qToL5wVeF7Hy2JcD8sGu1Az4 and need them to verify."
3. Click the floating golden PromptShield icon in the bottom right corner of the input area.
4. Verify the text changes instantly to its tokenized form (omni-email-placeholder, omni-gcp-placeholder).
5. Submit the prompt. The returning streamed answers will automatically restore original values in your browser viewport, while remaining fully secure at the LLM level.
