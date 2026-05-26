/**
 * ============================================================
 *  OmniShield AI — Component 2: AST Parser & Structural Lexer
 *  File: astParser.js
 * ============================================================
 */

'use strict';

const acorn = require('acorn');

/**
 * tokenizeJavaScript - Parses JavaScript using Acorn and flattens it into
 * a highly normalized structural array of AST Node types, omitting variable names and values.
 * 
 * @param {string} code JavaScript source code.
 * @returns {Array<string>} Normalized AST node type sequence.
 */
function tokenizeJavaScript(code) {
    try {
        // Parse the code using Acorn. ecmaVersion is set to latest.
        const ast = acorn.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true,
            allowHashBang: true
        });

        const nodeTypes = [];

        // Recursive tree walker to flatten node structures
        function walk(node) {
            if (!node || typeof node !== 'object') return;

            if (node.type) {
                nodeTypes.push(node.type);
            }

            // Traverse all children properties
            for (const key in node) {
                if (Object.prototype.hasOwnProperty.call(node, key)) {
                    const value = node[key];
                    if (Array.isArray(value)) {
                        value.forEach(child => walk(child));
                    } else if (value && typeof value === 'object' && value.type) {
                        walk(value);
                    }
                }
            }
        }

        walk(ast);
        return nodeTypes;
    } catch (err) {
        // Fall back gracefully if Acorn fails due to syntax errors in partial/incomplete LLM responses
        return null;
    }
}

/**
 * tokenizeGeneric - Fast, regex-driven structural lexer for multi-language matching
 * (Python, Go, C++, Java, or broken JavaScript snippets).
 * 
 * Strips comments, strings, and variable naming, mapping statements to structural markers.
 * 
 * @param {string} code Source code.
 * @returns {Array<string>} Structured signature sequence.
 */
function tokenizeGeneric(code) {
    if (!code || typeof code !== 'string') {
        return [];
    }

    let clean = code;

    // 1. Strip multi-line comments: /* ... */ or ''' ... ''' or """ ... """
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');
    clean = clean.replace(/'''[\s\S]*?'''/g, '');
    clean = clean.replace(/"""[\s\S]*?"""/g, '');

    // 2. Strip single-line comments: // ... or # ...
    clean = clean.replace(/\/\/.*/g, '');
    clean = clean.replace(/#.*/g, '');

    // 3. Replace all string literals with generic token
    clean = clean.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, 'TOKEN_STRING');

    // 4. Normalize logical operators and numeric constants to avoid parser splitting edge cases
    clean = clean.replace(/&&/g, ' OPERATOR_LOGIC ');
    clean = clean.replace(/\|\|/g, ' OPERATOR_LOGIC ');
    clean = clean.replace(/\b\d+\b/g, ' IDENTIFIER ');

    // 5. Define keyword maps
    const keywordMap = {
        'if': 'KEYWORD_IF',
        'else': 'KEYWORD_ELSE',
        'elif': 'KEYWORD_ELSE',
        'for': 'KEYWORD_FOR',
        'while': 'KEYWORD_WHILE',
        'return': 'KEYWORD_RETURN',
        'def': 'KEYWORD_DEF',
        'func': 'KEYWORD_DEF',
        'function': 'KEYWORD_DEF',
        'class': 'KEYWORD_CLASS',
        'import': 'KEYWORD_IMPORT',
        'include': 'KEYWORD_IMPORT',
        'require': 'KEYWORD_IMPORT',
        'try': 'KEYWORD_TRY',
        'catch': 'KEYWORD_CATCH',
        'except': 'KEYWORD_CATCH',
        'throw': 'KEYWORD_THROW',
        'const': 'KEYWORD_VAR',
        'let': 'KEYWORD_VAR',
        'var': 'KEYWORD_VAR'
    };

    // 5. Tokenize structure
    const words = clean.split(/(\s+|\b|[{}()\[\]+\-*/=<>!&|;,])/g);
    const tokens = [];

    words.forEach(word => {
        const trimmed = word.trim();
        if (!trimmed) return;

        // Check if keyword
        if (keywordMap[trimmed]) {
            tokens.push(keywordMap[trimmed]);
            return;
        }

        // Structural operator mapping
        switch (trimmed) {
            case '{': tokens.push('BLOCK_START'); break;
            case '}': tokens.push('BLOCK_END'); break;
            case '(': tokens.push('PAREN_START'); break;
            case ')': tokens.push('PAREN_END'); break;
            case '[': tokens.push('BRACKET_START'); break;
            case ']': tokens.push('BRACKET_END'); break;
            case '+':
            case '-':
            case '*':
            case '/':
                tokens.push('OPERATOR_MATH');
                break;
            case '=':
            case '==':
            case '===':
                tokens.push('OPERATOR_ASSIGN');
                break;
            case '<':
            case '>':
            case '<=':
            case '>=':
            case '!=':
                tokens.push('OPERATOR_COMPARE');
                break;
            case '&&':
            case '||':
            case '!':
            case 'OPERATOR_LOGIC':
                tokens.push('OPERATOR_LOGIC');
                break;
            case ';':
                tokens.push('SEMICOLON');
                break;
            default:
                // If it is a generic word (variable/function name), map it to IDENTIFIER
                if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
                    if (trimmed !== 'TOKEN_STRING') {
                        tokens.push('IDENTIFIER');
                    } else {
                        tokens.push('STRING');
                    }
                }
        }
    });

    return tokens;
}

/**
 * parseCodeSignature - High-level orchestrator. Analyzes the block language and returns
 * a normalized token signature array.
 * 
 * @param {string} code Source code snippet.
 * @param {string} language Code block language type.
 * @returns {Array<string>} Structural signature tokens.
 */
function parseCodeSignature(code, language) {
    if (!code) return [];

    const isJS = ['javascript', 'js', 'ecmascript', 'node', 'react'].includes(language);

    if (isJS) {
        const jsAST = tokenizeJavaScript(code);
        if (jsAST && jsAST.length > 0) {
            return jsAST;
        }
    }

    // Fall back to general lexical parser
    return tokenizeGeneric(code);
}

module.exports = {
    tokenizeJavaScript,
    tokenizeGeneric,
    parseCodeSignature
};
