# PromptShield AI - Complete Technical Context & Reference Guide

This document provides comprehensive technical specifications, database schemas, API definitions, and implementation details for the PromptShield codebase. Use this as the authoritative reference for developers and AI coding assistants.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Folder Structure & File Manifest](#folder-structure--file-manifest)
3. [Database Schemas](#database-schemas)
4. [API Endpoints & Request/Response Specs](#api-endpoints--requestresponse-specs)
5. [Configuration & Environment Variables](#configuration--environment-variables)
6. [Security Pattern Matching](#security-pattern-matching)
7. [License Detection Algorithm](#license-detection-algorithm)
8. [Chrome Extension Architecture](#chrome-extension-architecture)
9. [Backend Services Overview](#backend-services-overview)
10. [SDK Module Reference](#sdk-module-reference)
11. [Testing & Validation](#testing--validation)
12. [Troubleshooting & Known Issues](#troubleshooting--known-issues)

---

## Project Overview

**PromptShield** is an enterprise-grade DLP (Data Loss Prevention) and compliance gateway for LLM interactions. It operates as a three-tier system:

1. **Browser-side**: Chrome MV3 extension intercepts contenteditable text
2. **Server-side**: Express gateway masks/unmasks secrets and scans for compliance violations
3. **Core logic**: Omnishield SDK handles pattern matching, AST parsing, and license detection

**Tech Stack**:
- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Browser Extension**: Manifest V3, vanilla JavaScript
- **Backend**: Express.js, Node.js 18+
- **Database**: MongoDB (Mongoose ODM)
- **SDK**: Zero-dependency Node.js module
- **Code Analysis**: Acorn (ES6 parser), custom AST walkers

---

## Folder Structure & File Manifest

```
promptsheild/
│
├── 📄 README.md                           # Main user guide & quick start
├── 📄 CONTEXT.md                          # [THIS FILE] Technical reference
├── 📄 AGENTS.md                           # AI agent rules & conventions
├── 📄 CLAUDE.md                           # Claude-specific instructions
├── 📄 package.json                        # Root workspace (Next.js project)
├── 📄 tsconfig.json                       # TypeScript compiler config
├── 📄 next.config.ts                      # Next.js configuration
├── 📄 eslint.config.mjs                   # ESLint rules
│
├── 📂 app/                                # Next.js pages & layouts
│   ├── 📄 layout.tsx                      # Root HTML layout
│   ├── 📄 page.tsx                        # Home page component
│   └── 📄 globals.css                     # Global styles
│
├── 📂 components/
│   └── 📂 ui/
│       └── 📄 button.tsx                  # Reusable button component
│
├── 📂 lib/
│   └── 📄 utils.ts                        # Utility functions (clsx, merge helpers)
│
├── 📂 public/                             # Static assets
│
├── 📂 promptshield-chrome-extension/      # Chrome MV3 Extension
│   ├── 📄 manifest.json                   # Extension metadata & permissions
│   ├── 📄 background.js                   # Service worker (persistent background)
│   ├── 📄 content.js                      # Content script (DOM injection)
│   ├── 📄 popup.html                      # Dashboard popup UI
│   ├── 📄 popup.css                       # Popup styling (glassmorphic design)
│   └── 📄 popup.js                        # Popup event handlers & stats
│
├── 📂 ai-firewall-backend/                # Express Gateway (Port 5000)
│   ├── 📄 server.js                       # Express app initialization
│   ├── 📄 package.json                    # Backend dependencies
│   │
│   ├── 📂 config/
│   │   └── 📄 db.js                       # MongoDB connection setup
│   │
│   ├── 📂 models/
│   │   └── 📄 AuditLog.js                 # Mongoose schema for audit records
│   │
│   ├── 📂 controllers/
│   │   └── 📄 proxyController.js          # Route handlers (/api/proxy/*)
│   │
│   ├── 📂 routes/
│   │   └── 📄 proxyRoutes.js              # Express router definitions
│   │
│   ├── 📂 middleware/
│   │   └── 📄 logger.js                   # Request/response logging middleware
│   │
│   ├── 📂 services/
│   │   ├── 📄 maskingService.js           # Token generation & masking logic
│   │   ├── 📄 openaiService.js            # LLM API integration (Groq, OpenAI)
│   │   ├── 📄 promptInjectionService.js   # Injection detection patterns
│   │   ├── 📄 riskService.js              # Risk scoring & severity calculation
│   │   │
│   │   └── 📂 codeAnalysis/
│   │       ├── 📄 astParser.js            # Acorn-based AST parsing (JS/TS)
│   │       ├── 📄 licenseMatcher.js       # SPDX license template matching
│   │       └── 📄 textExtractor.js        # Markdown code block extraction
│   │
│   └── 📂 test/
│       └── 📄 code-analysis.test.js       # Jest test suite (10/10 passing)
│
└── 📂 sdk_module/
    └── 📂 omnishield-core-sdk/            # Standalone SDK (zero dependencies)
        ├── 📄 index.js                    # Public API entry point
        ├── 📄 ai-scanner.js               # Local LLM scanner (context-sensitive detection)
        ├── 📄 test-sdk.js                 # Integration test suite
        └── 📄 test-edge-cases.js          # Stress & boundary tests
```

---

## Database Schemas

### MongoDB Collections & Mongoose Models

#### 1. AuditLog Schema
**File**: `ai-firewall-backend/models/AuditLog.js`

```javascript
const AuditLogSchema = new mongoose.Schema({
    // Request context
    sessionId: {
        type: String,
        required: true,
        index: true,
        description: "Unique browser tab session identifier"
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Content fields
    prompt: {
        type: String,
        required: true,
        description: "Original unmasked user prompt"
    },
    sanitizedPrompt: {
        type: String,
        required: true,
        description: "Masked version with [omni-*] placeholders"
    },
    aiResponse: {
        type: String,
        required: false,
        description: "LLM response (stored only if compliance violations found)"
    },
    
    // PII masking details
    maskedFields: {
        type: Map,
        of: String,
        default: new Map(),
        description: "Map of placeholder tokens to original values (sensitive)"
    },
    
    // Compliance violation flags
    copyleftDetected: {
        type: Boolean,
        default: false,
        index: true,
        description: "True if GPL/AGPL code detected in response"
    },
    matchedLicense: {
        type: String,
        enum: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', null],
        default: null
    },
    licenseSimilarity: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
        description: "Jaccard similarity score (0-100, threshold: 75%)"
    },
    offendingCode: {
        type: String,
        default: null,
        description: "Code snippet matching copyleft template"
    },
    
    // Injection & risk detection
    injectionDetected: {
        type: Boolean,
        default: false
    },
    injectionPatterns: {
        type: [String],
        default: []
    },
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
        description: "Overall security risk (0-100)"
    },
    
    // User & system info
    userId: {
        type: String,
        default: "anonymous"
    },
    ipAddress: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    }
});

AuditLogSchema.index({ sessionId: 1, timestamp: -1 });
AuditLogSchema.index({ copyleftDetected: 1 });
```

---

## API Endpoints & Request/Response Specs

All endpoints are hosted on `http://localhost:5000` and use JSON content-type.

### 1. Mask Prompt (PII & Secret Redaction)

**Endpoint**: `POST /api/proxy/mask`

**Purpose**: Detect and mask sensitive data in user prompts before sending to LLM

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
    "prompt": "Draft an email to john.doe@company.com with API key sk-proj-abc123xyz. Budget is $2.5M.",
    "sessionId": "chrome-tab-session-12345",
    "includeInjectionDetection": true
}
```

**Response Body (Success 200)**:
```json
{
    "success": true,
    "maskedPrompt": "Draft an email to [omni-email-K9x2vL] with API key [omni-openai-D4mR8xKq]. Budget is [omni-financial-P7n3bQ].",
    "sessionId": "chrome-tab-session-12345",
    "detectedFields": {
        "emails": ["john.doe@company.com"],
        "apiKeys": ["sk-proj-abc123xyz"],
        "financialData": ["$2.5M"]
    },
    "injectionPatterns": [],
    "injectionDetected": false,
    "riskScore": 15,
    "timestamp": "2026-05-27T14:32:10.234Z"
}
```

**Response Body (Error 400)**:
```json
{
    "success": false,
    "error": "Invalid session ID or missing prompt field",
    "statusCode": 400
}
```

---

### 2. Unmask Text (Placeholder Hydration)

**Endpoint**: `POST /api/proxy/unmask`

**Purpose**: Restore original values from masked placeholders (called from extension's background worker)

**Request Body**:
```json
{
    "text": "The email should go to [omni-email-K9x2vL] for approval.",
    "sessionId": "chrome-tab-session-12345",
    "unmaskedFields": ["emails"]
}
```

**Response Body (Success 200)**:
```json
{
    "success": true,
    "unmaskedText": "The email should go to john.doe@company.com for approval.",
    "restored": {
        "[omni-email-K9x2vL]": "john.doe@company.com"
    },
    "timestamp": "2026-05-27T14:34:52.103Z"
}
```

---

### 3. Proxy Chat (LLM Proxy with License Scanning)

**Endpoint**: `POST /api/proxy/chat`

**Purpose**: Proxy chat requests to LLM provider (Groq, OpenAI, etc.) with response scanning

**Request Body**:
```json
{
    "maskedPrompt": "Write Python code to sort a list using [omni-algorithm-name].",
    "sessionId": "chrome-tab-session-12345",
    "model": "gpt-4",
    "provider": "openai",
    "scanForLicenses": true
}
```

**Response Body (Success 200 - No Violations)**:
```json
{
    "success": true,
    "aiResponse": "Here's a Python function to sort a list...",
    "copyleftDetected": false,
    "complianceWarnings": [],
    "auditLogId": "64a7c2e9f1b8c3d5e6f7g8h9",
    "timestamp": "2026-05-27T14:36:15.567Z"
}
```

**Response Body (Success 200 - With Violations)**:
```json
{
    "success": true,
    "aiResponse": "⚠️ [COMPLIANCE WARNING: GPL-3.0 DETECTED - 78% match]\n\nHere's the code...",
    "copyleftDetected": true,
    "matchedLicense": "GPL-3.0",
    "licenseSimilarity": 78,
    "complianceWarnings": [
        {
            "level": "HIGH",
            "message": "Generated code matches GPL-3.0 license (78% similarity)",
            "offendingLines": "1-12"
        }
    ],
    "auditLogId": "64a7c2e9f1b8c3d5e6f7g8h9",
    "timestamp": "2026-05-27T14:36:15.567Z"
}
```

---

### 4. Retrieve Audit Logs

**Endpoint**: `GET /api/audit/logs`

**Query Parameters**:
```
?sessionId=chrome-tab-session-12345
?startDate=2026-05-27T00:00:00Z
?endDate=2026-05-27T23:59:59Z
?copyleftOnly=false
?limit=50
&skip=0
```

**Response Body (Success 200)**:
```json
{
    "success": true,
    "total": 127,
    "logs": [
        {
            "_id": "64a7c2e9f1b8c3d5e6f7g8h9",
            "sessionId": "chrome-tab-session-12345",
            "timestamp": "2026-05-27T14:32:10.234Z",
            "prompt": "Draft an email...",
            "sanitizedPrompt": "Draft an email...",
            "copyleftDetected": false,
            "riskScore": 15,
            "injectionDetected": false
        }
        // ... more logs
    ]
}
```

---

## Configuration & Environment Variables

### `.env` File (Backend)

**Location**: `ai-firewall-backend/.env`

```env
# Server Config
PORT=5000
NODE_ENV=development
DEBUG=true

# Database
MONGO_URI=mongodb://localhost:27017/promptshield
MONGO_TIMEOUT=5000

# LLM Provider Keys (choose at least one)
GROQ_API_KEY=gsk_your_groq_key_here
OPENAI_API_KEY=sk-proj-your_openai_key
GOOGLE_API_KEY=AIzaSyB_your_google_key

# Ollama Local LLM (for context-sensitive scanning)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_ENABLED=true

# Security Settings
SESSION_TIMEOUT_MS=3600000
MAX_REQUESTS_PER_MINUTE=100
CORS_ORIGIN=chrome-extension://your_extension_id_here

# Compliance Thresholds
LICENSE_SIMILARITY_THRESHOLD=75
RISK_SCORE_ALERT_THRESHOLD=50

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_DIR=./logs
```

### Chrome Extension Config

**Location**: `promptshield-chrome-extension/manifest.json`

```json
{
    "manifest_version": 3,
    "name": "PromptShield AI",
    "version": "1.0.0",
    "description": "Enterprise AI DLP Firewall",
    "permissions": [
        "storage",
        "activeTab",
        "scripting"
    ],
    "host_permissions": [
        "http://localhost:5000/*",
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://*.deepseek.com/*"
    ],
    "background": {
        "service_worker": "background.js"
    },
    "content_scripts": [
        {
            "matches": [
                "https://chatgpt.com/*",
                "https://claude.ai/*",
                "https://gemini.google.com/*",
                "https://*.deepseek.com/*"
            ],
            "js": ["content.js"],
            "run_at": "document_start"
        }
    ],
    "action": {
        "default_popup": "popup.html",
        "default_title": "PromptShield AI - Security Dashboard"
    }
}
```

---

## Security Pattern Matching

### Built-in Regex Patterns

**Location**: `sdk_module/omnishield-core-sdk/ai-scanner.js` (base patterns)

```javascript
// API Keys
const API_KEY_PATTERNS = {
    openai: /sk-proj-[A-Za-z0-9_\-]{20,}/g,
    huggingface: /hf_[A-Za-z0-9]{20,}/g,
    aws: /AKIA[0-9A-Z]{16}/g,
    gcp: /AIzaSy[A-Za-z0-9_\-]{33}/g,
    groq: /gsk_[A-Za-z0-9_]{30,}/g
};

// PII Patterns
const PII_PATTERNS = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,                                    // xxx-xx-xxxx
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
};

// Proprietary/URL Patterns
const PROPRIETARY_PATTERNS = {
    internalUrl: /https?:\/\/(?:internal|corp|intranet|vpn|private)\..+/gi,
    jiraTicket: /[A-Z]+-\d{4,5}/g,
    confidentialMarking: /\b(?:confidential|secret|top\s+secret|restricted)\b/gi
};
```

### Context-Sensitive Detection (Local LLM)

**File**: `sdk_module/omnishield-core-sdk/ai-scanner.js`

The SDK uses a local Ollama instance (default: `qwen2.5:1.5b`) for detecting:
- Project codenames (e.g., "Project Nightingale")
- Employee names in business context
- Proprietary product names (e.g., "Prometheus SDK")
- Financial amounts with business context (e.g., "$4.2M acquisition budget")
- Contract counterparties

**Latency**: 200-800ms (acceptable for gateway layer vs 1-5s LLM round-trip)

**Ollama Setup**:
```bash
# Install Ollama (https://ollama.ai)
ollama pull qwen2.5:1.5b

# Run in background
ollama serve
```

---

## License Detection Algorithm

### Copyleft License Templates

**File**: `ai-firewall-backend/services/codeAnalysis/licenseMatcher.js`

Supported licenses:
- **GPL-2.0**: GNU General Public License v2
- **GPL-3.0**: GNU General Public License v3
- **AGPL-3.0**: GNU Affero General Public License v3

**Detection Method**: Jaccard similarity on normalized AST bigrams

```javascript
// Simplified algorithm:
function detectLicense(generatedCode) {
    // 1. Extract from Markdown backticks
    const codeBlocks = extractCodeBlocks(generatedCode);
    
    // 2. Parse AST
    const tokens = parseAST(codeBlocks);
    
    // 3. Generate bigrams (token pairs)
    const bigrams = generateBigrams(tokens);
    
    // 4. Compare against GPL/AGPL templates
    const gpl2Match = calculateJaccard(bigrams, GPL2_TEMPLATE_BIGRAMS);
    const gpl3Match = calculateJaccard(bigrams, GPL3_TEMPLATE_BIGRAMS);
    const agpl3Match = calculateJaccard(bigrams, AGPL3_TEMPLATE_BIGRAMS);
    
    // 5. Return best match if > 75% threshold
    return Math.max(gpl2Match, gpl3Match, agpl3Match) > 75 ? matched_license : null;
}

function calculateJaccard(set1, set2) {
    const intersection = set1.filter(item => set2.includes(item)).length;
    const union = new Set([...set1, ...set2]).size;
    return (intersection / union) * 100;
}
```

---

## Chrome Extension Architecture

### File: `promptshield-chrome-extension/background.js`

**Purpose**: Persistent service worker handling:
- API requests to backend
- Message routing
- Chrome storage management

**Key Functions**:
```javascript
// Health check
chrome.runtime.onMessage.addListener(({ action }, sender, sendResponse) => {
    if (action === 'checkHealth') {
        fetch('http://localhost:5000/api/health')
            .then(res => res.json())
            .then(data => sendResponse({ status: 'online', ...data }))
            .catch(() => sendResponse({ status: 'offline' }));
    }
});

// Masking request
if (action === 'maskPrompt') {
    fetch('http://localhost:5000/api/proxy/mask', {
        method: 'POST',
        body: JSON.stringify({ prompt: data.text, sessionId }),
        headers: { 'Content-Type': 'application/json' }
    }).then(res => res.json()).then(sendResponse);
}
```

### File: `promptshield-chrome-extension/content.js`

**Purpose**: DOM injection and text interception

**Key Operations**:
1. **ContentEditable Detection**: Finds Quill, ProseMirror, or native contenteditable elements
2. **Text Replacement**: Intercepts on `beforepaste`, `input`, `keyup` events
3. **Unmasking**: MutationObserver watches for response text nodes

```javascript
// Simplified flow:
document.addEventListener('keyup', (e) => {
    if (e.target.contentEditable === 'true') {
        const text = e.target.innerText;
        
        // Request masking
        chrome.runtime.sendMessage({ action: 'maskPrompt', text }, (response) => {
            if (response.maskedPrompt) {
                // Update DOM with masked version
                e.target.innerText = response.maskedPrompt;
            }
        });
    }
});
```

### File: `promptshield-chrome-extension/popup.js`

**Purpose**: Dashboard HUD controller

**Features**:
- Gateway health status (SHIELD SECURED / CONNECTING / OFFLINE)
- Statistics display (emails shielded, keys blocked, PII protected)
- Shield toggle on/off
- Reset stats button

---

## Backend Services Overview

### `maskingService.js`
Handles token generation and secret mapping:
```javascript
function generateToken(dataType, originalValue) {
    const hash = crypto.createHash('sha256').update(originalValue).digest('hex').slice(0, 12);
    const token = `[omni-${dataType}-${hash}]`;
    
    // Store in MongoDB (encrypted)
    secretMap.set(token, encryptValue(originalValue));
    
    return token;
}
```

### `promptInjectionService.js`
Detects jailbreak and bypass attempts:
```javascript
const injectionPatterns = [
    'ignore previous instructions',
    'bypass security',
    'reveal system prompt',
    'jailbreak',
    'developer mode',
    'you are no longer bound'
    // ... 20+ more patterns
];
```

### `riskService.js`
Calculates overall security risk:
```javascript
function calculateRiskScore(detections) {
    let score = 0;
    if (detections.injectionDetected) score += 30;
    if (detections.apiKeysFound) score += 25;
    if (detections.piiFound) score += 20;
    if (detections.sqlInjectionFound) score += 15;
    if (detections.urlBlacklistMatch) score += 10;
    return Math.min(score, 100);
}
```

### `codeAnalysis/astParser.js`
Parses JavaScript/TypeScript with Acorn:
```javascript
const acorn = require('acorn');

function parseAndNormalize(code) {
    const ast = acorn.parse(code, { ecmaVersion: 2020 });
    
    // Walk AST and extract normalized tokens
    // Remove variable names, literals to get structural signature
    return normalizeAST(ast);
}
```

---

## SDK Module Reference

### `omnishield-core-sdk/index.js`

**Public API**:
```javascript
module.exports = {
    // Scanner functions
    scanForPII(text),
    scanForAPIKeys(text),
    scanForInjection(text),
    scanForLicenses(code),
    
    // Configuration
    setOllamaEndpoint(url),
    setLicenseThreshold(percent),
    
    // Batch operations
    scanBatch(texts),
    
    // Utilities
    generatePlaceholder(type, value),
    isAvailable()
};
```

### Example Usage

```javascript
const Omnishield = require('./omnishield-core-sdk');

const text = "My API key is sk-proj-abc123 and email is john@company.com";
const results = Omnishield.scanForPII(text);
// Returns: { apiKeys: ['sk-proj-abc123'], emails: ['john@company.com'] }
```

---

## Testing & Validation

### Backend Tests

**File**: `ai-firewall-backend/test/code-analysis.test.js`

```bash
cd ai-firewall-backend
npm test

# Output: 10/10 tests passing ✅
```

**Test Coverage**:
- AST parsing (JavaScript, TypeScript)
- License detection accuracy
- Jaccard similarity calculation
- Edge cases (minified code, mixed languages)

### SDK Tests

**File**: `sdk_module/omnishield-core-sdk/test-sdk.js`

```bash
cd sdk_module/omnishield-core-sdk
node test-sdk.js

# Validates:
# ✓ PII Detection (SSN, Email, Phone, Credit Card)
# ✓ API Key Detection (OpenAI, GCP, AWS, HuggingFace)
# ✓ Prompt Injection Patterns
# ✓ License Template Matching
```

**File**: `sdk_module/omnishield-core-sdk/test-edge-cases.js`

```bash
node test-edge-cases.js

# Tests:
# ✓ Extremely long prompts (100K+ chars)
# ✓ Unicode & emoji handling
# ✓ Obfuscated patterns
# ✓ Mixed language code
# ✓ Malformed input
```

---

## Troubleshooting & Known Issues

### Extension Not Detecting Prompts

**Symptom**: Text in ChatGPT not being masked

**Diagnosis**:
```javascript
// Console check:
chrome.runtime.sendMessage({ action: 'checkHealth' }, (res) => {
    console.log('Backend status:', res);
});
```

**Solutions**:
1. Ensure backend running: `npm run dev` in `ai-firewall-backend/`
2. Check CORS origin in `.env` matches extension ID
3. Verify MongoDB is running: `mongo mongodb://localhost:27017/promptshield`
4. Clear extension cache: `chrome://extensions` → PromptShield → Details → Clear data

### Backend Server Won't Start

**Symptom**: `Error: listen EADDRINUSE :::5000`

**Solutions**:
```bash
# Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or change port in .env
PORT=5001
```

### License Detection Too Aggressive

**Solution**: Adjust threshold in `.env`
```env
LICENSE_SIMILARITY_THRESHOLD=75  # Increase to 80-85 for fewer false positives
```

### Ollama Scanner Timeout

**Symptom**: 800ms+ latency on mask requests

**Solutions**:
1. Disable Ollama: `OLLAMA_ENABLED=false` (fallback to regex-only)
2. Use faster model: `OLLAMA_MODEL=tinyllama:latest`
3. Increase timeout: `OLLAMA_TIMEOUT=2000`

---

## Development Roadmap

- [ ] Support for Claude, Cohere, Anthropic APIs
- [ ] Fine-tuned local copyleft detection model
- [ ] Encrypted credential storage in extension
- [ ] Audit log export (PDF, CSV)
- [ ] Real-time compliance dashboards
- [ ] API rate limiting & request validation
- [ ] Multi-language code analysis (Python, Go, Rust)

---

## Resources & Documentation

- [Chrome Extension MV3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [MongoDB Mongoose Docs](https://mongoosejs.com/docs/)
- [Acorn JS Parser](https://github.com/acornjs/acorn)
- [SPDX License List](https://spdx.org/licenses/)

---

**Document Last Updated**: May 27, 2026  
**Maintained By**: PromptShield Engineering Team
    "success": true,
    "unmaskedText": "Please reply to deal-lead@samsung-internal.com regarding AIzaSyB3nXk..."
  }
  ```

### 3. Intercept and Analyze LLM Response (Copyleft Verification)
- **Endpoint**: POST /api/proxy/chat
- **Request Body**:
  ```json
  {
    "message": "Write a fast bubblesort function in JavaScript."
  }
  ```
- **Internal Pipeline**:
  - Routes message to LLM (using Groq llama3-8b-8192 or similar model).
  - Code extracts markdown code blocks.
  - Generates Acorn AST tokens, normalizes identifiers, and sliding-window computes Jaccard-distance similarity scores against Copyleft (GPL v2/v3, AGPL) templates.
  - If copyleft similarity score >= 75%, records audit log and prepends a red legal warning banner to the response text.

---

## Key Core Implementation Details

### 1. Injected Rich-Editor Input Synchronization
Because modern interfaces like Google Gemini (Quill.js - .ql-editor) and ChatGPT (ProseMirror) maintain strict, asynchronous document model states, direct DOM assignments (like setting innerHTML = text) are immediately overwritten and reverted during the host frameworks' reconciliation loops.

PromptShield solves this with an asynchronous DOM mutation + delayed event dispatch pattern in content.js:
```javascript
// 1. Build and insert well-formed <p> elements (which Quill and ProseMirror require)
const paragraphHTML = lines.map(line => `<p>${line ? escapeHtml(line) : '<br>'}</p>`).join('');
el.innerHTML = paragraphHTML;

// 2. Safely position the caret selection at the end of the text
el.focus();
const range = document.createRange();
range.selectNodeContents(el);
range.collapse(false);
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);

// 3. Delay event dispatches by 50ms
setTimeout(() => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}, 50);
```
*Note: This 50ms delay is vital. It allows the editors' asynchronous MutationObserver routines to detect the clean `<p>` structures, parse them into their internal models, and lock them in before the input/change bubbles trigger the framework's synchronous data reconciliation.*

### 2. Copyleft Signature Analysis Mechanics
- **SPDX Scanning**: Proactively checks file comments for standard notices (e.g. SPDX-License-Identifier: GPL-3.0-only).
- **Acorn Tokenizer**: Generates sequential JS/TS syntax nodes, stripping naming details to form a structural signature (e.g. [VariableDeclaration, Identifier, VariableDeclarator, Literal, BinaryExpression]).
- **Bigram Slider**: Splits signatures into overlapping bigrams (e.g. [[VarDec, Ident], [Ident, VarDecl], [VarDecl, Lit]]).
- **Jaccard Similarity Check**: Calculates intersection ratios against known GPL codebase profiles. Score >= 75% is audited as high compliance risk.

---

## Standalone Core Testing Frameworks

The system includes multiple robust test harnesses:
1. **test-sdk.js**: Validates regex boundaries, pattern triggers, secret redactions, character rules, and validation limits in the SDK library.
2. **test-edge-cases.js**: Tests high-stress situations, unicode compliance, and invalid payloads inside the core matching expressions.
3. **code-analysis.test.js**: Tests the backend AST-extraction matching loops, including Acorn AST mapping, multi-language tokenization, structural bigram extraction, Jaccard distance calculators, and SPDX licensing comment detections.
