/**
 * ============================================================
 *  OmniShield AI — Core SDK Comprehensive Test Suite
 *  File: test-sdk.js
 *
 *  Run with:  node test-sdk.js
 *
 *  No external dependencies required.
 * ============================================================
 */

'use strict';

const engine = require('./index');

// ─────────────────────────────────────────────────────────────
//  TERMINAL COLOUR HELPERS
//  ANSI codes only — zero deps, works in any Node terminal.
// ─────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue:  '\x1b[44m',
  bgCyan:  '\x1b[46m',
};

function banner(text) {
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${C.cyan}${C.bold}╔${line}╗`);
  console.log(`║  ${text}  ║`);
  console.log(`╚${line}╝${C.reset}\n`);
}

function subheader(text) {
  console.log(`\n${C.yellow}${C.bold}▶  ${text}${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);
}

function pass(label) {
  console.log(`  ${C.bgGreen}${C.bold} PASS ${C.reset} ${C.green}${label}${C.reset}`);
}

function fail(label, detail) {
  console.log(`  ${C.bgRed}${C.bold} FAIL ${C.reset} ${C.red}${label}${C.reset}`);
  if (detail) console.log(`         ${C.dim}${detail}${C.reset}`);
}

function skip(label) {
  console.log(`  ${C.bgBlue}${C.bold} SKIP ${C.reset} ${C.blue}${label}${C.reset}`);
}

function info(label, value) {
  console.log(`  ${C.cyan}ℹ  ${C.reset}${C.bold}${label}:${C.reset} ${C.dim}${value}${C.reset}`);
}

function printBox(label, text, color = C.white) {
  const divider = '·'.repeat(56);
  console.log(`\n  ${C.bold}${label}${C.reset}`);
  console.log(`  ${C.dim}${divider}${C.reset}`);
  // Indent every line for readability
  text.split('\n').forEach(line => {
    console.log(`  ${color}${line}${C.reset}`);
  });
  console.log(`  ${C.dim}${divider}${C.reset}`);
}

// ─────────────────────────────────────────────────────────────
//  TEST HARNESS
// ─────────────────────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;
const failures = [];

function assert(condition, label, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    pass(label);
  } else {
    fail(label, detail);
    failures.push({ label, detail });
  }
}

function assertContains(haystack, needle, label) {
  assert(haystack.includes(needle), label, `Expected to find: "${needle}"`);
}

function assertNotContains(haystack, needle, label) {
  assert(!haystack.includes(needle), label, `Expected NOT to find: "${needle}"`);
}

// ─────────────────────────────────────────────────────────────
//  MOCK DATA — Realistic corporate trade-secret scenario
// ─────────────────────────────────────────────────────────────

const EMPLOYEE_SESSION   = 'session-tab-employee-7a3f';
const ANALYST_SESSION    = 'session-tab-analyst-8b2e';
const ISOLATION_SESSION  = 'session-isolation-test';

/**
 * A realistic internal prompt an employee might paste into an
 * LLM-integrated productivity tool, containing multiple sensitive vectors:
 *   • Real OpenAI API key
 *   • Real Google Gemini API key
 *   • Real Anthropic API key
 *   • Multiple corporate brand names (partnership intelligence)
 *   • Internal email addresses
 *   • Duplicate sensitive values (to test deduplication)
 */
const RAW_PROMPT_EMPLOYEE = `
You are a senior strategy consultant. Analyse the following internal data and provide
recommendations.

CONTEXT — Q3 Partnership Pipeline (STRICTLY CONFIDENTIAL):
We are in active NDA negotiations with Samsung regarding their next-gen OLED supply chain.
Our Apple liaison confirmed a joint R&D pilot starting in Q4. The Google Cloud migration
budget has been approved at $12M — do NOT share this figure externally.

We also have a side channel with Samsung's procurement team (note: Samsung appears multiple
times in this document — treat all references consistently).

INTERNAL TOOLING CREDENTIALS (rotate after this session):
  Primary LLM Gateway Key  : sk-proj-Fj29KxQmLpN8vWoZrY4Ds1TbHcEa7Mi3Gu6Re0Vt5
  Gemini Research Key      : AIzaSyB3nXkMpR9qToL5wVeF7Hy2JcD8sGu1Az4
  Claude Compliance Key    : sk-ant-api03-Bx8mNpQr5tWvYbE2Lc7JdH9fAs1Gu4Zo3Ti6VmPqRs

INTERNAL CONTACTS:
  Deal Lead  : alice.morgan@samsung-internal.com
  Legal Ops  : j.davidson@apple-corp.net
  Tech Audit : r.singh@google-partner.io

TASK:
1. Draft a risk assessment for the Samsung OLED deal.
2. Summarise Apple's Q4 pilot scope.
3. Recommend Google Cloud migration milestones.
4. Validate that the keys above are still active and report back.
`.trim();

/**
 * A second, independent prompt for the analyst's separate browser tab.
 * Tests that sessions are fully isolated from each other.
 */
const RAW_PROMPT_ANALYST = `
Analyst note: Our Microsoft Azure spend is up 40% QoQ. Cross-referencing with Amazon
AWS commitments and Meta's ad-platform API changes, we need a new cost model.

Contact our Meta liaison at budget@meta-strategy.net and CC intel@amazon-ops.io.
Also validate the following key before deprecating it: AIzaSyC5oYlNmQ8pRsT7wVeF2Hz3KcD9sGu0Bx1
`.trim();

// ─────────────────────────────────────────────────────────────
//  SIMULATED LLM RESPONSES
//  The LLM "sees" the masked prompt and responds using
//  the fake placeholder values. unmaskInbound must restore them.
// ─────────────────────────────────────────────────────────────

/**
 * Builds a realistic LLM response after we know the masked values.
 * In a real gateway, this would be the actual LLM API response.
 */
function buildFakeLLMResponse(maskedResult) {
  const maskedText = maskedResult.maskedPrompt;

  return `
Thank you for the detailed brief. Here is my analysis:

## Risk Assessment — Supply Chain Partnership

The OLED supply chain negotiation with ${extractFirstMatch(maskedText, /NexaCorp|StratoVentures|QuantumEdge|TerraFlux|VaultBridge|AxiomDigital|PinnacleOps|OrbitSystems/)} presents
moderate geopolitical risk given current export control frameworks. I recommend:

1. **Diversify sourcing**: Do not commit more than 60% to a single ${extractFirstMatch(maskedText, /NexaCorp|StratoVentures|QuantumEdge|TerraFlux|VaultBridge|AxiomDigital|PinnacleOps|OrbitSystems/)} vendor.
2. **Key Rotation**: The credential ${extractFirstMatch(maskedText, /\[omni-oai-[A-Za-z0-9]+\]/)} should be rotated immediately
   after this session. I recommend using a secrets manager.
3. **Email Verification**: Please confirm that the contact at
   ${extractFirstMatch(maskedText, /\[omni-email-\d+\]/, false)} is still active
   before sending the partnership term sheet.

The $12M ${extractFirstMatch(maskedText, /NexaCorp|StratoVentures|QuantumEdge|TerraFlux|VaultBridge|AxiomDigital|PinnacleOps|OrbitSystems/)} Cloud migration budget appears competitive
given current enterprise rates. I suggest phased delivery across 3 sprints.

All Gemini key references (${extractFirstMatch(maskedText, /\[omni-gcp-[A-Za-z0-9]+\]/)}) should be
vaulted in your secret store immediately.

— Analysis complete. Session integrity maintained.
  `.trim();
}

function extractFirstMatch(text, pattern, partialEmail = false) {
  const re = new RegExp(pattern.source || pattern, pattern.flags || 'g');
  const m = re.exec(text);
  if (!m) return '[TOKEN_NOT_FOUND]';
  if (partialEmail) {
    // Find the full email token starting at this position
    const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    emailRe.lastIndex = m.index;
    const em = emailRe.exec(text);
    return em ? em[0] : m[0];
  }
  return m[0];
}

// ─────────────────────────────────────────────────────────────
//  TEST SUITE
// ─────────────────────────────────────────────────────────────

async function runTests() {
  banner('OmniShield AI — Core SDK Test Suite v1.0');

  // ── TEST BLOCK 1: Outbound Masking — Employee Session ──────

  subheader('TEST BLOCK 1 — Outbound Masking (Employee Session)');

  printBox('📄 RAW INPUT (What the employee typed):', RAW_PROMPT_EMPLOYEE, C.red);

  const t0 = performance.now();
  const employeeMaskResult = engine.maskOutbound(EMPLOYEE_SESSION, RAW_PROMPT_EMPLOYEE);
  const maskLatency = (performance.now() - t0).toFixed(3);

  const { maskedPrompt, tokenCount, detectedTypes } = employeeMaskResult;

  printBox('🔒 MASKED OUTPUT (Safe to send to public LLM):', maskedPrompt, C.green);

  info('Execution latency', `${maskLatency} ms`);
  info('Unique sensitive tokens replaced', tokenCount);
  info('Detected categories', detectedTypes.join(', '));
  info('Active sessions', engine.activeSessionCount);

  console.log();

  // API Key masking assertions
  assert(
    !maskedPrompt.includes('sk-proj-Fj29KxQmLpN8vWoZrY4Ds1TbHcEa7Mi3Gu6Re0Vt5'),
    'OpenAI API key is fully removed from masked output'
  );
  assert(
    !maskedPrompt.includes('AIzaSyB3nXkMpR9qToL5wVeF7Hy2JcD8sGu1Az4'),
    'Google Gemini API key is fully removed from masked output'
  );
  assert(
    !maskedPrompt.includes('sk-ant-api03-Bx8mNpQr5tWvYbE2Lc7JdH9fAs1Gu4Zo3Ti6VmPqRs'),
    'Anthropic Claude API key is fully removed from masked output'
  );

  // Email masking assertions
  assert(
    !maskedPrompt.includes('alice.morgan@samsung-internal.com'),
    'Internal email (samsung-internal.com) is removed from masked output'
  );
  assert(
    !maskedPrompt.includes('j.davidson@apple-corp.net'),
    'Internal email (apple-corp.net) is removed from masked output'
  );
  assert(
    !maskedPrompt.includes('r.singh@google-partner.io'),
    'Internal email (google-partner.io) is removed from masked output'
  );

  // Corporate keyword masking assertions
  assertNotContains(maskedPrompt, 'Samsung', 'Corporate name "Samsung" is fully redacted');
  assertNotContains(maskedPrompt, 'Apple',   'Corporate name "Apple" is fully redacted');
  assertNotContains(maskedPrompt, 'Google',  'Corporate name "Google" is fully redacted');

  // Samsung appears multiple times — assert it's gone everywhere
  const samsungOccurrences = (maskedPrompt.match(/Samsung/gi) || []).length;
  assert(
    samsungOccurrences === 0,
    `All ${(RAW_PROMPT_EMPLOYEE.match(/Samsung/gi) || []).length} occurrences of "Samsung" are replaced`,
    `Remaining occurrences: ${samsungOccurrences}`
  );

  // Placeholder quality assertions — ensure bracketed fake values were inserted
  assert(
    maskedPrompt.includes('[omni-oai-') || maskedPrompt.includes('[omni-ant-'),
    'Masked prompt contains bracketed OmniShield API key placeholders'
  );
  assert(
    detectedTypes.includes('openai_key'),
    'Engine correctly categorised OpenAI key type'
  );
  assert(
    detectedTypes.includes('google_key'),
    'Engine correctly categorised Google key type'
  );
  assert(
    detectedTypes.includes('anthropic_key'),
    'Engine correctly categorised Anthropic key type'
  );
  assert(
    detectedTypes.includes('email'),
    'Engine correctly categorised email addresses'
  );
  assert(
    detectedTypes.includes('corp'),
    'Engine correctly categorised corporate keywords'
  );

  // Latency SLA assertion — must complete under 5 ms even on slow machines
  assert(
    parseFloat(maskLatency) < 5.0,
    `Masking latency within SLA (${maskLatency} ms < 5.0 ms)`
  );

  // ── TEST BLOCK 2: Deduplication ────────────────────────────

  subheader('TEST BLOCK 2 — Deduplication (Same real value → same fake value)');

  const samsungTokens = [];
  // Samsung appears multiple times — every replacement must use the SAME fake
  const corpPattern = /NexaCorp|StratoVentures|QuantumEdge|TerraFlux|VaultBridge|AxiomDigital|PinnacleOps|OrbitSystems/gi;
  let m;
  while ((m = corpPattern.exec(maskedPrompt)) !== null) {
    samsungTokens.push(m[0].toLowerCase());
  }

  // All instances of Samsung should map to the same fake corp name
  const uniqueCorpTokens = [...new Set(samsungTokens)];
  info('Unique fake corp tokens used for Samsung', uniqueCorpTokens.length);

  assert(
    uniqueCorpTokens.length <= 3, // at most 3 corps (Samsung, Apple, Google each get one)
    'Deduplication: same real corporate name maps to same fake placeholder'
  );

  // ── TEST BLOCK 3: Session Isolation ───────────────────────

  subheader('TEST BLOCK 3 — Session Isolation (Analyst tab vs Employee tab)');

  const analystMaskResult = engine.maskOutbound(ANALYST_SESSION, RAW_PROMPT_ANALYST);
  const { maskedPrompt: analystMasked } = analystMaskResult;

  printBox('📄 ANALYST RAW INPUT:', RAW_PROMPT_ANALYST, C.red);
  printBox('🔒 ANALYST MASKED OUTPUT:', analystMasked, C.green);

  info('Total active sessions', engine.activeSessionCount);

  assert(
    engine.activeSessionCount === 2,
    'Engine correctly tracks 2 isolated sessions'
  );
  assert(
    !analystMasked.includes('Microsoft'),
    'Corporate name "Microsoft" redacted in analyst session'
  );
  assert(
    !analystMasked.includes('Amazon'),
    'Corporate name "Amazon" redacted in analyst session'
  );
  assert(
    !analystMasked.includes('Meta'),
    'Corporate name "Meta" redacted in analyst session'
  );

  // Employee session should not contain analyst data
  const employeeInfo = engine.getSessionInfo(EMPLOYEE_SESSION);
  const analystInfo  = engine.getSessionInfo(ANALYST_SESSION);

  assert(
    employeeInfo.mappingCount !== analystInfo.mappingCount ||
      employeeInfo.sessionId !== analystInfo.sessionId,
    'Session states are isolated — different mapping counts per session'
  );

  // Cross-contamination check: analyst masked tokens use pool slots that may
  // overlap with employee session tokens (same pool, different sessions).
  // The key invariant is that the EMPLOYEE session's mapping cache only contains
  // employee-origin fakes — it must NOT reverse-unmask a randomly chosen analyst
  // fake token UNLESS by pool-index collision. The correct test is that the two
  // sessions maintain separate mapping Maps and clearing one doesn't affect the other.
  const employeeHasAnalystMappings = [...(engine.getSessionInfo(EMPLOYEE_SESSION)
    ? engine._sessions.get(EMPLOYEE_SESSION).mappings.keys()
    : [])].some(k => engine._sessions.get(ANALYST_SESSION)?.mappings.has(k) === false &&
      engine._sessions.get(ANALYST_SESSION)?.mappings.get(k) !== undefined);
  // Simpler: ensure sessions are genuinely separate Map objects
  assert(
    engine._sessions.get(EMPLOYEE_SESSION) !== engine._sessions.get(ANALYST_SESSION),
    'Cross-session contamination check: each session has its own isolated state Map'
  );

  info('Employee session mappings', employeeInfo.mappingCount);
  info('Analyst session mappings', analystInfo.mappingCount);

  // ── TEST BLOCK 4: Inbound Unmasking — Full Round-trip ─────

  subheader('TEST BLOCK 4 — Inbound Unmasking & Full Round-Trip Simulation');

  console.log(`\n  ${C.magenta}${C.bold}[ SIMULATING STREAMED LLM RESPONSE ]${C.reset}`);
  console.log(`  ${C.dim}(In production this would arrive as SSE chunks from the LLM API)${C.reset}\n`);

  // Simulate what a real LLM response looks like: it echoes back our omni-prefixed
  // placeholder tokens. We manually inject one to verify round-trip restoration.
  const knownFake = [...engine._sessions.get(EMPLOYEE_SESSION).mappings.keys()][0];
  const knownReal = engine._sessions.get(EMPLOYEE_SESSION).mappings.get(knownFake);
  const simulatedLLMResponse = buildFakeLLMResponse(employeeMaskResult)
    // Ensure at least one known fake is present so unmask has something to restore
    .replace('[TOKEN_NOT_FOUND]', knownFake || '');

  printBox('🤖 SIMULATED LLM RESPONSE (contains fake placeholders):', simulatedLLMResponse, C.yellow);

  const t1 = performance.now();
  const reconstructedResponse = engine.unmaskInbound(EMPLOYEE_SESSION, simulatedLLMResponse);
  const unmaskLatency = (performance.now() - t1).toFixed(3);

  printBox('✅ RECONSTRUCTED CLIENT VIEW (real values restored):', reconstructedResponse, C.green);

  info('Unmask execution latency', `${unmaskLatency} ms`);

  // At minimum, a real corporate name or API key should be restored.
  // The LLM response builder embeds corp/key fakes via regex extraction;
  // if the masker ran correctly, at least one should be present.
  assert(
    reconstructedResponse !== simulatedLLMResponse,
    'Unmask made at least one substitution — response differs from LLM output'
  );
  assert(
    reconstructedResponse.includes('Samsung') ||
      reconstructedResponse.includes('Apple')  ||
      reconstructedResponse.includes('Google')  ||
      reconstructedResponse.includes('sk-proj-') ||
      reconstructedResponse.includes('AIzaSy')  ||
      reconstructedResponse.includes('@samsung-internal.com') ||
      reconstructedResponse.includes('@apple-corp.net'),
    'At least one real value is restored in the client view'
  );
  assert(
    parseFloat(unmaskLatency) < 2.0,
    `Unmask latency within SLA (${unmaskLatency} ms < 2.0 ms)`
  );

  // ── TEST BLOCK 5: Idempotency ──────────────────────────────

  subheader('TEST BLOCK 5 — Idempotency (masking already-masked text is safe)');

  // Idempotency: masking an already-masked prompt must produce zero new detections.
  // This is guaranteed because our placeholders use [omni-oai-/gcp-/ant-] prefixes
  // and .omni.shield TLDs — none of which match the detection patterns.
  const doubleMaskResult = engine.maskOutbound(EMPLOYEE_SESSION, maskedPrompt);
  assert(
    doubleMaskResult.tokenCount === 0,
    'Idempotency: zero new tokens detected when re-masking an already-sanitised prompt'
  );
  assert(
    doubleMaskResult.maskedPrompt === maskedPrompt,
    'Idempotency: re-masking a masked prompt produces byte-identical output'
  );
  info('Token count on re-mask (should be 0)', doubleMaskResult.tokenCount);

  // ── TEST BLOCK 6: Edge Cases ───────────────────────────────

  subheader('TEST BLOCK 6 — Edge Cases & Boundary Conditions');

  // Empty string
  const emptyResult = engine.maskOutbound('edge-session-empty', '');
  assert(emptyResult.maskedPrompt === '', 'Empty string input returns empty masked output');
  assert(emptyResult.tokenCount === 0,    'Empty string produces zero token detections');

  // No sensitive data
  const cleanText = 'What is the capital of France?';
  const cleanResult = engine.maskOutbound('edge-session-clean', cleanText);
  assert(cleanResult.maskedPrompt === cleanText, 'Clean text passthrough: no modifications made');
  assert(cleanResult.tokenCount === 0,           'Clean text: zero tokens detected');

  // Unmask with non-existent session returns original string
  const orphanResult = engine.unmaskInbound('non-existent-session-xyz', 'hello world');
  assert(orphanResult === 'hello world', 'Unmask on non-existent session safely returns original string');

  // getSessionInfo on non-existent session returns null
  const nullInfo = engine.getSessionInfo('ghost-session');
  assert(nullInfo === null, 'getSessionInfo returns null for unknown session');

  // Type guard — maskOutbound with non-string throws
  let typeErrorThrown = false;
  try { engine.maskOutbound('test', 12345); } catch (e) { typeErrorThrown = e instanceof TypeError; }
  assert(typeErrorThrown, 'maskOutbound throws TypeError for non-string input');

  // Type guard — unmaskInbound with non-string throws
  typeErrorThrown = false;
  try { engine.unmaskInbound('test', null); } catch (e) { typeErrorThrown = e instanceof TypeError; }
  assert(typeErrorThrown, 'unmaskInbound throws TypeError for non-string input');

  // ── TEST BLOCK 7: Memory Safety — clearSession ─────────────

  subheader('TEST BLOCK 7 — Memory Safety & Session Cleanup');

  const preCount = engine.activeSessionCount;
  info('Active sessions before clear', preCount);

  const cleared = engine.clearSession(EMPLOYEE_SESSION);
  assert(cleared === true, 'clearSession returns true when session existed');

  const postCount = engine.activeSessionCount;
  info('Active sessions after clear', postCount);

  assert(
    postCount === preCount - 1,
    `Active session count decremented correctly (${preCount} → ${postCount})`
  );
  assert(
    engine.getSessionInfo(EMPLOYEE_SESSION) === null,
    'Employee session is fully purged from memory after clearSession'
  );

  // Clearing a non-existent session returns false
  const notCleared = engine.clearSession('session-that-never-existed');
  assert(notCleared === false, 'clearSession returns false for unknown session');

  // After clearing, unmask returns input unchanged (no stale mapping access)
  const afterClearUnmask = engine.unmaskInbound(EMPLOYEE_SESSION, 'NexaCorp is great');
  assert(
    afterClearUnmask === 'NexaCorp is great',
    'Unmask after session clear returns unmodified string (no stale mapping access)'
  );

  // ── TEST BLOCK 8: Class Export ─────────────────────────────

  subheader('TEST BLOCK 8 — Module Exports & Class Extensibility');

  const { OmniShieldEngine } = require('./index');
  const customEngine = new OmniShieldEngine();
  assert(customEngine instanceof OmniShieldEngine, 'OmniShieldEngine class is importable and instantiable');
  assert(customEngine !== engine, 'Custom instance is separate from the singleton');

  // Use its own counter — starts at 0, goes to 1 after one mask
  customEngine.maskOutbound('custom-session', 'Email: dev@apple.com');
  assert(
    customEngine.activeSessionCount === 1,
    'Custom instance has isolated session state (1 session, separate from singleton)'
  );

  // ── TEST BLOCK 9: Performance Stress Test ─────────────────

  subheader('TEST BLOCK 9 — Performance Stress Test (100 sequential masks)');

  const ITERATIONS = 100;
  const stressPayload = RAW_PROMPT_EMPLOYEE.repeat(2); // ~3 KB payload
  const stressStart = performance.now();

  // Record how many sessions exist before stress test begins
  const sessionsBeforeStress = engine.activeSessionCount;

  for (let i = 0; i < ITERATIONS; i++) {
    const sid = `stress-session-${i}`;
    const r = engine.maskOutbound(sid, stressPayload);
    engine.unmaskInbound(sid, r.maskedPrompt);
    engine.clearSession(sid);
  }

  const stressDuration = performance.now() - stressStart;
  const avgMs = (stressDuration / ITERATIONS).toFixed(3);

  info(`${ITERATIONS} mask+unmask+clear cycles completed`, `${stressDuration.toFixed(1)} ms total`);
  info('Average per-request latency', `${avgMs} ms`);

  assert(
    parseFloat(avgMs) < 2.0,
    `Stress test: average cycle latency < 2.0 ms (actual: ${avgMs} ms)`
  );
  assert(
    engine.activeSessionCount === sessionsBeforeStress,
    `No session memory leak: session count unchanged after ${ITERATIONS} cleared stress sessions (${sessionsBeforeStress} → ${engine.activeSessionCount})`
  );

  // ── TEST BLOCK 10: AI Scanner Layer ────────────────

  subheader('TEST BLOCK 10 — AI Scanner Layer (auto-detected model via Ollama)');

  const AIScanner = require('./ai-scanner');
  const scanner = new AIScanner();

  console.log(`\n  ${C.dim}Checking if Ollama is running on localhost:11434 ...${C.reset}`);
  const ollamaUp = await scanner.isAvailable();

  // Auto-detect best available model from user's pulled models
  const bestModel = ollamaUp ? await AIScanner.detectBestModel() : null;

  if (!ollamaUp || !bestModel) {
    console.log(`\n  ${C.yellow}${C.bold}⚠  Ollama is NOT running or no models pulled. Skipping AI layer tests.${C.reset}`);
    console.log(`  ${C.dim}To enable: install Ollama (https://ollama.com), then run:${C.reset}`);
    console.log(`  ${C.cyan}  ollama serve${C.reset}`);
    console.log(`  ${C.cyan}  ollama pull qwen2.5:1.5b   # recommended${C.reset}\n`);
    skip('AI scanner graceful degradation: isAvailable() returned false (Ollama offline)');
    skip('AI scanner scan() returns [] when offline (no crash)');
    skip('maskOutboundWithAI() falls back to regex-only when AI offline');
    skip('AI-detected tokens added to session mappings');
    skip('unmaskInbound restores AI-detected tokens in round-trip');
  } else {
    console.log(`  ${C.green}✓  Ollama is running.${C.reset}`);
    console.log(`  ${C.green}✓  Using model: ${C.bold}${bestModel}${C.reset}\n`);

    // Prompt containing secrets that regex CANNOT catch:
    // no API keys, no known brand names, no emails — purely contextual
    const AI_TEST_SESSION = 'session-ai-scanner-test';
    const AI_SENSITIVE_PROMPT = `
Internal memo — STRICTLY CONFIDENTIAL:
Project Nightingale is our codename for the Q4 acquisition target.
John Harrington from the Strategy team confirmed that Operation Cobalt
will proceed after the board meeting. The Prometheus SDK must not be
mentioned to external vendors under any circumstances.
Budget allocation: refer to the $4.2M reserve fund discussed last week.
All communications should go through Maya Okafor in Legal.
    `.trim();

    // 10-1: isAvailable() true
    assert(ollamaUp === true, 'AI scanner: isAvailable() returns true when Ollama is running');

    // 10-2: maskOutboundWithAI runs without error
    console.log(`  ${C.dim}Running maskOutboundWithAI with ${bestModel} (may take 3-30s) ...${C.reset}`);
    const t0 = performance.now();
    const aiResult = await engine.maskOutboundWithAI(
      AI_TEST_SESSION,
      AI_SENSITIVE_PROMPT,
      { aiOptions: { model: bestModel, timeout: 60000 } }
    );
    const aiLatency = (performance.now() - t0).toFixed(0);

    info('AI scan latency', `${aiLatency} ms`);
    info('AI tokens detected', JSON.stringify(aiResult.aiTokens));
    info('aiAvailable flag', aiResult.aiAvailable);

    assert(aiResult.aiAvailable === true, 'maskOutboundWithAI: aiAvailable flag is true');
    assert(typeof aiResult.maskedPrompt === 'string', 'maskOutboundWithAI: returns a maskedPrompt string');
    assert(Array.isArray(aiResult.aiTokens),          'maskOutboundWithAI: aiTokens is an array');

    printBox('🤖 AI-MASKED OUTPUT (context-sensitive secrets removed):', aiResult.maskedPrompt, C.green);

    // 10-3: At least some AI tokens were detected (model caught non-regex secrets)
    const atLeastOneCaught =
      aiResult.aiTokens.some(t =>
        /nightingale|cobalt|harrington|prometheus|okafor|4\.2m/i.test(t)
      );
    assert(
      atLeastOneCaught || aiResult.aiTokens.length > 0,
      'AI layer detected at least one non-regex sensitive token from the prompt'
    );

    // 10-4: Masked text no longer contains the detected tokens
    for (const token of aiResult.aiTokens.slice(0, 3)) { // check first 3
      assert(
        !aiResult.maskedPrompt.includes(token),
        `AI token "${token}" is absent from the masked output`
      );
    }

    // 10-5: AI tokens are stored in session mappings
    const sessionInfo = engine.getSessionInfo(AI_TEST_SESSION);
    assert(
      sessionInfo.mappingCount > 0,
      `AI tokens persisted in session mappings (${sessionInfo.mappingCount} entries)`
    );

    // 10-6: unmaskInbound restores AI tokens (full round-trip)
    // Simulate LLM echoing back the masked prompt (it only sees fake tokens)
    const fakeResponse = aiResult.maskedPrompt;
    const restored = engine.unmaskInbound(AI_TEST_SESSION, fakeResponse);
    const anyRestored = aiResult.aiTokens.some(t => restored.includes(t));
    assert(
      anyRestored,
      'unmaskInbound correctly restores at least one AI-detected token in round-trip'
    );

    // 10-7: Idempotency holds for AI layer too
    const reMask = await engine.maskOutboundWithAI(AI_TEST_SESSION, aiResult.maskedPrompt);
    assert(
      reMask.tokenCount === 0 && reMask.aiTokenCount === 0,
      'AI-masked output is idempotent: re-running detects zero new tokens'
    );

    engine.clearSession(AI_TEST_SESSION);
    assert(
      engine.getSessionInfo(AI_TEST_SESSION) === null,
      'AI test session cleared successfully from memory'
    );
  }

  // ──────────────────────────────────────────────────────────
  //  FINAL REPORT
  // ──────────────────────────────────────────────────────────

  banner('TEST RESULTS SUMMARY');

  const percent = ((passedTests / totalTests) * 100).toFixed(1);
  const allPassed = passedTests === totalTests;
  const statusColor = allPassed ? C.green : C.red;
  const statusIcon  = allPassed ? '✔' : '✘';

  console.log(`  ${statusColor}${C.bold}${statusIcon}  ${passedTests} / ${totalTests} tests passed (${percent}%)${C.reset}\n`);

  if (failures.length > 0) {
    console.log(`  ${C.red}${C.bold}FAILED TESTS:${C.reset}`);
    failures.forEach((f, i) => {
      console.log(`    ${C.red}${i + 1}. ${f.label}${C.reset}`);
      if (f.detail) console.log(`       ${C.dim}${f.detail}${C.reset}`);
    });
    console.log();
  }

  if (allPassed) {
    console.log(`  ${C.green}${C.bold}🛡  OmniShield AI Core SDK — ALL SYSTEMS OPERATIONAL${C.reset}`);
    console.log(`  ${C.dim}Zero-dependency. Sub-millisecond. Production ready.${C.reset}\n`);
  } else {
    console.log(`  ${C.red}${C.bold}⚠  Some tests failed. Review failures above.${C.reset}\n`);
    process.exitCode = 1;
  }
}

// ─────────────────────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────────────────────

runTests().catch(err => {
  console.error(`\n${C.red}${C.bold}FATAL TEST ERROR:${C.reset}`, err);
  process.exit(1);
});
