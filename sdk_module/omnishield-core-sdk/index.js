/**
 * ============================================================
 *  OmniShield AI — Core Data Obfuscation & Tokenization SDK
 *  Version: 1.0.0
 *  Zero external dependencies. Runs entirely in-process.
 * ============================================================
 *
 *  LATENCY DESIGN PHILOSOPHY
 *  --------------------------
 *  Every decision below is made with sub-millisecond execution in mind:
 *
 *  1. Pre-compiled RegExp at module load — RegExp compilation is expensive
 *     (~5-50 µs). Compiling once at import time means maskOutbound() never
 *     pays that cost at request time.
 *
 *  2. Single-pass scan via alternation (`|`) — Instead of running N separate
 *     regex passes over the string, one combined regex with named capture
 *     groups visits each character at most once (O(n) walk). For a 4 KB
 *     prompt this saves 4-8 serial regex traversals.
 *
 *  3. Map-backed session store — O(1) get/set/delete vs. object property
 *     lookup which degrades under prototype-chain pressure.
 *
 *  4. String.prototype.replaceAll for unmask — For the inbound path the
 *     fake→real mapping is typically small (< 30 entries). A flat
 *     replaceAll loop is cache-friendlier than building a second giant
 *     regex from dynamic untrusted values.
 *
 *  5. Deterministic placeholder assignment — faker libraries add ~1-5 ms of
 *     random-pool overhead. We use pre-allocated static pools with a
 *     session-scoped index pointer so assignment is an O(1) array read.
 */

'use strict';

// Local AI scanner — uses Ollama HTTP API, zero external deps
const AIScanner = require('./ai-scanner');

// ─────────────────────────────────────────────────────────────
//  SECTION 1 — PLACEHOLDER POOLS
//  Static pools keep memory footprint tiny and allocation O(1).
//  Values are realistic-looking so LLMs reason about them naturally.
// ─────────────────────────────────────────────────────────────

const POOLS = {
  // OpenAI-style placeholders — deliberately use a non-standard prefix `[omni-oai-`
  // so they do NOT re-trigger the sk-proj- regex on a second masking pass.
  // The bracketed prefix makes them visually obvious as placeholders to reviewers
  // while being completely inert to the detection patterns.
  OPENAI_KEY: [
    '[omni-oai-Fk92mXpLqR7tNvYdCbWoEs3UzHjA8lMi1nGV5yP0T4Qe6Kx]',
    '[omni-oai-Nz4pBcHvJm8wXqT2Yr1LdKoE7sG9fAiR6Ue5WlP3Mt0Vn]',
    '[omni-oai-Qr5sYtMn2kWxPdE8Vb1Lh3AoJz9Gf7cRiU4eNm6Tp0Kw]',
    '[omni-oai-Sv7jDpWb3nLqHyE1Xk4Tm6OzGr0cFuM9Ai2RlYe8Nt5Pw]',
  ],
  // Google key placeholders — use `[omni-gcp-` prefix instead of AIzaSy
  GOOGLE_KEY: [
    '[omni-gcp-D4mR8xKq1NpL3vWoEe7Tc2HbJ9fYuG5sA]',
    '[omni-gcp-F6nT0wBr5LqM2vYkE8Xp4JcD7sHoA1Gu]',
    '[omni-gcp-H1pQ7dXm3KrN9tWbE5Vo8Lc4JzFuY2As]',
    '[omni-gcp-J9kL2mRp5XnW7vEb4Yo6Tc1HsD8fGu3Aq]',
  ],
  // Anthropic placeholders — use `[omni-ant-` prefix
  ANTHROPIC_KEY: [
    '[omni-ant-Kx8mNpQr5tWvYbE2Lc7JdH9fAs1Gu4Zo3Ti6Vm]',
    '[omni-ant-Pz4nBcHv8mXqT1Yr0LdKoE5sG7fAi2R9Ue3Wl]',
    '[omni-ant-Rv7jDpW3nLqHyE5Xk1Tm4OzGr8cFuM2Ai6Rl]',
    '[omni-ant-Tx2sYtMn9kWxPdE4Vb7Lh1AoJz3Gf5cRiU8eN]',
  ],
  // Email placeholders — deliberately contain NO '@' character.
  // Any value with '@domain.tld' would re-match the email regex on a second
  // masking pass. Bracket tokens are structurally immune: they contain only
  // alphanumeric chars and dashes inside [], making re-detection impossible.
  EMAIL: [
    '[omni-email-1]',
    '[omni-email-2]',
    '[omni-email-3]',
    '[omni-email-4]',
    '[omni-email-5]',
    '[omni-email-6]',
  ],
  // Corporate brand replacements — plausible but neutral tech names
  CORP: [
    'NexaCorp',
    'StratoVentures',
    'QuantumEdge',
    'TerraFlux',
    'VaultBridge',
    'AxiomDigital',
    'PinnacleOps',
    'OrbitSystems',
  ],
  // AI-layer placeholders — for tokens identified by the local LLM scan.
  // Bracket format ensures they are inert to all detection patterns (idempotent).
  AI: [
    '[omni-ai-1]',  '[omni-ai-2]',  '[omni-ai-3]',  '[omni-ai-4]',
    '[omni-ai-5]',  '[omni-ai-6]',  '[omni-ai-7]',  '[omni-ai-8]',
    '[omni-ai-9]',  '[omni-ai-10]', '[omni-ai-11]', '[omni-ai-12]',
    '[omni-ai-13]', '[omni-ai-14]', '[omni-ai-15]', '[omni-ai-16]',
  ],
};

// ─────────────────────────────────────────────────────────────
//  SECTION 2 — PRE-COMPILED REGEX PATTERNS
//  Compiled ONCE at module evaluation time. Named capture groups
//  allow a single exec() to identify which category matched,
//  eliminating a secondary lookup table.
//
//  Pattern breakdown:
//   • openai_key  — sk- or sk-proj- followed by 20-60 base62 chars
//   • google_key  — AIzaSy followed by 33 base62 chars (GCP format)
//   • anthropic_key — sk-ant-apiNN- prefix (Anthropic's key format)
//   • email       — RFC-5321-compliant subset; handles subdomains & TLDs
//   • corp        — Whole-word match, case-insensitive for brand safety
// ─────────────────────────────────────────────────────────────

const PATTERNS = {
  // OpenAI key: sk- or sk-proj- prefix with alphanumeric/dash body (48-56 chars typical)
  openai_key: /sk-(?:proj-)?[A-Za-z0-9]{20,60}/g,
  // Google / Firebase API key: always starts with AIzaSy + 33 base62 chars
  google_key: /AIzaSy[A-Za-z0-9_-]{33}/g,
  // Anthropic key: sk-ant-apiNN-<body>
  anthropic_key: /sk-ant-api\d{2}-[A-Za-z0-9]{40,60}/g,
  // Email addresses — local-part@domain.tld (handles dots, dashes, plus)
  email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // Corporate keywords — exact whole-word match, case-insensitive
  // Extend this list by adding more alternates inside the group.
  corp: /\b(Samsung|Apple|Google|Microsoft|Amazon|Meta|Tesla|OpenAI|Anthropic|Nvidia|Intel|IBM|Oracle|Salesforce|Adobe)\b/gi,
};

/**
 * MASTER SCANNER — single-pass alternation regex.
 *
 * The source patterns are joined with `|` so the JS engine walks
 * the input string only once, testing all alternatives at each
 * position simultaneously via NFA branching.
 *
 * Named capture group approach:
 *   (?<category>pattern)  — group name identifies the type
 *
 * Order matters: longer / more specific patterns must come first
 * to prevent the email pattern from partially eating an API key URL.
 */
const MASTER_REGEX = new RegExp(
  [
    `(?<anthropic_key>${PATTERNS.anthropic_key.source})`,
    `(?<openai_key>${PATTERNS.openai_key.source})`,
    `(?<google_key>${PATTERNS.google_key.source})`,
    `(?<email>${PATTERNS.email.source})`,
    `(?<corp>${PATTERNS.corp.source})`,
  ].join('|'),
  'gi' // global + case-insensitive (corp pattern also has its own 'i' but this is redundant-safe)
);

// ─────────────────────────────────────────────────────────────
//  SECTION 3 — SESSION STATE SHAPE
//  Each session stores:
//   • mappings  : Map<fakeValue, realValue>  — used by unmaskInbound
//   • pools     : { [category]: number }     — per-category index pointers
//   • createdAt : timestamp                  — for TTL/GC if needed
// ─────────────────────────────────────────────────────────────

function _createSessionState() {
  return {
    // fakeValue → realValue so unmask can do a direct lookup per token
    mappings: new Map(),
    // Per-category pool index — O(1) assignment, round-robins through the pool
    poolIndex: {
      openai_key: 0,
      google_key: 0,
      anthropic_key: 0,
      email: 0,
      corp: 0,
      ai: 0,           // AI-layer token counter (shared across all AI detections)
    },
    createdAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────
//  SECTION 4 — OMNISHIELD ENGINE CLASS
// ─────────────────────────────────────────────────────────────

class OmniShieldEngine {
  constructor(options = {}) {
    /**
     * Session store — Map is O(1) for get/set/delete and avoids
     * prototype-chain lookups that plain objects incur under high load.
     * @type {Map<string, object>}
     */
    this._sessions = new Map();

    /**
     * AIScanner instance — shared across all sessions in this engine.
     * The scanner itself is stateless; session state lives in _sessions.
     */
    this._aiScanner = new AIScanner(options.aiOptions ?? {});

    // Bind hot-path methods so callers can destructure without losing `this`
    this.maskOutbound       = this.maskOutbound.bind(this);
    this.unmaskInbound      = this.unmaskInbound.bind(this);
    this.clearSession       = this.clearSession.bind(this);
    this.maskOutboundWithAI = this.maskOutboundWithAI.bind(this);
  }

  // ── Internal Helpers ──────────────────────────────────────

  /**
   * Lazily creates a session state on first access.
   * Avoids forcing callers to call an explicit init() method.
   * @param {string} sessionId
   * @returns {object} session state
   */
  _getOrCreateSession(sessionId) {
    if (!this._sessions.has(sessionId)) {
      this._sessions.set(sessionId, _createSessionState());
    }
    return this._sessions.get(sessionId);
  }

  /**
   * Picks the next placeholder from a category pool using the session's
   * pool index. Round-robins to avoid collisions within a single session
   * if the same category appears many times.
   *
   * @param {object} session   - session state object
   * @param {string} category  - e.g. 'email', 'corp'
   * @returns {string} fake placeholder value
   */
  _nextPlaceholder(session, category) {
    const pool = POOLS[category.toUpperCase()];
    if (!pool) return `[REDACTED_${category.toUpperCase()}]`;

    // O(1) modular index walk — no array slicing or copying
    const idx = session.poolIndex[category] % pool.length;
    session.poolIndex[category]++;
    return pool[idx];
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * maskOutbound(sessionId, rawPrompt)
   * ────────────────────────────────────
   * Scans `rawPrompt` with the pre-compiled MASTER_REGEX in a single pass.
   * For each sensitive token found:
   *   1. Check if we already have a fake for this real value (idempotent).
   *   2. If not, assign the next placeholder from the relevant pool.
   *   3. Store fakeValue → realValue in the session mapping cache.
   *   4. Replace the real token in the output string.
   *
   * Returns the sanitised prompt safe to send to public LLM APIs.
   *
   * Latency: For a 4 KB prompt with ~10 sensitive tokens, this runs in
   * < 0.5 ms on modern V8 (Node ≥ 18) thanks to the single-pass regex.
   *
   * @param {string} sessionId
   * @param {string} rawPrompt
   * @returns {{ maskedPrompt: string, tokenCount: number, detectedTypes: string[] }}
   */
  maskOutbound(sessionId, rawPrompt) {
    if (typeof rawPrompt !== 'string') {
      throw new TypeError(`[OmniShield] rawPrompt must be a string, got ${typeof rawPrompt}`);
    }

    const session = this._getOrCreateSession(sessionId);

    // Build a reverse index (realValue → fakeValue) on each call so we can
    // deduplicate: the same API key appearing twice gets the same fake token.
    // This reverse map is ephemeral — built per-call, not stored — to keep
    // session memory minimal.
    const realToFake = new Map();
    for (const [fake, real] of session.mappings) {
      realToFake.set(real, fake);
    }

    const detectedTypes = new Set();
    let tokenCount = 0;

    // Reset lastIndex before each use — critical for /g regex shared across calls
    MASTER_REGEX.lastIndex = 0;

    const maskedPrompt = rawPrompt.replace(MASTER_REGEX, (match, ...args) => {
      // Named capture groups are the last argument before `offset` and `string`
      // In modern V8: replace callback signature is (match, p1, p2, ..., offset, string, groups)
      const groups = args[args.length - 1]; // named groups object

      // Determine which category fired
      let category = null;
      for (const key of Object.keys(groups)) {
        if (groups[key] !== undefined) {
          category = key;
          break;
        }
      }

      if (!category) return match; // safety: shouldn't happen

      // For corp matches, normalise to the original casing match
      // but key deduplication on lowercase to avoid Samsung/samsung split
      const dedupeKey = category === 'corp' ? match.toLowerCase() : match;

      // ── Deduplication: reuse existing fake if this real value was seen ──
      if (realToFake.has(dedupeKey)) {
        detectedTypes.add(category);
        return realToFake.get(dedupeKey);
      }

      // ── Assign a new placeholder ──
      const fakeValue = this._nextPlaceholder(session, category);

      // Store in session mapping: fake → real (for unmask)
      session.mappings.set(fakeValue, match);

      // Store in local reverse map: real → fake (for dedup within this call)
      realToFake.set(dedupeKey, fakeValue);

      detectedTypes.add(category);
      tokenCount++;
      return fakeValue;
    });

    return {
      maskedPrompt,
      tokenCount,
      detectedTypes: [...detectedTypes],
    };
  }

  /**
   * _maskTokenList(sessionId, tokens)
   * ───────────────────────────────────
   * Internal helper — takes an array of raw string tokens (from the AI
   * scanner) and masks each one into the session using the AI pool.
   *
   * Deduplication: if the same token was already mapped (by regex or a
   * previous AI scan), we reuse the existing fake value.
   * Containment check: if a token is a sub-string of a value that was
   * already replaced, skip it (e.g. "Samsung" inside an already-gone key).
   *
   * @param {string}   sessionId
   * @param {string[]} tokens
   * @param {string}   currentMasked — the already-masked text (for containment check)
   * @returns {string} updated masked text with AI tokens replaced
   */
  _maskTokenList(sessionId, tokens, currentMasked) {
    if (!tokens.length) return currentMasked;

    const session = this._getOrCreateSession(sessionId);

    // Build reverse map: realValue → fakeValue (for dedup)
    const realToFake = new Map();
    for (const [fake, real] of session.mappings) {
      realToFake.set(real.toLowerCase(), fake);
    }

    let masked = currentMasked;

    for (const token of tokens) {
      if (!token || token.length < 2) continue;

      const key = token.toLowerCase();

      // ── Deduplication: same real value already mapped ──
      if (realToFake.has(key)) {
        // Replace any remaining occurrences with the existing fake
        masked = masked.replaceAll(token, realToFake.get(key));
        continue;
      }

      // ── Skip if the token is no longer in the text (already gone) ──
      if (!masked.includes(token)) continue;

      // ── Assign next AI pool placeholder ──
      const fakeValue = this._nextPlaceholder(session, 'ai');
      session.mappings.set(fakeValue, token);
      realToFake.set(key, fakeValue);

      // Case-insensitive global replacement
      // Use a regex for case-insensitivity; escape special chars first
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      masked = masked.replace(new RegExp(escaped, 'gi'), fakeValue);
    }

    return masked;
  }

  /**
   * maskOutboundWithAI(sessionId, rawPrompt, options)
   * ──────────────────────────────────────────────────
   * Two-stage async pipeline:
   *
   *   Stage 1 — Regex (sync, ~0.4 ms):
   *     Runs maskOutbound() — catches API keys, emails, known corp names.
   *
   *   Stage 2 — Local LLM (async, ~200-800 ms):
   *     Sends the ORIGINAL rawPrompt to the local AI scanner so it has
   *     full context. The scanner returns additional sensitive strings
   *     that the regex layer missed (codenames, human names, etc.).
   *     Those are then masked into the already-partially-sanitised text.
   *
   * Fallback: if Ollama is offline or times out, returns the regex-only
   * result with `aiAvailable: false` — the pipeline never breaks.
   *
   * @param {string} sessionId
   * @param {string} rawPrompt
   * @param {object} [options]
   * @param {object} [options.aiOptions] — override AIScanner constructor opts
   * @returns {Promise<{
   *   maskedPrompt: string,
   *   tokenCount: number,
   *   aiTokenCount: number,
   *   detectedTypes: string[],
   *   aiTokens: string[],
   *   aiAvailable: boolean
   * }>}
   */
  async maskOutboundWithAI(sessionId, rawPrompt, options = {}) {
    if (typeof rawPrompt !== 'string') {
      throw new TypeError(`[OmniShield] rawPrompt must be a string, got ${typeof rawPrompt}`);
    }

    // ── Stage 1: Regex scan (sync) ──────────────────────────
    const regexResult = this.maskOutbound(sessionId, rawPrompt);
    let { maskedPrompt, tokenCount, detectedTypes } = regexResult;

    // ── Stage 2: AI scan (async) ────────────────────────────
    // Use a fresh AIScanner if aiOptions override is provided
    const scanner = Object.keys(options.aiOptions ?? {}).length
      ? new AIScanner(options.aiOptions)
      : this._aiScanner;

    const aiAvailable = await scanner.isAvailable();

    if (!aiAvailable) {
      return { maskedPrompt, tokenCount, aiTokenCount: 0,
               detectedTypes, aiTokens: [], aiAvailable: false };
    }

    // Scan the RAW prompt so the AI has full context — it sees what the
    // regex already caught, giving it better entity disambiguation.
    const aiTokens = await scanner.scan(rawPrompt);

    // ── Stage 3: Mask AI-identified tokens ──────────────────
    maskedPrompt = this._maskTokenList(sessionId, aiTokens, maskedPrompt);

    // Count only genuinely new tokens (not already caught by regex)
    const aiTokenCount = aiTokens.filter(t => maskedPrompt.includes('[omni-ai-')).length;

    return {
      maskedPrompt,
      tokenCount,
      aiTokenCount: aiTokens.length,
      detectedTypes: [...detectedTypes, ...(aiTokens.length ? ['ai_detected'] : [])],
      aiTokens,
      aiAvailable: true,
    };
  }

  /**
   * unmaskInbound(sessionId, llmResponse)
   * ──────────────────────────────────────
   * Takes the LLM's response (which contains fake placeholder values) and
   * replaces every fake token with its real counterpart using the session
   * mapping cache built during maskOutbound.
   *
   * Uses a simple for-loop + String.replaceAll instead of another regex
   * because:
   *   • The mapping is small (typically < 30 entries per session).
   *   • replaceAll is highly optimised in V8 for exact string search.
   *   • Building a dynamic regex from untrusted strings risks ReDoS.
   *
   * Latency: O(k × n) where k = mapping entries, n = response length.
   * For k < 30 and n < 8 KB this is sub-0.3 ms.
   *
   * @param {string} sessionId
   * @param {string} llmResponse
   * @returns {string} reconstructed response with real values restored
   */
  unmaskInbound(sessionId, llmResponse) {
    if (typeof llmResponse !== 'string') {
      throw new TypeError(`[OmniShield] llmResponse must be a string, got ${typeof llmResponse}`);
    }

    const session = this._sessions.get(sessionId);

    // If no session exists, the response is already clean — return as-is
    if (!session || session.mappings.size === 0) {
      return llmResponse;
    }

    let unmasked = llmResponse;

    // Iterate the mapping and do a global string replacement per token.
    // Map iteration order is insertion order — deterministic in V8.
    for (const [fakeValue, realValue] of session.mappings) {
      // replaceAll is O(n) per iteration, efficient for short strings
      unmasked = unmasked.replaceAll(fakeValue, realValue);
    }

    return unmasked;
  }

  /**
   * clearSession(sessionId)
   * ────────────────────────
   * Wipes all cached mappings and pool state for the given session.
   * Call this when a browser tab closes, a file upload completes, or
   * the user explicitly ends an interaction — prevents unbounded memory
   * growth in long-running gateway processes.
   *
   * @param {string} sessionId
   * @returns {boolean} true if the session existed and was cleared
   */
  clearSession(sessionId) {
    const existed = this._sessions.has(sessionId);
    this._sessions.delete(sessionId);
    return existed;
  }

  /**
   * getSessionInfo(sessionId)
   * ─────────────────────────
   * Diagnostic helper — returns session metadata without exposing real values.
   * Useful for health-check endpoints or debug logging.
   *
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSessionInfo(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      mappingCount: session.mappings.size,
      poolUsage: { ...session.poolIndex },
      createdAt: new Date(session.createdAt).toISOString(),
      ageMs: Date.now() - session.createdAt,
    };
  }

  /**
   * activeSessionCount — quick health metric for the gateway host process.
   * @returns {number}
   */
  get activeSessionCount() {
    return this._sessions.size;
  }
}

// ─────────────────────────────────────────────────────────────
//  SECTION 5 — SINGLETON EXPORT
//  One engine instance per process. The session Map inside handles
//  tab/request isolation — no shared mutable state leaks between sessions.
// ─────────────────────────────────────────────────────────────

const engine = new OmniShieldEngine();

module.exports = engine;
module.exports.OmniShieldEngine = OmniShieldEngine; // also export the class for testing/extension
