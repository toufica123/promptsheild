/**
 * ============================================================
 *  OmniShield AI — Core Masking & Tokenization Service
 *  Wraps the high-performance omnishield-core-sdk.
 * ============================================================
 */

'use strict';

const path = require('node:path');

// Dynamically resolve and import the local OmniShield SDK singleton
let engine;
try {
    engine = require('../../sdk_module/omnishield-core-sdk/index');
} catch (err) {
    console.error('Failed to load omnishield-core-sdk. Falling back to basic regex replacement.', err);
}

/**
 * maskSensitiveData - Bi-directional Outbound Data Redactor.
 * Combines Layer 1 pre-compiled Master Regex with Layer 2 local cognitive AI.
 * 
 * @param {string} sessionId Unique tracking identifier for session/user isolation.
 * @param {string} prompt Raw prompt to be redacted.
 * @returns {Promise<string>} Fully obfuscated prompt.
 */
async function maskSensitiveData(sessionId, prompt) {
    if (!prompt) return '';
    if (!sessionId) sessionId = 'default-global-session';

    if (!engine) {
        // Fallback to basic replacements if the SDK is missing
        let sanitized = prompt;
        sanitized = sanitized.replace(/\S+@\S+\.\S+/g, '[Email masked]');
        sanitized = sanitized.replace(/\b\d{10}\b/g, '[Phone masked]');
        sanitized = sanitized.replace(/password/gi, '[Password masked]');
        return sanitized;
    }

    try {
        const result = await engine.maskOutboundWithAI(sessionId, prompt);
        return result.maskedPrompt;
    } catch (err) {
        console.error('Error during SDK maskOutboundWithAI, falling back to sync regex engine...', err);
        try {
            const syncResult = engine.maskOutbound(sessionId, prompt);
            return syncResult.maskedPrompt;
        } catch (syncErr) {
            console.error('Fatal: All masking layers failed. Returning safe placeholder.', syncErr);
            return '[OmniShield Block: System Obfuscation Error]';
        }
    }
}

/**
 * unmaskSensitiveData - Inbound original token restoration.
 * O(k*n) substitution mapping recovery.
 * 
 * @param {string} sessionId Unique tracking identifier.
 * @param {string} response Sanitized response from the LLM model.
 * @returns {string} Reconstructed text with real values safely restored.
 */
function unmaskSensitiveData(sessionId, response) {
    if (!response) return '';
    if (!sessionId) sessionId = 'default-global-session';

    if (!engine) {
        return response; // No reverse mapping possible on basic fallback
    }

    try {
        return engine.unmaskInbound(sessionId, response);
    } catch (err) {
        console.error('Error restoring values in unmaskInbound:', err);
        return response;
    }
}

/**
 * clearSession - Cleanup session state from memory.
 * 
 * @param {string} sessionId Unique tracking identifier.
 * @returns {boolean}
 */
function clearSession(sessionId) {
    if (engine && sessionId) {
        return engine.clearSession(sessionId);
    }
    return false;
}

module.exports = {
    maskSensitiveData,
    unmaskSensitiveData,
    clearSession,
    engine
};
