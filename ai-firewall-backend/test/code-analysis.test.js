/**
 * ============================================================
 *  OmniShield AI — Code Analysis Integration Test Suite
 *  File: test/code-analysis.test.js
 * 
 *  Run with:  node test/code-analysis.test.js
 * ============================================================
 */

'use strict';

const assert = require('node:assert');
const { extractCodeBlocks, stripMarkdown } = require('../services/codeAnalysis/textExtractor');
const { tokenizeJavaScript, tokenizeGeneric, parseCodeSignature } = require('../services/codeAnalysis/astParser');
const { getBigrams, calculateJaccardSimilarity, checkTextualLicensing, analyzeLicenseRisk } = require('../services/codeAnalysis/licenseMatcher');

// ANSI Terminal Colors for Premium visual display
const C = {
    reset:   '\x1b[0m',
    bold:    '\x1b[1m',
    dim:     '\x1b[2m',
    red:     '\x1b[31m',
    green:   '\x1b[32m',
    yellow:  '\x1b[33m',
    blue:    '\x1b[34m',
    cyan:    '\x1b[36m',
    bgGreen: '\x1b[42m',
    bgRed:   '\x1b[41m'
};

function header(text) {
    console.log(`\n${C.cyan}${C.bold}═══ ${text} ═══${C.reset}\n`);
}

function subheader(text) {
    console.log(`\n${C.yellow}${C.bold}▶  ${text}${C.reset}`);
    console.log(`${C.dim}────────────────────────────────────────────────────────────${C.reset}`);
}

function pass(label) {
    console.log(`  ${C.bgGreen}${C.bold} PASS ${C.reset} ${C.green}${label}${C.reset}`);
}

function fail(label, error) {
    console.log(`  ${C.bgRed}${C.bold} FAIL ${C.reset} ${C.red}${label}${C.reset}`);
    if (error) console.error(`         ${C.dim}${error.stack || error}${C.reset}`);
}

async function runTests() {
    header('OMNISHIELD AI — EXTRACTION & AST CODE ANALYSIS SUITE');
    let passCount = 0;
    let failCount = 0;

    // Helper assertion tracker
    function runAssert(label, fn) {
        try {
            fn();
            pass(label);
            passCount++;
        } catch (err) {
            fail(label, err);
            failCount++;
        }
    }

    // ───────────────────────────────────────────────────────────
    // BLOCK 1: Text & Markdown Extraction
    // ───────────────────────────────────────────────────────────
    subheader('BLOCK 1: Markdown Cleaning & Code Block Isolation');

    runAssert('extractCodeBlocks correctly parses multiple code blocks and identifies language', () => {
        const payload = `
Some text describing the project.
\`\`\`javascript
const a = 12;
function process() { return a * 2; }
\`\`\`
Here is some trailing text.
\`\`\`python
def execute():
    print("Executing code")
\`\`\`
        `;
        const blocks = extractCodeBlocks(payload);
        assert.strictEqual(blocks.length, 2, 'Should isolate exactly two code blocks');
        
        assert.strictEqual(blocks[0].language, 'javascript');
        assert(blocks[0].code.includes('const a = 12'), 'Should contain JS code contents');
        assert.strictEqual(blocks[0].startLine, 3);
        assert.strictEqual(blocks[0].endLine, 6);

        assert.strictEqual(blocks[1].language, 'python');
        assert(blocks[1].code.includes('print("Executing code")'), 'Should contain python code contents');
        assert.strictEqual(blocks[1].startLine, 8);
        assert.strictEqual(blocks[1].endLine, 11);
    });

    runAssert('stripMarkdown removes headers, links, and bold elements, preserving raw text', () => {
        const markdown = `
# Project Main Header
Here is some **bold text** and *italics*.
Check out [Samsung portal](https://samsung.com) for details.
> Bullet point alert:
- Bullet item 1
- Bullet item 2
        `;
        const cleanText = stripMarkdown(markdown);
        assert(!cleanText.includes('#'), 'Should strip header hash tags');
        assert(!cleanText.includes('**'), 'Should strip bold markers');
        assert(!cleanText.includes('[Samsung portal]'), 'Should format links cleanly');
        assert(cleanText.includes('Samsung portal'), 'Link descriptive text must remain');
        assert(!cleanText.includes('- Bullet'), 'Should clean list bullets');
        assert(cleanText.includes('Bullet item 1'), 'Item content must remain');
    });

    // ───────────────────────────────────────────────────────────
    // BLOCK 2: AST Code Parsing & Token Normalization
    // ───────────────────────────────────────────────────────────
    subheader('BLOCK 2: AST Node Parsing & Lexical Normalization');

    runAssert('tokenizeJavaScript parses valid ES6 and returns flattened Node Types', () => {
        const jsCode = `
            import { api } from 'groq';
            const rate = 0.85;
            function calculateTotal(amount) {
                return amount * rate;
            }
        `;
        const tokens = tokenizeJavaScript(jsCode);
        assert(tokens && tokens.length > 0, 'Should compile token array');
        assert(tokens.includes('Program'), 'Should include Program root');
        assert(tokens.includes('ImportDeclaration'), 'Should parse ImportDeclaration node');
        assert(tokens.includes('VariableDeclaration'), 'Should parse VariableDeclaration node');
        assert(tokens.includes('FunctionDeclaration'), 'Should parse FunctionDeclaration node');
        assert(tokens.includes('ReturnStatement'), 'Should parse ReturnStatement node');
    });

    runAssert('tokenizeJavaScript returns null on syntax errors rather than crashing (Self-Healing)', () => {
        const brokenCode = `
            const a = [1, 2, ; // invalid syntax
            function incomplete( {
        `;
        const tokens = tokenizeJavaScript(brokenCode);
        assert.strictEqual(tokens, null, 'Should handle broken syntax safely by returning null');
    });

    runAssert('tokenizeGeneric tokenizes Python code, stripping comments and naming properties', () => {
        const pythonCode = `
            # Define basic calculate operation
            def calculate_cost(quantity, price):
                total = quantity * price # trailing comment
                return total
        `;
        const tokens = tokenizeGeneric(pythonCode);
        assert(tokens.length > 0, 'Generic token sequence should compile');
        assert.strictEqual(tokens[0], 'KEYWORD_DEF', 'Should detect Python def keyword');
        assert.strictEqual(tokens[1], 'IDENTIFIER', 'Should map calculate_cost to IDENTIFIER');
        assert(tokens.includes('KEYWORD_RETURN'), 'Should identify Python return statement');
        assert(!tokens.includes('#'), 'Should strip comment tokens');
    });

    // ───────────────────────────────────────────────────────────
    // BLOCK 3: Bigrams & Jaccard Calculation
    // ───────────────────────────────────────────────────────────
    subheader('BLOCK 3: N-Gram Extraction & Jaccard Distance Alignment');

    runAssert('getBigrams correctly compiles bigrams from structural array', () => {
        const tokens = ['A', 'B', 'C', 'D'];
        const bigrams = getBigrams(tokens);
        assert.strictEqual(bigrams.size, 3, 'Should produce exactly 3 bigram sequences');
        assert(bigrams.has('A__B'));
        assert(bigrams.has('B__C'));
        assert(bigrams.has('C__D'));
    });

    runAssert('calculateJaccardSimilarity measures overlap correctly (Intersection / Union)', () => {
        const setA = new Set(['x', 'y', 'z']);
        const setB = new Set(['y', 'z', 'w']);
        
        // Intersection: {y, z} (size 2)
        // Union: {x, y, z, w} (size 4)
        // Jaccard: 2 / 4 = 0.50
        const similarity = calculateJaccardSimilarity(setA, setB);
        assert.strictEqual(similarity, 0.50, 'Jaccard similarity should compute precisely');
    });

    // ───────────────────────────────────────────────────────────
    // BLOCK 4: Compliance Auditing & License Risk Scoring
    // ───────────────────────────────────────────────────────────
    subheader('BLOCK 4: Compliance Checking & License Risk Matching');

    runAssert('checkTextualLicensing identifies explicit GPL and AGPL SPDX comments', () => {
        const codeGPL = `
            /*
             * SPDX-License-Identifier: GPL-3.0-or-later
             * Contact: security@internal-samsung.com
             */
            console.log("Kernel operational");
        `;
        const check = checkTextualLicensing(codeGPL);
        assert(check && check.matched, 'Should match copyleft header');
        assert.strictEqual(check.license, 'GPL/AGPL/LGPL (SPDX)');
        assert.strictEqual(check.similarity, 1.0);
    });

    runAssert('analyzeLicenseRisk flags structural similarity matching standard copyleft signatures', () => {
        // Matches the GPL Linux Scheduler Sequence signature tokens
        const mockGPLCode = `
            function scheduleTask() {
                var task = pop();
                while (task > 0) {
                    if (task && nextTask) {
                        return task;
                    }
                }
            }
        `;
        const audit = analyzeLicenseRisk(mockGPLCode, 'cpp', 0.70);
        assert(audit.matched, 'Structural signature match should flag copyleft risk');
        assert.strictEqual(audit.license, 'GPL-2.0');
        assert(audit.similarity >= 0.70);
        assert(audit.reason.includes('AST Structural match'), 'Should explain the analysis match');
    });

    runAssert('analyzeLicenseRisk clears clean non-copyleft code snippets without matching', () => {
        const safeCode = `
            // Standard benign utility
            const numbers = [1, 2, 3];
            const doubled = numbers.map(x => x * 2);
            console.log(doubled);
        `;
        const audit = analyzeLicenseRisk(safeCode, 'javascript', 0.75);
        assert(!audit.matched, 'Benign standard code should not trigger flags');
        assert(audit.bestMatchScore < 0.50, 'Similarity score should be extremely low');
    });

    // ───────────────────────────────────────────────────────────
    // OVERALL OUTCOME SUMMARY
    // ───────────────────────────────────────────────────────────
    console.log(`\n${C.cyan}${C.bold}═════════════════════════════════════════════════════════════${C.reset}\n`);
    
    console.log(`${C.bold}╔════════════════════════╗${C.reset}`);
    console.log(`${C.bold}║  TEST RESULTS SUMMARY  ║${C.reset}`);
    console.log(`${C.bold}╚════════════════════════╝${C.reset}\n`);

    const total = passCount + failCount;
    if (failCount === 0) {
        console.log(`  ${C.green}✔  ${passCount} / ${total} tests passed (100.0%)${C.reset}\n`);
        console.log(`  ${C.bgGreen}${C.bold}  🛡  OMNISHIELD CODE ANALYSER — ALL SYSTEMS OPERATIONAL  ${C.reset}\n`);
    } else {
        console.log(`  ${C.red}✖  ${failCount} / ${total} tests failed.${C.reset}\n`);
        process.exit(1);
    }
}

runTests();
