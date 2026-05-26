/**
 * ============================================================
 *  OmniShield AI — Component 1: Text & Code Extraction
 *  File: textExtractor.js
 * ============================================================
 */

'use strict';

/**
 * extractCodeBlocks - Extracts all code blocks bounded by triple backticks (```).
 * 
 * @param {string} text Raw markdown or mixed-format input string.
 * @returns {Array<Object>} Isolated code block objects with metadata.
 */
function extractCodeBlocks(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const blocks = [];
    // Match code blocks with optional language specifier, matching non-greedily
    const codeBlockRegex = /```([a-zA-Z0-9+#_-]*)\s*\n([\s\S]*?)\n```/g;
    
    let match;
    const lines = text.split('\n');

    while ((match = codeBlockRegex.exec(text)) !== null) {
        const lang = (match[1] || 'plaintext').trim().toLowerCase();
        const code = match[2];
        const matchIndex = match.index;

        // Calculate line offsets for debugging/offending lines reporting
        const textBeforeMatch = text.slice(0, matchIndex);
        const startLine = textBeforeMatch.split('\n').length;
        const blockLineCount = match[0].split('\n').length;
        const endLine = startLine + blockLineCount - 1;

        blocks.push({
            language: lang || 'plaintext',
            code: code.trim(),
            startLine,
            endLine
        });
    }

    return blocks;
}

/**
 * stripMarkdown - Removes standard markdown tags, returning pure raw text.
 * Helpful to isolate keywords and block inline clutter during lexical matching.
 * 
 * @param {string} text Mixed markdown prompt.
 * @returns {string} Pure plaintext.
 */
function stripMarkdown(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    let clean = text;

    // 1. Remove code blocks entirely to strip massive inline snippets
    clean = clean.replace(/```[\s\S]*?```/g, '');

    // 2. Remove inline code backticks `code`
    clean = clean.replace(/`([^`]+)`/g, '$1');

    // 3. Remove HTML/XML tags
    clean = clean.replace(/<[^>]*>/g, '');

    // 4. Remove bold & italic decorators: **text**, *text*, __text__, _text_
    clean = clean.replace(/(\*\*|__)(.*?)\1/g, '$2');
    clean = clean.replace(/(\*|_)(.*?)\1/g, '$2');

    // 5. Remove headers: # Header
    clean = clean.replace(/^#+\s+(.*?)$/gm, '$1');

    // 6. Remove markdown links: [text](url) -> text
    clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

    // 7. Remove blockquotes, bullet points, list numbers
    clean = clean.replace(/^\s*>\s+/gm, '');
    clean = clean.replace(/^\s*[-*+]\s+/gm, '');
    clean = clean.replace(/^\s*\d+\.\s+/gm, '');

    // 8. Clean up extra newlines and spacing
    clean = clean.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    return clean;
}

module.exports = {
    extractCodeBlocks,
    stripMarkdown
};
