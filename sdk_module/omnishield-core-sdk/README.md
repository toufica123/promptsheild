# OmniShield AI — Core SDK

> **Zero-Dependency. Sub-Millisecond. Zero Cloud Leaks.**  
> A lightweight, deterministic data firewall and bi-directional tokenization engine sitting between your application and public LLM APIs (OpenAI, Gemini, Claude, etc.).

---

## 1. Overview & Core Paradigm

`omnishield-core-sdk` operates as an **AI Firewall** to redact sensitive records (API keys, emails, corporate names) before they leave your environment, and restores them seamlessly when public LLM responses return. It combines ultra-fast deterministic regex rules with high-accuracy local cognitive models.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Application                               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (rawPrompt)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     OmniShield Engine (Localhost)                      │
│                                                                        │
│  ┌───────────────────────────┐           ┌──────────────────────────┐  │
│  │   Layer 1: Regex Scan     │           │   Layer 2: Local LLM     │  │
│  │   • Pre-compiled RegEx    ├──────────►│   • qwen2.5:1.5b         │  │
│  │   • Latency: < 0.5 ms     │           │   • Latency: 200-800 ms  │  │
│  └───────────────────────────┘           └──────────────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (fully maskedPrompt)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Public LLM (Cloud)                             │
│                      (OpenAI / Gemini / Claude)                        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (llmResponse with fake tokens)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        unmaskInbound() (Local)                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (reconstructed real response)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              Application                               │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Capabilities:
* **Dual-Layer Defense**:
  * **Layer 1 — Regex**: Dynamic, single-pass RegExp scanning catching structured tokens (API keys, email addresses, corporate entities) in **< 0.5 ms**.
  * **Layer 2 — Local AI**: A secure cognitive scanner running `qwen2.5:1.5b` locally via Ollama to redact names, proprietary terms, and project codenames.
* **100% In-Memory Mappings**: Session records are held in standard Node `Map` tables isolated by `sessionId`.
* **Zero External npm Dependencies**: Built purely with native Node.js core libraries (`node:http`, `node:assert`, etc.).
* **Idempotency Guarantees**: Running the scanner on already-redacted text returns **zero** new tokens, preventing pattern contamination.

---

## 2. Detailed Architecture Blueprint

This diagram illustrates how the SDK boundary encapsulates the deterministic scanner, cognitive interface, and local session tables to process payloads in complete network isolation.

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

The SDK maintains transactional safety by tokenizing outgoing inputs and dynamically reversing the substitution map on response streams.

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

Each tab, prompt thread, or user context holds a designated `sessionId` targeting isolated memory states, avoiding crosstalk or leak risks.

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

## 5. Detection Pattern Taxonomy

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

## 6. Setup & Running Guide

Follow this guide to initialize, configure, and validate `omnishield-core-sdk` on your local environment.

### Prerequisites
* **Node.js**: $\ge$ Version 18.
* **Ollama**: Local model execution engine. Install from [ollama.com](https://ollama.com).

### Step 1 — Local Model Storage Paths (Optional)
If you wish to configure a custom storage path for Ollama's downloaded models:

**For Windows (PowerShell):**
```powershell
$env:OLLAMA_MODELS="C:\Users\your_user_name\.ollama\models"
```

**For macOS / Linux (Terminal):**
```bash
export OLLAMA_MODELS="~/.ollama/models"
```

### Step 2 — Start Ollama Daemon
Start the server listening on the default local port (`11434`):

```powershell
ollama serve
```

### Step 3 — Pull Recommended LLM Model
Download the high-efficiency `qwen2.5:1.5b` model:

```powershell
ollama pull qwen2.5:1.5b
```

Verify downloaded models:

```powershell
ollama list
```

### Step 4 — Run Local SDK Test Suites
Navigate into the SDK directory:

```powershell
cd c:\Users\abhay\OneDrive\Desktop\heritage\sdk_module\omnishield-core-sdk
```

#### A. Execute Comprehensive Test Suite
Validates pattern detection limits, singleton stability, high-frequency performance stress, and real LLM scanner calls:
```powershell
node test-sdk.js
```

#### B. Execute Custom Edge-Cases & Security Suite
Validates tag rendering, HTML nesting, Unicode symbols, and prompt injection defense layers:
```powershell
node test-edge-cases.js
```

---

## 7. Quick Code Integration Example

Integrating OmniShield into an LLM proxy or API gateway is straightforward:

```javascript
const engine = require('./index');

async function processSecureSession(sessionId, rawUserPrompt) {
  // 1. Dual-layer outbound redaction (Regex + Local LLM AI scan)
  const redactResult = await engine.maskOutboundWithAI(sessionId, rawUserPrompt);
  
  console.log('Sanitised string for cloud:', redactResult.maskedPrompt);

  // 2. Safely call public cloud LLM API with masked content
  const rawLlmResponse = await callPublicCloudLLM(redactResult.maskedPrompt);

  // 3. De-tokenize response payload, seamlessly restoring original variables
  const restoredText = engine.unmaskInbound(sessionId, rawLlmResponse);
  
  console.log('Restored text to return to client:', restoredText);

  // 4. Wipe session tracking maps when context is closed
  engine.clearSession(sessionId);
}
```

---

## 8. Latency Budgets & SLA Goals

| Method | Typical Latency | Target SLA | Execution Type |
|---|---|---|---|
| `maskOutbound` | < 0.4 ms | < 5 ms | Synchronous |
| `unmaskInbound` | < 0.2 ms | < 2 ms | Synchronous |
| `isAvailable` | < 2 ms | < 5 ms | Asynchronous |
| `scan` (Local LLM) | 200 - 800 ms | < 15,000 ms | Asynchronous |

*The local LLM processing (200–800 ms) sits parallel to typical public cloud LLM processing windows (1,000–5,000 ms), resulting in virtually no perceivable overhead for interactive applications.*

---

## 9. Extending & Swapping Models

### Swap the AI Model
```javascript
const result = await engine.maskOutboundWithAI(sessionId, prompt, {
  aiOptions: {
    model: 'gemma3:4b', // swap to larger or custom models
    temperature: 0.1
  }
});
```

### Add a New Regex Category
1. Add custom placeholder codes in `POOLS`.
2. Map your regular expression to `PATTERNS`.
3. Add the capture group directly in the `MASTER_REGEX` template.
4. Bind counter offsets under `_createSessionState()`.
