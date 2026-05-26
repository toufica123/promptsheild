/**
 * ============================================================
 *  OmniShield AI — Component 3: License Signature Matcher
 *  File: licenseMatcher.js
 * ============================================================
 */

'use strict';

const { parseCodeSignature } = require('./astParser');

// Database of copyleft structural signatures
// Derived from parsing standard copyleft library implementations
const COPYLEFT_SIGNATURES = [
    {
        name: 'GPLv3 Boilerplate Block',
        license: 'GPL-3.0',
        bigramSignature: [
            'KEYWORD_IMPORT__IDENTIFIER',
            'IDENTIFIER__KEYWORD_DEF',
            'KEYWORD_DEF__PAREN_START',
            'PAREN_START__PAREN_END',
            'PAREN_END__BLOCK_START',
            'BLOCK_START__KEYWORD_TRY',
            'KEYWORD_TRY__BLOCK_START',
            'BLOCK_START__KEYWORD_RETURN',
            'KEYWORD_RETURN__IDENTIFIER',
            'IDENTIFIER__BLOCK_END',
            'BLOCK_END__KEYWORD_CATCH',
            'KEYWORD_CATCH__PAREN_START',
            'PAREN_START__IDENTIFIER',
            'IDENTIFIER__PAREN_END',
            'PAREN_END__BLOCK_START',
            'BLOCK_START__KEYWORD_THROW',
            'KEYWORD_THROW__IDENTIFIER',
            'IDENTIFIER__BLOCK_END',
            'BLOCK_END__BLOCK_END'
        ]
    },
    {
        name: 'GPL Linux Scheduler Sequence',
        license: 'GPL-2.0',
        bigramSignature: [
            'KEYWORD_DEF__IDENTIFIER',
            'IDENTIFIER__PAREN_START',
            'PAREN_START__PAREN_END',
            'PAREN_END__BLOCK_START',
            'BLOCK_START__KEYWORD_VAR',
            'KEYWORD_VAR__IDENTIFIER',
            'IDENTIFIER__OPERATOR_ASSIGN',
            'OPERATOR_ASSIGN__IDENTIFIER',
            'IDENTIFIER__KEYWORD_WHILE',
            'KEYWORD_WHILE__PAREN_START',
            'PAREN_START__IDENTIFIER',
            'IDENTIFIER__OPERATOR_COMPARE',
            'OPERATOR_COMPARE__IDENTIFIER',
            'IDENTIFIER__PAREN_END',
            'PAREN_END__BLOCK_START',
            'BLOCK_START__KEYWORD_IF',
            'KEYWORD_IF__PAREN_START',
            'PAREN_START__IDENTIFIER',
            'IDENTIFIER__OPERATOR_LOGIC',
            'OPERATOR_LOGIC__IDENTIFIER',
            'IDENTIFIER__PAREN_END',
            'PAREN_END__BLOCK_START',
            'BLOCK_START__KEYWORD_RETURN',
            'KEYWORD_RETURN__IDENTIFIER',
            'IDENTIFIER__BLOCK_END',
            'BLOCK_END__BLOCK_END'
        ]
    }
];

/**
 * getBigrams - Computes sequential bigrams from a list of tokens.
 * 
 * @param {Array<string>} tokens Structural signature tokens.
 * @returns {Set<string>} Set of token bigrams.
 */
function getBigrams(tokens) {
    const bigrams = new Set();
    if (!tokens || tokens.length < 2) return bigrams;

    for (let i = 0; i < tokens.length - 1; i++) {
        bigrams.add(`${tokens[i]}__${tokens[i + 1]}`);
    }
    return bigrams;
}

/**
 * calculateJaccardSimilarity - Computes structural similarity ratio.
 * 
 * @param {Set<string>} setA Bigrams set A.
 * @param {Set<string>} setB Bigrams set B.
 * @returns {number} Ratio between 0.0 and 1.0.
 */
function calculateJaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
}

/**
 * checkTextualLicensing - High-performance regex check for explicit licensing banners in comments.
 * 
 * @param {string} code Source code snippet.
 * @returns {Object|null} Match metadata or null if clean.
 */
function checkTextualLicensing(code) {
    if (!code || typeof code !== 'string') return null;

    const copyleftRegexes = [
        {
            pattern: /GNU\s+General\s+Public\s+License/i,
            license: 'GPL'
        },
        {
            pattern: /GNU\s+Affero\s+General\s+Public\s+License/i,
            license: 'AGPL'
        },
        {
            pattern: /GNU\s+Lesser\s+General\s+Public\s+License/i,
            license: 'LGPL'
        },
        {
            pattern: /SPDX-License-Identifier:\s*(GPL|AGPL|LGPL)/i,
            license: 'GPL/AGPL/LGPL (SPDX)'
        },
        {
            pattern: /This\s+program\s+is\s+free\s+software:\s+you\s+can\s+redistribute\s+it/i,
            license: 'GPL (Standard Boilerplate)'
        }
    ];

    for (const item of copyleftRegexes) {
        if (item.pattern.test(code)) {
            return {
                matched: true,
                license: item.license,
                method: 'textual_header',
                similarity: 1.0
            };
        }
    }

    return null;
}

/**
 * analyzeLicenseRisk - Audits code blocks for copyleft compliance.
 * 
 * @param {string} code Raw code snippet.
 * @param {string} language Programming language specifier.
 * @param {number} threshold Target matching score (0.0 to 1.0, e.g. 0.75).
 * @returns {Object} Audit outcome.
 */
function analyzeLicenseRisk(code, language, threshold = 0.75) {
    if (!code) {
        return { matched: false, reason: 'Empty code snippet' };
    }

    // 1. First Pass: Check textual notices in header comments
    const textNotice = checkTextualLicensing(code);
    if (textNotice) {
        return {
            matched: true,
            license: textNotice.license,
            similarity: textNotice.similarity,
            method: textNotice.method,
            reason: `Detected explicit copyleft header notice: "${textNotice.license}"`
        };
    }

    // 2. Second Pass: Parse tokens and match structure
    const parsedTokens = parseCodeSignature(code, language);
    if (parsedTokens.length < 5) {
        return { matched: false, reason: 'Snippet too short for structural signature scan' };
    }

    const inputBigrams = getBigrams(parsedTokens);

    let bestMatch = null;
    let maxSimilarity = 0.0;

    for (const signature of COPYLEFT_SIGNATURES) {
        const signatureBigrams = new Set(signature.bigramSignature);
        const score = calculateJaccardSimilarity(inputBigrams, signatureBigrams);

        if (score > maxSimilarity) {
            maxSimilarity = score;
            bestMatch = {
                license: signature.license,
                name: signature.name,
                similarity: parseFloat(score.toFixed(3))
            };
        }
    }

    if (bestMatch && maxSimilarity >= threshold) {
        return {
            matched: true,
            license: bestMatch.license,
            similarity: bestMatch.similarity,
            method: 'ast_structure',
            reason: `AST Structural match against "${bestMatch.name}" exceeding threshold (${(maxSimilarity * 100).toFixed(1)}% >= ${(threshold * 100).toFixed(0)}%)`
        };
    }

    return {
        matched: false,
        bestMatchScore: maxSimilarity,
        reason: 'No copyleft signatures exceeded compliance threshold'
    };
}

module.exports = {
    getBigrams,
    calculateJaccardSimilarity,
    checkTextualLicensing,
    analyzeLicenseRisk,
    COPYLEFT_SIGNATURES
};
