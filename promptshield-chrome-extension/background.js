/**
 * ============================================================
 *  PromptShield AI — Component 2: Background Service Worker
 *  File: background.js (Chrome Extension Manifest V3)
 * ============================================================
 */

'use strict';

const GATEWAY_URL = 'http://localhost:5000';

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
        const { prompt, sessionId } = request;
        
        // Trace and record stats locally
        incrementLocalStats(prompt);

        fetch(`${GATEWAY_URL}/api/proxy/mask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, sessionId })
        })
        .then(res => res.json())
        .then(data => {
            sendResponse({ success: true, maskedPrompt: data.maskedPrompt });
        })
        .catch(err => {
            console.error('Error during background fetch mask:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    // 3. Inbound Response Unmasking
    if (request.action === 'unmask') {
        const { text, sessionId } = request;

        fetch(`${GATEWAY_URL}/api/proxy/unmask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sessionId })
        })
        .then(res => res.json())
        .then(data => {
            sendResponse({ success: true, unmaskedText: data.unmaskedText });
        })
        .catch(err => {
            console.error('Error during background fetch unmask:', err);
            sendResponse({ success: false, error: err.message });
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
