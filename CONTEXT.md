# PromptShield AI — Comprehensive Project Context File

This document serves as an exhaustive reference of the PromptShield codebase, including folders, schemas, configurations, API definitions, and special runtime details. Developers and AI coding assistants can read this file to obtain immediate, full-fidelity context on the entire workspace.

---

## 📂 Codebase File Manifest

```
heritage/
├── README.md                              # Main system overview & setup
├── CONTEXT.md                             # [THIS FILE] Technical reference & schemas
├── promptshield-chrome-extension/          # MV3 Chrome Extension
│   ├── manifest.json                      # Extension manifest permissions & sandbox
│   ├── content.js                         # Content injection & DOM MutationObservers
│   ├── background.js                      # Background worker & gateway coordinator
│   ├── popup.html                         # Glassmorphic HUD panel HTML
│   ├── popup.css                          # Sleek HUD panel styling
│   └── popup.js                           # Popup event controller
├── ai-firewall-backend/                   # Express Gateway & Audit Logger
│   ├── server.js                          # Server initialization (Port 5000)
│   ├── models/
│   │   └── AuditLog.js                    # MongoDB mongoose database schema
│   ├── controllers/
│   │   └── proxyController.js             # LLM Chat proxy & AST pipeline interceptor
│   ├── services/
│   │   └── codeAnalysis/
│   │       ├── textExtractor.js           # Markdown cleaner & backtick isolator
│   │       ├── astParser.js               # Acorn ES6 JS parser & token normalizer
│   │       └── licenseMatcher.js          # SPDX scan & Jaccard bigram signature matcher
│   └── test/
│       └── code-analysis.test.js          # AST test suite (10/10 tests passing)
└── sdk_module/                            # Core Standalone SDK
    └── omnishield-core-sdk/
        ├── index.js                       # Primary SDK module API
        ├── ai-scanner.js                  # PII, API Key, and Secrets scanner
        └── test-sdk.js                    # Core SDK validation test suite
```

---

## 🗄️ Database Schemas (MongoDB)

The firewall gateway uses a MongoDB collection (`mongodb://localhost:27017/promptshield`) to log interactions, audit metrics, and track copyleft license violations.

### 1. `AuditLog` Schema
Defined in `ai-firewall-backend/models/AuditLog.js`:
```javascript
const AuditLogSchema = new mongoose.Schema({
    prompt: { type: String, required: true },
    sanitizedPrompt: { type: String, required: true },
    aiResponse: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    
    // Copyleft license auditing fields
    copyleftDetected: { type: Boolean, default: false },
    matchedLicense: { type: String, default: null },
    licenseSimilarity: { type: Number, default: 0 },
    offendingCode: { type: String, default: null }
});
```

---

## 🔌 API Endpoints & Request/Response Schemas

All backend network operations are managed by the gateway server running locally on **port `5000`**.

### 1. Mask Prompt (PII & Secret Redaction)
- **Endpoint**: `POST /api/proxy/mask`
- **Controller**: `proxyController.js`
- **Request Body**:
  ```json
  {
    "prompt": "Draft an email to deal-lead@samsung-internal.com explaining that we successfully registered the key AIzaSyB3nXk...",
    "sessionId": "chrome-tab-73182"
  }
  ```
- **Response Body**:
  ```json
  {
    "success": true,
    "maskedPrompt": "Draft an email to [omni-email-1] explaining that we successfully registered the key [omni-gcp-D4mR8xKq1NpL3vWoEe7Tc2HbJ9fYuG5sA]"
  }
  ```

### 2. Unmask Text (Placeholders Hydration)
- **Endpoint**: `POST /api/proxy/unmask`
- **Controller**: `proxyController.js`
- **Request Body**:
  ```json
  {
    "text": "Please reply to [omni-email-1] regarding [omni-gcp-D4mR8xKq1NpL3vWoEe7Tc2HbJ9fYuG5sA].",
    "sessionId": "chrome-tab-73182"
  }
  ```
- **Response Body**:
  ```json
  {
    "success": true,
    "unmaskedText": "Please reply to deal-lead@samsung-internal.com regarding AIzaSyB3nXk..."
  }
  ```

### 3. Intercept & Analyze LLM Response (Copyleft Verification)
- **Endpoint**: `POST /api/proxy/chat`
- **Request Body**:
  ```json
  {
    "message": "Write a fast bubblesort function in JavaScript."
  }
  ```
- **Internal Pipeline**:
  - Routes message to LLM (using Groq `llama3-8b-8192` or similar model).
  - Code extracts markdown code blocks.
  - Generates Acorn AST tokens, normalizes identifiers, and sliding-window computes Jaccard-distance similarity scores against Copyleft (GPL v2/v3, AGPL) templates.
  - If copyleft similarity score $\ge 75\%$, records audit log and prepends a red legal warning banner to the response text.

---

## 🛠️ Key Core Implementation Details

### 1. Injected Rich-Editor Input Synchronization
Because modern interfaces like Google Gemini (Quill.js - `.ql-editor`) and ChatGPT (ProseMirror) maintain strict, asynchronous document model states, direct DOM assignments (like setting `innerHTML = text`) are immediately overwritten and reverted during the host frameworks' reconciliation loops.

PromptShield solves this with an **asynchronous DOM mutation + delayed event dispatch** pattern in [content.js](file:///c:/Users/abhay/OneDrive/Desktop/heritage/promptshield-chrome-extension/content.js#L141-L188):
```javascript
// 1. Build and insert well-formed <p> elements (which Quill & ProseMirror require)
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
*Note: This 50ms delay is vital. It allows the editors' asynchronous `MutationObserver` routines to detect the clean `<p>` structures, parse them into their internal models, and lock them in before the input/change bubbles trigger the framework's synchronous data reconciliation.*

### 2. Copyleft Signature Analysis Mechanics
- **SPDX Scanning**: Proactively checks file comments for standard notices (e.g. `SPDX-License-Identifier: GPL-3.0-only`).
- **Acorn Tokenizer**: Generates sequential JS/TS syntax nodes, stripping naming details to form a structural signature (e.g. `[VariableDeclaration, Identifier, VariableDeclarator, Literal, BinaryExpression]`).
- **Bigram Slider**: Splits signatures into overlapping bigrams (e.g. `[[VarDec, Ident], [Ident, VarDecl], [VarDecl, Lit]]`).
- **Jaccard Similarity Check**: Calculates intersection ratios against known GPL codebase profiles. Score $\ge 75\%$ is audited as high compliance risk.
