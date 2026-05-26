# PromptShield AI — Enterprise LLM Data Firewall & Compliance Gateway

PromptShield is a robust, premium browser-and-proxy security layer designed to prevent PII, API keys, and corporate secrets from leaking to external LLM providers (ChatGPT, Google Gemini, Claude, and DeepSeek) while actively auditing and shielding your systems from copyleft license (GPL v2/v3, AGPL) contamination in AI-generated code.

---

## 🏗 System Architecture

The PromptShield ecosystem consists of three unified architectural tiers:

```mermaid
graph TD
    User["User Input Box (ChatGPT/Gemini/Claude)"]
    MV3["PromptShield Chrome Extension (Manifest V3)"]
    Gateway["AI Firewall Backend (Express Gateway, Port 5000)"]
    SDK["Omnishield Core SDK (PII & AST Lexer)"]
    DB["MongoDB (Audit Logs & Secrets Mapping)"]
    LLM["LLM Provider (Groq / OpenAI / Gemini API)"]

    User -->|1. Intercept Raw Prompt| MV3
    MV3 -->|2. Request Masking| Gateway
    Gateway -->|3. Scan & Tokenize| SDK
    Gateway -->|4. Store Secret Map| DB
    Gateway -->|5. Return Masked [omni-*] Prompt| MV3
    MV3 -->|6. Swap DOM Text & Send| LLM
    LLM -->|7. Stream LLM Response| Gateway
    Gateway -->|8. AST Code License Scan| SDK
    Gateway -->|9. Audit Risk & Prepend Legal Banner| DB
    Gateway -->|10. Return Protected Stream| MV3
    MV3 -->|11. MutationObserver Dynamic Unmasking| User
```

1. **PromptShield Chrome Extension (Manifest V3)**:
   - **File Location**: `promptshield-chrome-extension/`
   - **Scope**: Injected content script overlay, service worker gateway, and glassmorphic HUD dashboard.
   - **Responsibilities**: Intercepts active contenteditable elements (Quill, ProseMirror) dynamically, replaces text with secure `[omni-*]` tokens via local API requests, and reactive-unmasks response streams on-the-fly in the browser viewport.
2. **AI Firewall Backend Gateway**:
   - **File Location**: `ai-firewall-backend/`
   - **Scope**: REST proxy gateway built on Node.js/Express and MongoDB.
   - **Responsibilities**: Maps tokenized placeholders back to original secrets securely, coordinates routing to LLMs (Groq, etc.), and executes post-generation code risk analysis.
3. **Omnishield Core SDK**:
   - **File Location**: `sdk_module/omnishield-core-sdk/`
   - **Scope**: Standalone local security library (zero-dependency, high-speed execution).
   - **Responsibilities**: Lexical scanning, multi-language tokenizer/normalizer, SPDX license parser, and sliding-window Jaccard-distance AST structural matchers.

---

## 🔄 Core Data Flows

### 1. Outbound Shielding (Masking Flow)
1. The developer types a prompt containing sensitive info (e.g. `Gemini key AIzaSyB...` or `deal-lead@samsung-internal.com`) in ChatGPT/Gemini and clicks the PromptShield button.
2. The Chrome Extension intercepts the raw text and sends it to the local Express gateway on `/api/proxy/mask`.
3. The gateway invokes the **Omnishield Core SDK** which matches expressions for GCP keys, AWS keys, emails, URLs, IP addresses, and custom regex.
4. The gateway generates unique tokens (e.g. `[omni-gcp-D4mR8xK...]`, `[omni-email-1]`), stores the original-to-token map securely in MongoDB associated with a `Session ID`, and returns the masked prompt.
5. The extension swaps the text in the Quill/ProseMirror contenteditable area using a state-preserving asynchronous paragraph injector, ensuring the LLM only receives the sanitized placeholders.

### 2. Inbound Compliance & Restoring (Unmasking Flow)
1. The LLM streams back its response through the backend proxy gateway on `/api/proxy/chat`.
2. The **Omnishield Core SDK** intercepts code blocks dynamically.
3. If code is generated, the SDK parses the AST syntax tree (using Acorn for JS/TS) or runs sliding-window multi-language bigram normalization.
4. It compares the structural signatures against copyleft templates (GPL v2/v3, AGPL).
5. If copyleft similarity exceeds the **`75%` compliance threshold**:
   - An audit risk log is recorded in MongoDB.
   - A red compliance warning banner is dynamically prepended to the AI's response stream.
6. The browser receives the response stream. The extension's `MutationObserver` scans text nodes for `[omni-*]` placeholders on-the-fly, requests the decryptions from the gateway's background service worker, and restores the original secrets visually inside the browser viewport.

---

## 🚀 Setup & Installation

### Prerequisite Systems
- **Node.js** (v18+ recommended)
- **MongoDB** (Running locally on `mongodb://localhost:27017` or via an external URI)

### 1. Start the Backend Firewall
1. Navigate to the backend directory:
   ```bash
   cd ai-firewall-backend
   ```
2. Create your `.env` configuration:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/promptshield
   GROQ_API_KEY=your_groq_api_key_here
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the gateway server in development mode:
   ```bash
   npm run dev
   ```

### 2. Install the PromptShield Chrome Extension
1. Open Google Chrome and enter `chrome://extensions` in the address bar.
2. Toggle **Developer mode** in the top-right corner to **ON**.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the directory:
   `c:\Users\abhay\OneDrive\Desktop\heritage\promptshield-chrome-extension`
5. The PromptShield icon will appear on your toolbar. Verify the glassmorphic card HUD shows **"SHIELD SECURED"** (green pulsing indicator).

---

## 🧪 Testing the Pipeline

### Automated AST and License Checkers
To verify the Core SDK's AST analysis, multi-language tokenizers, and copyleft sliding-window similarity metrics:
1. Navigate to the backend directory:
   ```bash
   cd ai-firewall-backend
   ```
2. Run the dedicated, zero-dependency test runner:
   ```bash
   node test/code-analysis.test.js
   ```

### Manual Mask/Unmask Verification
1. Open Google Gemini (`gemini.google.com`) or ChatGPT (`chatgpt.com`).
2. Type a test prompt:
   > "Draft an email to deal-lead@samsung-internal.com. Explain that we successfully registered the Gemini key AIzaSyB3nXkMpR9qToL5wVeF7Hy2JcD8sGu1Az4 and need them to verify."
3. Click the floating **golden PromptShield** icon in the bottom right corner of the input area.
4. Verify the text changes instantly to its tokenized form (`[omni-email-1]`, `[omni-gcp-...]`).
5. Submit the prompt. The returning streamed answers will automatically restore `deal-lead@samsung-internal.com` in your browser viewport, while remaining fully secure at the LLM level!
