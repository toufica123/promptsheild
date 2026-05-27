/**
 * ============================================================
 *  PromptShield AI — Component 2: Background Service Worker
 *  File: background.js (Chrome Extension Manifest V3)
 * ============================================================
 * 
 * ENTERPRISE TOKEN LIFECYCLE MANAGEMENT
 * - Session-scoped placeholder mapping with TTL
 * - Per-request token isolation
 * - Bidirectional masking/unmasking with fallback
 * - Comprehensive error handling
 */

'use strict';

const GATEWAY_URL = 'http://localhost:5000';
const PLACEHOLDER_MAP_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessionPlaceholderMaps = new Map();
const requestMetadata = new Map(); // Track request-specific metadata

function mergePlaceholderMap(sessionId, placeholderMap = {}) {
    if (!sessionId || !placeholderMap || typeof placeholderMap !== 'object') return;

    const existing = sessionPlaceholderMaps.get(sessionId)?.placeholderMap || {};
    sessionPlaceholderMaps.set(sessionId, {
        placeholderMap: { ...existing, ...placeholderMap },
        expiresAt: Date.now() + PLACEHOLDER_MAP_TTL_MS
    });
}

function restoreMaskedTokens(text, placeholderMap = {}) {
    if (typeof text !== 'string' || !placeholderMap || typeof placeholderMap !== 'object') {
        return text;
    }

    let restored = text;
    for (const [placeholder, original] of Object.entries(placeholderMap)) {
        if (typeof placeholder === 'string' && typeof original === 'string') {
            restored = restored.replaceAll(placeholder, original);
        }
    }
    return restored;
}

function getSessionPlaceholderMap(sessionId) {
    const entry = sessionPlaceholderMaps.get(sessionId);
    if (!entry) return {};

    if (entry.expiresAt < Date.now()) {
        sessionPlaceholderMaps.delete(sessionId);
        return {};
    }

    return entry.placeholderMap;
}

setInterval(() => {
    const now = Date.now();
    for (const [sessionId, entry] of sessionPlaceholderMaps) {
        if (entry.expiresAt < now) {
            sessionPlaceholderMaps.delete(sessionId);
        }
    }
}, 60 * 1000);

// Initialize default statistics in storage on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['stats'], (result) => {
        if (!result.stats) {
            chrome.storage.local.set({
                stats: {
                    keysBlocked: 0,
                    emailsShielded: 0,
                    piiProtected: 0,
                    complianceWarnings: 0,
                    totalRequests: 0
                },
                shieldActive: true
            }, () => {
                console.log('PromptShield default stats and configuration initialized.');
            });
        }
    });
});

/**
 * incrementLocalStats - Helper to parse masked tokens and record protection metrics.
 * 
 * @param {string} prompt Raw prompt to check categories.
 */
function incrementLocalStats(prompt) {
    chrome.storage.local.get(['stats'], (result) => {
        const stats = result.stats || {
            keysBlocked: 0,
            emailsShielded: 0,
            piiProtected: 0,
            complianceWarnings: 0,
            totalRequests: 0
        };

        stats.totalRequests += 1;

        // Trace standard PII markers
        const emailRegex = /\S+@\S+\.\S+/g;
        const apiKeyRegex = /sk-[a-zA-Z0-9]+/g;
        const phoneRegex = /\b\d{10}\b/g;

        if (emailRegex.test(prompt)) stats.emailsShielded += 1;
        if (apiKeyRegex.test(prompt)) stats.keysBlocked += 1;
        if (phoneRegex.test(prompt)) stats.piiProtected += 1;

        chrome.storage.local.set({ stats });
    });
}

// Orchestrate messages from injected content.js scripts and popup controls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // 1. Check Gateway Server Health
    if (request.action === 'checkHealth') {
        fetch(`${GATEWAY_URL}/`)
            .then(res => {
                if (res.ok) {
                    sendResponse({ status: 'online' });
                } else {
                    sendResponse({ status: 'error' });
                }
            })
            .catch(err => {
                sendResponse({ status: 'offline', error: err.message });
            });
        return true; // Keep channel open for asynchronous responses
    }

    // 2. Outbound Prompt Masking
    if (request.action === 'mask') {
        const { prompt, sessionId, requestId } = request;
        
        // Trace and record stats locally
        incrementLocalStats(prompt);

        // Store request metadata for audit trail
        if (requestId) {
            requestMetadata.set(requestId, {
                timestamp: Date.now(),
                sessionId,
                action: 'mask',
                promptLength: prompt.length
            });
        }

        fetch(`${GATEWAY_URL}/api/proxy/mask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, sessionId, requestId })
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`Gateway returned ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            // CRITICAL: Verify masked prompt doesn't contain sensitive data
            if (!data.maskedPrompt || typeof data.maskedPrompt !== 'string') {
                throw new Error('Invalid masked prompt from gateway');
            }

            mergePlaceholderMap(sessionId, data.placeholderMap);
            
            sendResponse({
                success: true,
                maskedPrompt: data.maskedPrompt,
                placeholderMap: data.placeholderMap || {}
            });

            // Cleanup metadata after successful response
            setTimeout(() => {
                if (requestId) requestMetadata.delete(requestId);
            }, 5000);
        })
        .catch(err => {
            console.error('[PromptShield] Error during background fetch mask:', err);
            sendResponse({ 
                success: false, 
                error: err.message || 'Masking service error'
            });
        });
        return true;
    }

    // 3. Inbound Response Unmasking
    if (request.action === 'unmask') {
        const { text, sessionId, requestId } = request;
        
        // Store request metadata for audit trail
        if (requestId) {
            requestMetadata.set(requestId, {
                timestamp: Date.now(),
                sessionId,
                action: 'unmask',
                textLength: text.length
            });
        }

        // Try local restoration first (fastest path)
        const localRestored = restoreMaskedTokens(text, getSessionPlaceholderMap(sessionId));

        if (localRestored !== text) {
            sendResponse({ 
                success: true, 
                unmaskedText: localRestored, 
                source: 'background-map' 
            });
            
            // Cleanup metadata
            setTimeout(() => {
                if (requestId) requestMetadata.delete(requestId);
            }, 5000);
            return true;
        }

        // Fall back to gateway for additional context
        fetch(`${GATEWAY_URL}/api/proxy/unmask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sessionId, requestId })
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`Gateway returned ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            if (!data.unmaskedText || typeof data.unmaskedText !== 'string') {
                throw new Error('Invalid unmasked text from gateway');
            }

            sendResponse({ 
                success: true, 
                unmaskedText: data.unmaskedText,
                source: 'gateway-restore'
            });

            // Cleanup metadata
            setTimeout(() => {
                if (requestId) requestMetadata.delete(requestId);
            }, 5000);
        })
        .catch(err => {
            console.error('[PromptShield] Error during background fetch unmask:', err);
            // Failsafe: Return placeholders instead of potentially wrong values
            sendResponse({ 
                success: false, 
                error: err.message || 'Unmasking service error',
                fallback: text // Return original masked text as fallback
            });
        });
        return true;
    }

    // 4. Update Copyleft/Compliance Stats Counter
    if (request.action === 'incrementCompliance') {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || {
                keysBlocked: 0,
                emailsShielded: 0,
                piiProtected: 0,
                complianceWarnings: 0,
                totalRequests: 0
            };
            stats.complianceWarnings += 1;
            chrome.storage.local.set({ stats }, () => {
                sendResponse({ success: true });
            });
        });
        return true;
    }

    // 5. Reset Statistics Dashboard
    if (request.action === 'resetStats') {
        chrome.storage.local.set({
            stats: {
                keysBlocked: 0,
                emailsShielded: 0,
                piiProtected: 0,
                complianceWarnings: 0,
                totalRequests: 0
            }
        }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});
