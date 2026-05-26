# OmniShield AI — Core SDK Architecture

> **Version:** 1.1.0 — with Local AI Scanner Layer  
> **Module:** `omnishield-core-sdk`  
> **Paradigm:** Dual-layer (Regex + Local LLM), zero cloud dependency, deterministic  
> **Runtime:** Node.js ≥ 18 (CJS), zero npm dependencies

---

## 1. What This Module Is

`omnishield-core-sdk` is the **data obfuscation and tokenization engine** sitting between a user's application and any public LLM API (OpenAI, Gemini, Claude, etc.).

It operates as an **AI Firewall** with two complementary detection layers:

| Layer | Technology | Catches | Latency |
|---|---|---|---|
| **Layer 1 — Regex** | Pre-compiled MASTER_REGEX | API keys, emails, known brand names | < 0.5 ms |
| **Layer 2 — Local AI** | qwen2.5:1.5b via Ollama | Codenames, human names, proprietary terms, financial context | 200–800 ms |

No data ever leaves the machine during the scanning phase.

---

## 2. Detailed Architecture Blueprint

The diagram below shows the high-level system layout of `omnishield-core-sdk` and how the application layers interact with the dual security scanner levels and local execution context.

```mermaid
graph TB
    subgraph Client Application ["Client Context / Web Gateway"]
        App["App / Gateway Router"]
    end

    subgraph SDK ["OmniShield Core SDK Boundary"]
        Engine["OmniShieldEngine (Singleton)"]
        
        subgraph SessionManager ["Session Store (In-Memory Map)"]
            SessionState["session-tab-1<br>• mappings: Map<br>• poolIndex: Counters<br>• createdAt: Epoch"]
        end
        
        subgraph Layer1 ["Layer 1: Deterministic Engine"]
            Regex["Pre-compiled MASTER_REGEX"]
        end
        
        subgraph Layer2 ["Layer 2: Cognitive Engine"]
            Scanner["AIScanner Interface"]
            PromptShield["System Prompt Boundary Shield"]
        end
    end

    subgraph LocalSystem ["Localhost System Environment"]
        Ollama["Ollama daemon (127.0.0.1:11434)"]
        LocalLLM["Local LLM (qwen2.5:1.5b)"]
        Env["$env:OLLAMA_MODELS override"]
    end

    subgraph PublicCloud ["External Cloud Environment"]
        CloudLLM["Cloud LLM Gateway<br>(OpenAI, Anthropic, Gemini)"]
    end

    %% Flow lines
    App -->|"1. rawPrompt + sessionId"| Engine
    Engine -->|"1.1 Read/Write Session"| SessionState
    Engine -->|"2. Process String"| Regex
    Regex -->|"3. Sync Redacted Output"| Engine
    Engine -->|"4. Async Scan Call"| Scanner
    Scanner -->|"4.1 Structured few-shot prompt"| PromptShield
    PromptShield -->|"5. HTTP REST Call"| Ollama
    Ollama -.->|"5.1 Read local models"| Env
    Ollama -->|"5.2 Compute"| LocalLLM
    LocalLLM -->|"6. JSON list of entities"| Ollama
    Ollama -->|"7. Clean tokens"| Scanner
    Scanner -->|"8. Token alignment & Merge"| Engine
    Engine -->|"9. Return maskedPrompt"| App
    
    App -->|"10. Forward maskedPrompt"| CloudLLM
    CloudLLM -->|"11. Response with fake tokens"| App
    App -->|"12. unmaskInbound()"| Engine
    Engine -->|"13. Reconstruct payload"| App

    style SDK fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    style Layer1 fill:#1e293b,stroke:#22c55e,stroke-width:1px,color:#fff
    style Layer2 fill:#1e293b,stroke:#3b82f6,stroke-width:1px,color:#fff
    style SessionManager fill:#1e293b,stroke:#a855f7,stroke-width:1px,color:#fff
    style LocalSystem fill:#1c1917,stroke:#e7e5e4,stroke-width:1px,color:#fff
    style PublicCloud fill:#2e1065,stroke:#c084fc,stroke-width:1px,color:#fff
```

---

## 3. Full Data Flow Pipeline

The system is designed to work in a bi-directional pipeline. Sensitive outbound information is tokenized, while inbound model responses containing placeholders are dynamically dereferenced and replaced back with their original values in memory.

```mermaid
flowchart TD
    A(["👤 User / Application<br>(Browser tab, VS Code ext, CLI)"])
    B["🔍 Layer 1 — Regex Scan<br>maskOutbound()<br>~0.4 ms sync"]
    C{"Ollama<br>running?"}
    D["🤖 Layer 2 — Local LLM Scan<br>AIScanner.scan()<br>qwen2.5:1.5b<br>200–800 ms async"]
    E["🔗 Merge & Deduplicate<br>_maskTokenList()<br>session.mappings updated"]
    F(["☁️ Public LLM API<br>OpenAI / Gemini / Claude<br>Sees ONLY fake tokens"])
    G["🔓 Restore<br>unmaskInbound()<br>&lt; 0.2 ms sync"]
    H(["👤 User / Application<br>Sees real values<br>seamlessly restored"])

    A -->|rawPrompt| B
    B -->|partially masked| C
    C -->|Yes| D
    C -->|"No (graceful fallback)"| E
    D -->|"string[] of sensitive tokens"| E
    E -->|fully sanitised maskedPrompt| F
    F -->|llmResponse with fake tokens| G
    G -->|reconstructed response| H

    style B fill:#16a34a,color:#fff,stroke:#15803d
    style D fill:#2563eb,color:#fff,stroke:#1d4ed8
    style E fill:#ca8a04,color:#fff,stroke:#a16207
    style F fill:#7c3aed,color:#fff,stroke:#6d28d9
    style G fill:#16a34a,color:#fff,stroke:#15803d
```

---

## 4. Session Isolation Model

Each browser tab, file, or user context gets a unique `sessionId`.
Sessions are completely independent — no shared state, no data bleed.

```mermaid
flowchart LR
    subgraph Engine["OmniShieldEngine (singleton per process)"]
        direction TB
        subgraph SM["_sessions — Map&lt;sessionId, SessionState&gt;"]
            S1["session-tab-employee<br>───────────────────<br>mappings: Map(9)<br>  [omni-oai-1] → sk-proj-...<br>  [omni-email-1] → alice@...<br>  [omni-ai-1] → Project Nightingale<br>poolIndex: {ai:3, corp:3, ...}<br>createdAt: 1748279552"]
            S2["session-tab-analyst<br>───────────────────<br>mappings: Map(6)<br>  [omni-corp-1] → Microsoft<br>  [omni-email-1] → budget@...<br>  [omni-gcp-1] → AIzaSy...<br>poolIndex: {ai:0, corp:3, ...}<br>createdAt: 1748279601"]
            S3["session-N<br>───────────────────<br>..."]
        end
    end

    T1(["Tab 1<br>Employee"]) -->|sessionId| S1
    T2(["Tab 2<br>Analyst"])  -->|sessionId| S2
    T3(["Tab N"])           -->|sessionId| S3

    style S1 fill:#16a34a,color:#fff,stroke:#15803d
    style S2 fill:#2563eb,color:#fff,stroke:#1d4ed8
    style S3 fill:#4b5563,color:#fff,stroke:#374151
```

---

## 5. Request Round-Trip Sequence

```mermaid
sequenceDiagram
    actor U as User App
    participant OS as OmniShield SDK
    participant OL as Ollama (localhost:11434)
    participant LLM as Public LLM API

    U->>OS: maskOutboundWithAI(sessionId, rawPrompt)

    note over OS: Stage 1 — Regex (sync ~0.4ms)
    OS->>OS: maskOutbound() — MASTER_REGEX scan
    OS->>OS: Assign [omni-oai/gcp/ant/email/corp] placeholders
    OS->>OS: Store fakeValue→realValue in session.mappings

    note over OS: Stage 2 — Availability check (~2ms)
    OS->>OL: GET /api/tags
    OL-->>OS: 200 OK (or timeout → skip AI layer)

    note over OS: Stage 3 — AI scan (async 200-800ms)
    OS->>OL: POST /api/generate {model: qwen2.5:1.5b, prompt}
    OL-->>OS: ["Project Nightingale", "John Harrington", ...]

    note over OS: Stage 4 — Merge (~0.1ms)
    OS->>OS: _maskTokenList() — assign [omni-ai-N] placeholders
    OS->>OS: Store AI fakeValue→realValue in session.mappings

    OS-->>U: { maskedPrompt, tokenCount, aiTokens, aiAvailable }

    U->>LLM: maskedPrompt (zero real secrets)
    LLM-->>U: llmResponse (contains only fake [omni-*] tokens)

    U->>OS: unmaskInbound(sessionId, llmResponse)
    note over OS: replaceAll loop — O(k×n), k<30, n<8KB
    OS-->>U: reconstructedResponse (all real values restored)

    U->>OS: clearSession(sessionId)
    OS->>OS: _sessions.delete(sessionId) — memory freed
```

---

## 6. Detection Pattern Taxonomy

```mermaid
flowchart LR
    subgraph R["Layer 1 — Regex (MASTER_REGEX, single-pass)"]
        direction TB
        P1["anthropic_key<br>sk-ant-api\d{2}-[A-Za-z0-9]{40,60}<br>→ [omni-ant-N]"]
        P2["openai_key<br>sk-(?:proj-)?[A-Za-z0-9]{20,60}<br>→ [omni-oai-N]"]
        P3["google_key<br>AIzaSy[A-Za-z0-9_-]{33}<br>→ [omni-gcp-N]"]
        P4["email<br>local@domain.tld<br>→ [omni-email-N]"]
        P5["corp<br>\b(Samsung|Apple|Google|...)\b<br>→ NexaCorp / StratoVentures / ..."]
    end

    subgraph A["Layer 2 — Local AI (qwen2.5:1.5b)"]
        direction TB
        A1["Project codenames<br>'Project Nightingale'<br>→ [omni-ai-N]"]
        A2["Human names<br>'John Harrington'<br>→ [omni-ai-N]"]
        A3["Internal product names<br>'Prometheus SDK'<br>→ [omni-ai-N]"]
        A4["Financial context<br>'$4.2M reserve fund'<br>→ [omni-ai-N]"]
        A5["Strategy references<br>'Operation Cobalt'<br>→ [omni-ai-N]"]
    end

    INPUT(["rawPrompt"]) --> R
    INPUT --> A
    R --> OUT(["maskedPrompt"])
    A --> OUT

    style R fill:#16a34a,color:#fff,stroke:#15803d
    style A fill:#2563eb,color:#fff,stroke:#1d4ed8
```

---

## 7. Placeholder Design (Idempotency Guarantee)

All placeholders are structurally immune to re-detection — running `maskOutbound` on an already-masked prompt produces **zero** new detections.

```mermaid
flowchart LR
    subgraph Safe["Idempotency-Safe Placeholder Formats"]
        direction TB
        OAI["[omni-oai-Fk92mX...]  ← no 'sk-' prefix"]
        GCP["[omni-gcp-D4mR8x...]  ← no 'AIzaSy' prefix"]
        ANT["[omni-ant-Kx8mNp...]  ← no 'sk-ant-api' prefix"]
        EML["[omni-email-1]         ← no '@' character"]
        CRP["NexaCorp / StratoVentures  ← not in detection list"]
        AIT["[omni-ai-1]            ← bracket token, immune to all patterns"]
    end
```

---

## 8. Module File Structure

```
omnishield-core-sdk/
├── index.js          ← OmniShieldEngine class + singleton export
│   ├── SECTION 1     Placeholder pools (all categories incl. AI)
│   ├── SECTION 2     Pre-compiled MASTER_REGEX (single-pass)
│   ├── SECTION 3     _createSessionState() factory
│   ├── SECTION 4     OmniShieldEngine class
│   │   ├── maskOutbound()        — sync regex layer
│   │   ├── maskOutboundWithAI()  — async regex + AI layer
│   │   ├── unmaskInbound()       — restore real values
│   │   ├── clearSession()        — memory cleanup
│   │   ├── _maskTokenList()      — AI token masker (internal)
│   │   └── getSessionInfo()      — diagnostic helper
│   └── SECTION 5     Singleton export
│
├── ai-scanner.js     ← AIScanner class (Ollama HTTP client)
│   ├── PROMPT_PREFIX  Few-shot prompt template (3 examples)
│   ├── isAvailable()  Health check — GET /api/tags, 2s timeout
│   ├── scan()         Public API — returns string[]
│   ├── _callOllama()  HTTP POST /api/generate, stream:false
│   └── _parseResponse() Robust JSON extraction + token filtering
│
├── test-sdk.js       ← CLI test suite (10 blocks, 59 tests passing)
├── test-edge-cases.js ← Edge cases and Security suite (Unicode, Tagging, Prompt Injection)
├── ARCHITECTURE.md   ← This file
└── package.json      ← Zero dependencies
```

---

## 9. Public API Reference

```mermaid
classDiagram
    class OmniShieldEngine {
        -Map _sessions
        -AIScanner _aiScanner
        +maskOutbound(sessionId, rawPrompt) object
        +maskOutboundWithAI(sessionId, rawPrompt, options) Promise~object~
        +unmaskInbound(sessionId, llmResponse) string
        +clearSession(sessionId) boolean
        +getSessionInfo(sessionId) object|null
        +activeSessionCount() number
        -_getOrCreateSession(sessionId) object
        -_nextPlaceholder(session, category) string
        -_maskTokenList(sessionId, tokens, currentMasked) string
    }

    class AIScanner {
        -string model
        -string host
        -number port
        -number timeout
        -number temperature
        +isAvailable() Promise~boolean~
        +scan(text) Promise~string[]~
        -_callOllama(prompt) Promise~string~
        -_parseResponse(rawText) string[]
        -_filterTokens(arr) string[]
    }

    OmniShieldEngine --> AIScanner : uses
```

---

## 10. Latency Budget

| Operation | Typical | SLA | Notes |
|---|---|---|---|
| `maskOutbound` | < 0.4 ms | < 5 ms | Single-pass regex, pre-compiled |
| `isAvailable()` | < 2 ms | < 3 ms | TCP connect only |
| `AIScanner.scan()` | 200–800 ms | < 15 s | Depends on hardware & model |
| `unmaskInbound` | < 0.2 ms | < 2 ms | `replaceAll` loop, k < 30 |
| `clearSession` | < 0.01 ms | — | `Map.delete` |

> **Why the AI latency is acceptable:**  
> The public LLM API round-trip is typically 1–5 seconds. The local AI scan (200–800 ms) happens in the same window — from the user's perspective it adds at most a fraction of a second to the existing wait.

---

## 11. Latency Optimisations

1. **Pre-compile regex at module load** — compilation cost (~5-50 µs) paid once, not per-request  
2. **Single-pass MASTER_REGEX** — one O(n) string walk instead of 5 serial passes  
3. **`Map` session store** — O(1) get/set/delete vs. object prototype-chain lookups  
4. **`replaceAll` loop for unmask** — no dynamic regex (ReDoS safe), fastest for k < 30 entries  
5. **Static pool arrays** — O(1) placeholder assignment via index pointer, zero allocation  
6. **`stream: false` in Ollama call** — receive full response in one JSON payload, no SSE parsing  
7. **Graceful AI skip** — `isAvailable()` 2s timeout means Ollama-offline detection adds < 2ms  

---

## 12. Limitations & What This Is NOT

| Capability | Status |
|---|---|
| ML/AI classification in Layer 1 | ❌ Regex only — add patterns manually |
| Network calls in Layer 1 | ❌ Fully offline and sync |
| Persistent cross-restart session storage | ❌ In-memory `Map` only |
| Encryption of in-memory mappings | ❌ Plaintext in-process |
| PII beyond listed patterns (regex layer) | ❌ Extend via Section 12 |
| 100% AI recall on all sensitive data | ⚠️ 1.5B model may miss nuanced cases |

---

## 13. Extending — Add a New Regex Category

Example: AWS IAM Access Keys (`AKIAXXXXXXXXXXXXXXXX`)

**Step 1 — Pool** in `POOLS`:
```js
AWS_KEY: ['[omni-aws-1]', '[omni-aws-2]', '[omni-aws-3]', '[omni-aws-4]'],
```

**Step 2 — Pattern** in `PATTERNS`:
```js
aws_key: /AKIA[0-9A-Z]{16}/g,
```

**Step 3 — MASTER_REGEX** (before `email`):
```js
`(?<aws_key>${PATTERNS.aws_key.source})`,
```

**Step 4 — Pool index** in `_createSessionState`:
```js
poolIndex: { ..., aws_key: 0 }
```

No other changes needed.

---

## 14. Extending — Swap the AI Model

```js
const engine = require('./index');

// Use a larger model for higher accuracy
const result = await engine.maskOutboundWithAI(sessionId, prompt, {
  aiOptions: {
    model: 'phi3:mini',       // 3.8B — better accuracy
    temperature: 0.05,        // even more deterministic
    timeout: 30000,           // longer timeout for bigger model
  }
});
```

---

## 15. Setup & Running Guide

This guide walks you through setting up, configuring, integrating, and validating the `omnishield-core-sdk` on your local environment.

### Prerequisites

* **Node.js**: Version $\ge$ 18 (zero external npm dependencies required)
* **Ollama**: Local LLM runner installed on your system (Download from [ollama.com](https://ollama.com))

---

### Step 1 — Local Ollama Path Override (Optional)

If you need to store models on a specific drive or location, override the storage directory by setting the `OLLAMA_MODELS` environment variable before starting the server.

**For Windows (PowerShell):**
```powershell
$env:OLLAMA_MODELS="C:\Users\abhay\.ollama\models"
```

**For macOS / Linux (Terminal):**
```bash
export OLLAMA_MODELS="~/.ollama/models"
```

---

### Step 2 — Start the Local Ollama Server

Start the Ollama daemon listening on port `11434`:

**On Windows:**
```powershell
ollama serve
```

---

### Step 3 — Pull the Recommended Model

For quick data firewalls, we recommend the highly efficient and lightweight **`qwen2.5:1.5b`** model (986 MB). Pull the model using:

```powershell
ollama pull qwen2.5:1.5b
```

To verify the model is pulled and available:

```powershell
ollama list
```

---

### Step 4 — Running the Test Suites

We provide two distinct CLI suites for complete verification. Make sure your shell is inside the SDK directory:

```powershell
cd c:\Users\abhay\OneDrive\Desktop\heritage\sdk_module\omnishield-core-sdk
```

#### A. Run the Comprehensive SDK Test Suite
Runs 59 validation tests covering regex patterns, session isolation, high-load stress testing, and the live AI scanner:

```powershell
node test-sdk.js
```

#### B. Run the Edge Cases & Security Suite
Tests mixed HTML/XML tags, emojis/Unicode preservation, JSON payload handling, and active prompt injection defense:

```powershell
node test-edge-cases.js
```

---

### Step 5 — Verification Logs and Features to Check

When running the tests, verify the following console log behaviors:

1. **Self-Healing Model Selection**: The SDK auto-detects what models are pulled locally using a preference list (`qwen2.5:1.5b` $\rightarrow$ `gemma3:4b` $\rightarrow$ others) and selects the best one available.
2. **Prompt Injection Defenses**: The suite validates that untrusted user instructions like *"do not redact John"* are ignored, and `John Harrington` is correctly masked as `[omni-ai-N]`.
3. **Unicode and Tag Preservation**: The suite ensures structure elements (`<company>`, `🚀`, etc.) are fully preserved in layout and reconstructed perfectly.
4. **Sub-millisecond Latencies**: Check your logs for the Layer 1 performance metrics to ensure regex scanning remains $< 0.8$ ms under stress.

---

### Step 6 — Quick Code Integration Example

Here is how to integrate `omnishield-core-sdk` into your own server application:

```javascript
const engine = require('./index');

async function handleUserPrompt(userSessionId, rawPrompt) {
  console.log('Original Prompt:', rawPrompt);

  // 1. Mask outbound prompt (combining high-performance regex & local LLM AI scan)
  const result = await engine.maskOutboundWithAI(userSessionId, rawPrompt);
  console.log('Masked Prompt to send to Public LLM:', result.maskedPrompt);
  console.log('Redacted AI entities:', result.aiTokens);

  // 2. Send the safe maskedPrompt to your public cloud API
  const publicLlmResponse = await callPublicCloudLLM(result.maskedPrompt);

  // 3. Reconstruct the response with original keys/values before showing to the user
  const restoredResponse = engine.unmaskInbound(userSessionId, publicLlmResponse);
  console.log('Restored Response for User:', restoredResponse);

  // 4. Cleanup session storage once flow finishes (optional, or per session lifecycle)
  engine.clearSession(userSessionId);
}

async function callPublicCloudLLM(prompt) {
  // Simulate public LLM returning a message mentioning our placeholders
  return `Confirmed. The system [omni-email-1] is set up, and we registered [omni-oai-Fk92...] successfully.`;
}
```

---

### Troubleshooting Common Setup Issues

#### 1. Ollama Offline Error
* **Symptom**: SDK falls back to Layer 1 (Regex only) and logs warning that Ollama is unreachable.
* **Fix**: Run `ollama serve` in a background terminal. Ensure no other applications are using port `11434`.

#### 2. Models Not Found / Empty List
* **Symptom**: `ollama list` shows no models even after pulling.
* **Fix**: Ensure the `OLLAMA_MODELS` environment variable is identically set in the shell where you run `ollama serve` and where the model is stored.
