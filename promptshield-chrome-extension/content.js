/**
 * ============================================================
 *  PromptShield AI — Component 3: Injected Content Script
 *  File: content.js (Chrome Extension Manifest V3)
 * ============================================================
 * 
 * ENTERPRISE TOKEN LIFECYCLE PIPELINE
 * - Deterministic masking/unmasking with state tracking
 * - Per-request token isolation and cleanup
 * - Idempotent restoration with failsafe protection
 * - Comprehensive audit trail and debugging
 */

'use strict';

// Shared Session ID for browser tab context. Keep it stable across content
// script reinjections so backend placeholder mappings remain usable.
function getStableSessionTabId() {
    const key = 'promptshieldSessionTabId';

    try {
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;

        const created = 'chrome-tab-' + crypto.randomUUID();
        sessionStorage.setItem(key, created);
        return created;
    } catch (err) {
        return 'chrome-tab-' + Math.floor(Math.random() * 100000);
    }
}

const sessionTabId = getStableSessionTabId();
console.log(`[PromptShield] ✅ Content script loaded in tab. Session ID: ${sessionTabId}`);
console.log('[PromptShield] 🛡️ Enterprise token pipeline initializing...');

// ─────────────────────────────────────────────────────────────
// ENTERPRISE TOKEN PIPELINE INITIALIZATION
// ─────────────────────────────────────────────────────────────

const RAW_SECRET_PATTERNS = [
    /\bAIzaSy[A-Za-z0-9_-]{20,}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/,
    /\bsk-ant-api\d{2}-[A-Za-z0-9_-]{20,}\b/,
    /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/,
    /\bomni-gcp-[A-Za-z0-9_-]{6,}\b/
];

let tokenPipeline = null;
try {
    tokenPipeline = new TokenPipeline(RAW_SECRET_PATTERNS);
    console.log('[PromptShield] ✅ Enterprise token pipeline initialized');
} catch (err) {
    console.error('[PromptShield] ❌ Failed to initialize token pipeline:', err);
    console.log('[PromptShield] ⚠️  Extension will continue with fallback protection');
}

const SHIELD_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#F5C518" stroke-width="2" stroke-linejoin="round" fill="rgba(245,197,24,0.15)"/>
  <path d="M9 12L11 14L15 10" stroke="#F5C518" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const SHIELD_SVG_LOADING = `
<svg class="ps-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: ps-rotate 1s linear infinite;">
  <circle cx="12" cy="12" r="10" stroke="rgba(245,197,24,0.2)" stroke-width="3"/>
  <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="#F5C518" stroke-width="3" stroke-linecap="round"/>
</svg>
<style>
@keyframes ps-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
`;

const SHIELD_SVG_SUCCESS = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#16a34a" stroke-width="2" stroke-linejoin="round" fill="rgba(22,163,74,0.2)"/>
  <path d="M9 12L11 14L15 10" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

// Floating Shield UI reference
let activeShieldButton = null;

// ─────────────────────────────────────────────────────────────
// LEGACY COMPATIBILITY LAYER (for gradual migration)
// ─────────────────────────────────────────────────────────────
// These maintain backward compatibility while the pipeline handles core logic

const localPlaceholderMap = new Map();
const requestTokenStore = new Map();
let activeRequestId = null;

function createRequestId() {
    try {
        return crypto.randomUUID();
    } catch (err) {
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
}

function cleanupExpiredRequestMaps() {
    const now = Date.now();
    const ttlMs = 30 * 60 * 1000;

    for (const [requestId, entry] of requestTokenStore) {
        if (now - entry.timestamp > ttlMs) {
            requestTokenStore.delete(requestId);
        }
    }
}

function containsSensitiveData(text) {
    if (typeof text !== 'string') return false;

    // Use pipeline verifier if available
    if (tokenPipeline && tokenPipeline.verifier) {
        return tokenPipeline.verifier.containsSensitiveData(text);
    }

    // Fallback to direct pattern checking
    const withoutPlaceholders = text.replace(/\[omni-[^\]]+\]/gi, '');
    return RAW_SECRET_PATTERNS.some((pattern) => pattern.test(withoutPlaceholders));
}

function mergePlaceholderMap(placeholderMap = {}) {
    if (!placeholderMap || typeof placeholderMap !== 'object') return;

    for (const [placeholder, original] of Object.entries(placeholderMap)) {
        if (typeof placeholder === 'string' && typeof original === 'string') {
            localPlaceholderMap.set(placeholder, original);
        }
    }

    if (localPlaceholderMap.size > 0) {
        console.log('[PromptShield] Placeholder map created:', localPlaceholderMap.size, 'tokens');
    }
}

function registerRequestMap(placeholderMap = {}) {
    const requestId = createRequestId();
    const map = new Map();

    for (const [placeholder, original] of Object.entries(placeholderMap || {})) {
        if (typeof placeholder === 'string' && typeof original === 'string') {
            map.set(placeholder, original);
        }
    }

    requestTokenStore.set(requestId, {
        requestId,
        placeholderMap: map,
        timestamp: Date.now(),
        tabId: sessionTabId
    });

    activeRequestId = requestId;
    cleanupExpiredRequestMaps();
    return requestId;
}

function replaceFromPlaceholderMap(text, placeholderMap) {
    if (typeof text !== 'string' || !placeholderMap || placeholderMap.size === 0) {
        return text;
    }

    let restored = text;
    for (const [placeholder, original] of placeholderMap) {
        restored = restored.replaceAll(placeholder, original);
    }
    return restored;
}

function restoreMaskedTokens(responseText, placeholderMap = null) {
    if (typeof responseText !== 'string') {
        return responseText;
    }

    // Use pipeline restoration engine if available
    if (tokenPipeline && tokenPipeline.restorationEngine) {
        try {
            if (placeholderMap) {
                return tokenPipeline.restorationEngine.restoreMaskedTokens(responseText, placeholderMap);
            }

            const activeMap = requestTokenStore.get(activeRequestId)?.placeholderMap;
            if (activeMap) {
                return tokenPipeline.restorationEngine.restoreMaskedTokens(responseText, activeMap);
            }

            return tokenPipeline.restorationEngine.restoreMaskedTokens(responseText, localPlaceholderMap);
        } catch (err) {
            console.warn('[PromptShield] Restoration engine error, falling back:', err);
        }
    }

    // Fallback to legacy restoration logic
    if (placeholderMap) {
        return replaceFromPlaceholderMap(responseText, placeholderMap);
    }

    const activeMap = requestTokenStore.get(activeRequestId)?.placeholderMap;
    const activeRestored = replaceFromPlaceholderMap(responseText, activeMap);
    if (activeRestored !== responseText) return activeRestored;

    return replaceFromPlaceholderMap(responseText, localPlaceholderMap);
}

/**
 * injectShieldStyle - Injects minimal CSS for the sleek floating shield button overlay.
 */
function injectShieldStyle() {
    if (document.getElementById('promptshield-styles')) return;

    const style = document.createElement('style');
    style.id = 'promptshield-styles';
    style.textContent = `
        .promptshield-btn {
            position: fixed;
            right: 28px;
            bottom: 100px;
            z-index: 2147483647 !important;
            pointer-events: auto !important;
            background: rgba(18, 18, 18, 0.85);
            border: 1px solid rgba(245, 197, 24, 0.4);
            border-radius: 50%;
            width: 56px;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(8px);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        }
        .promptshield-btn:hover {
            border-color: rgba(245, 197, 24, 0.8);
            background: rgba(26, 26, 26, 0.95);
            transform: translateY(-1px) scale(1.04);
            box-shadow: 0 0 10px rgba(245, 197, 24, 0.2);
        }
        .promptshield-btn.success {
            border-color: rgba(22, 163, 74, 0.8);
            box-shadow: 0 0 10px rgba(22, 163, 74, 0.2);
        }
        
        /* Compliance warning layout box */
        .ps-compliance-box {
            background: rgba(239, 68, 68, 0.08) !important;
            border: 1px solid rgba(239, 68, 68, 0.3) !important;
            border-radius: 8px !important;
            padding: 12px 16px !important;
            margin: 8px 0 !important;
            border-left: 4px solid #ef4444 !important;
            font-size: 13px !important;
            color: #f87171 !important;
            line-height: 1.5 !important;
            display: block !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * findTargetInput - Searches DOM for active conversational text input areas.
 * Enhanced with better detection and logging.
 */
function findTargetInput() {
    // Standard textareas on ChatGPT, Claude, Gemini, DeepSeek
    const selectors = [
        'div[role="textbox"][aria-multiline="true"][aria-label="Enter a prompt for Gemini"]',
        '#prompt-textarea',                  // ChatGPT
        'div[contenteditable="true"]',       // Claude & Gemini (sometimes)
        'textarea[placeholder*="Ask me anything"]',
        'textarea[placeholder*="Message"]',
        'textarea.textarea',
        'textarea[role="textbox"]',          // Additional selector
        'textarea'                           // general fallback
    ];

    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
            const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
            const isConnected = el.isConnected;
            
            if (isVisible && isConnected) {
                console.log('[PromptShield] Found input area:', selector);
                return el;
            }
        }
    }
    
    // Debug: Log that no input was found
    console.log('[PromptShield] No input area found. Button will still show.');
    return null;
}

/**
 * updateInputValue - Safely writes text back to textarea or contenteditable nodes.
 * Uses document.execCommand('insertText') to ensure full virtual DOM React/Vue binding updates.
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * updateInputValue - Safely writes text back to textarea or contenteditable nodes.
 * Uses a robust three-layered framework (synthetic paste events, targeted caret insertion, and structural HTML fallback)
 * to ensure rich editors (like Quill in Gemini and ProseMirror in ChatGPT) update and persist their state cleanly.
 */
function updateInputValue(el, value) {
    console.log('[PromptShield] updateInputValue called on:', el.tagName, 'with value length:', value.length);
    el.focus();
    
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.select();
        const success = document.execCommand('insertText', false, value);
        
        // Bulletproof fallback if execCommand was not fully processed
        if (!success || el.value !== value) {
            el.value = value;
        }
        
        // Dispatch fallback input events to be absolutely safe
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable) {
        console.log('[PromptShield] Performing asynchronous HTML paragraph insertion...');
        
        // Build well-formed HTML paragraphs. Quill/ProseMirror requires block-level tags.
        const lines = value.split('\n');
        const paragraphHTML = lines.map(line => `<p>${line ? escapeHtml(line) : '<br>'}</p>`).join('');
        
        // Inject block paragraphs directly into DOM
        el.innerHTML = paragraphHTML;
        
        // Restore caret focus and position it at the end of the text node
        el.focus();
        try {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false); // Collapse caret to the end
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {
            console.warn('[PromptShield] Failed to set caret selection:', e);
        }
        
        // CRITICAL: We must delay the event dispatch by 50ms to allow the editor's 
        // internal asynchronous MutationObserver to successfully capture the new DOM structure,
        // parse it into its model, and prevent a premature framework reconciliation loop from reverting it.
        setTimeout(() => {
            console.log('[PromptShield] Dispatching delayed sync events...');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
        }, 50);
    }
}

/**
 * getInputValue - Retrieves value from inputs or contenteditable containers.
 */
function getInputValue(el) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        return el.value;
    } else if (el.isContentEditable) {
        return el.innerText;
    }
    return '';
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function setCaretAtEnd(el) {
    try {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (err) {
        console.warn('[PromptShield] Failed to set editor caret:', err);
    }
}

function dispatchEditorSyncEvents(el, text) {
    try {
        el.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: text
        }));
    } catch (err) {
        // Some pages disallow synthetic beforeinput. The input/change fallback
        // below is still required for framework state sync.
    }

    el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
        data: text
    }));
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

async function writeTextToEditor(el, text) {
    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
        if (nativeSetter) {
            nativeSetter.call(el, text);
        } else {
            el.value = text;
        }
        dispatchEditorSyncEvents(el, text);
    } else if (el.isContentEditable) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);

        const inserted = document.execCommand('insertText', false, text);
        if (!inserted || getInputValue(el) !== text) {
            el.textContent = text;
        }

        setCaretAtEnd(el);
        dispatchEditorSyncEvents(el, text);
    }

    await nextFrame();
    await wait(75);
    dispatchEditorSyncEvents(el, text);
    await wait(75);

    return getInputValue(el);
}

async function updateAndVerifyMaskedInput(el, maskedText) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const actualText = await writeTextToEditor(el, maskedText);
        if (actualText === maskedText && !containsSensitiveData(actualText)) {
            console.log('[PromptShield] Input replaced successfully');
            console.log('[PromptShield] DOM verified before submit');
            return true;
        }
    }

    const finalText = getInputValue(el);
    if (containsSensitiveData(finalText)) {
        console.error('[PromptShield] DOM still contains sensitive data. Blocking submit.');
    } else {
        console.error('[PromptShield] DOM verification failed. Blocking submit.');
    }

    return false;
}

/**
 * interceptAndMask - Pre-submit Gemini interception path.
 *
 * Gemini keeps the prompt in framework state, so writing textarea.value or
 * contenteditable.innerHTML after submission is too late. This function captures
 * Enter, send-button clicks, and form submits before Gemini's own handlers run,
 * cancels the original submit, masks the prompt, synchronizes the masked prompt
 * back through native input/change events, then replays the send click once.
 */
function interceptAndMask() {
    const GEMINI_INPUT_SELECTOR = 'div[role="textbox"][aria-multiline="true"][aria-label="Enter a prompt for Gemini"]';
    const GEMINI_SEND_BUTTON_SELECTOR = 'button[aria-label="Send message"]';
    const ATTACHED_FLAG = 'promptshieldCaptureAttached';
    const STATE_SYNC_DELAY_MS = 100;

    let maskingInProgress = false;
    let replayingSubmit = false;
    let shieldActiveCache = true;
    let lastMaskedPrompt = '';

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const sendRuntimeMessage = (payload) => new Promise((resolve) => {
        chrome.runtime.sendMessage(payload, (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                console.error('[PromptShield] Runtime communication error:', lastError);
                resolve({ success: false, error: lastError.message });
                return;
            }

            resolve(response);
        });
    });

    chrome.storage.local.get(['shieldActive'], (res) => {
        shieldActiveCache = res.shieldActive !== false;
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.shieldActive) {
            shieldActiveCache = changes.shieldActive.newValue !== false;
        }
    });

    const getGeminiTextbox = () => {
        const activeElement = document.activeElement;

        if (activeElement && activeElement.matches?.(GEMINI_INPUT_SELECTOR)) {
            return activeElement;
        }

        return document.querySelector(GEMINI_INPUT_SELECTOR);
    };

    const getSendButton = () => document.querySelector(GEMINI_SEND_BUTTON_SELECTOR);

    const readTextboxText = (textbox) => {
        if (!textbox) return '';

        // innerText preserves user-visible line breaks better than textContent
        // for contenteditable editors.
        return textbox.innerText || textbox.textContent || '';
    };

    const placeCaretAtEnd = (el) => {
        try {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (err) {
            console.warn('[PromptShield] Could not place caret after masked prompt:', err);
        }
    };

    const syncMaskedTextIntoGemini = (textbox, maskedText) => {
        textbox.focus();

        // Clear all rendered editor content first so the framework sees a clean
        // replacement rather than a partial append.
        textbox.textContent = '';
        textbox.innerHTML = '';

        // Set the visible DOM text immediately.
        textbox.textContent = maskedText;
        placeCaretAtEnd(textbox);

        // Dispatch native events that SPA editors listen for to hydrate their
        // internal state from the contenteditable surface.
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: 'insertText',
            data: maskedText
        });

        textbox.dispatchEvent(inputEvent);
        textbox.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        textbox.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    };

    const cancelOriginalSubmit = (event) => {
        if (!event) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
    };

    const runInterceptFlow = async (event) => {
        if (replayingSubmit || maskingInProgress) return;
        if (!shieldActiveCache) return;

        const textbox = getGeminiTextbox();
        if (!textbox) return;

        const rawText = readTextboxText(textbox);
        if (!rawText.trim()) return;
        if (rawText === lastMaskedPrompt) return;

        cancelOriginalSubmit(event);
        maskingInProgress = true;

        let requestId = null;
        try {
            // PIPELINE STAGE 1: Initialize request lifecycle
            requestId = createRequestId();
            if (tokenPipeline) {
                try {
                    tokenPipeline.initializeRequest(requestId);
                    tokenPipeline.beginMasking(requestId, rawText);
                } catch (err) {
                    console.error('[PromptShield] Pipeline initialization error:', err);
                }
            }

            console.log('[PromptShield] Intercepted Gemini submit before framework handlers.');

            const response = await sendRuntimeMessage({
                action: 'mask',
                prompt: rawText,
                sessionId: sessionTabId,
                requestId: requestId
            });

            if (!response || !response.success || typeof response.maskedPrompt !== 'string') {
                console.error('[PromptShield] Masking failed; refusing to send raw prompt:', response?.error);
                if (requestId && tokenPipeline) {
                    const lifecycle = tokenPipeline.getLifecycleState(requestId);
                    if (lifecycle) {
                        lifecycle.addError(new TokenPipelineError('Masking failed', 'MASKING_REQUEST_FAILED'));
                    }
                }
                return;
            }

            mergePlaceholderMap(response.placeholderMap);
            registerRequestMap(response.placeholderMap);
            console.log('[PromptShield] Sensitive entities detected');

            // PIPELINE STAGE 2: Store masking result
            if (requestId && tokenPipeline) {
                try {
                    tokenPipeline.storeMaskingResult(requestId, response.maskedPrompt, response.placeholderMap);
                } catch (err) {
                    console.error('[PromptShield] Pipeline masking result storage error:', err);
                    return;
                }
            }

            if (containsSensitiveData(response.maskedPrompt)) {
                console.error('[PromptShield] Masked prompt still contains sensitive data. Blocking submit.');
                if (requestId && tokenPipeline) {
                    const lifecycle = tokenPipeline.getLifecycleState(requestId);
                    if (lifecycle) {
                        lifecycle.addError(new TokenPipelineError('Masked prompt contains sensitive data', 'MASKED_PROMPT_UNSAFE'));
                    }
                }
                return;
            }

            lastMaskedPrompt = response.maskedPrompt;
            const verified = await updateAndVerifyMaskedInput(textbox, response.maskedPrompt);
            if (!verified) {
                if (requestId && tokenPipeline) {
                    const lifecycle = tokenPipeline.getLifecycleState(requestId);
                    if (lifecycle) {
                        lifecycle.addError(new TokenPipelineError('Input verification failed', 'INPUT_VERIFICATION_FAILED'));
                    }
                }
                return;
            }

            // PIPELINE STAGE 3: Verify DOM before submission
            if (requestId && tokenPipeline) {
                try {
                    await tokenPipeline.verifyInputBeforeSubmission(requestId, textbox);
                } catch (err) {
                    console.error('[PromptShield] Critical: DOM verification failed, blocking submission:', err);
                    return;
                }
            }

            // PIPELINE STAGE 4: Mark submission
            if (requestId && tokenPipeline) {
                try {
                    tokenPipeline.markSubmission(requestId);
                    activeRequestId = requestId;
                } catch (err) {
                    console.error('[PromptShield] Cannot mark submission:', err);
                    return;
                }
            }

            // Give Gemini/React time to consume the synthetic input/change events
            // and update its cached component state before replaying the send.
            await wait(STATE_SYNC_DELAY_MS);

            const sendButton = getSendButton();
            if (!sendButton) {
                console.warn('[PromptShield] Gemini send button not found after masking.');
                return;
            }

            replayingSubmit = true;
            sendButton.click();
            console.log('[PromptShield] Masked prompt submitted');

            // Keep the bypass flag alive long enough for the replayed click and
            // any follow-up form submit event to finish before intercepting again.
            setTimeout(() => {
                replayingSubmit = false;
            }, 1000);
        } catch (err) {
            console.error('[PromptShield] Pre-submit interception failed:', err);
            if (requestId && tokenPipeline) {
                const lifecycle = tokenPipeline.getLifecycleState(requestId);
                if (lifecycle) {
                    lifecycle.addError(err instanceof TokenPipelineError ? err : new TokenPipelineError(err.message, 'UNKNOWN_INTERCEPTION_ERROR'));
                }
            }
        } finally {
            maskingInProgress = false;
        }
    };

    const onDocumentKeydownCapture = (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;

        const target = event.target;
        const focusedTextbox = target?.closest?.(GEMINI_INPUT_SELECTOR);
        if (!focusedTextbox) return;

        runInterceptFlow(event);
    };

    const onDocumentSubmitCapture = (event) => {
        const textbox = getGeminiTextbox();
        if (!textbox || !event.target?.contains?.(textbox)) return;

        runInterceptFlow(event);
    };

    const onSendButtonClickCapture = (event) => {
        if (replayingSubmit) return;

        runInterceptFlow(event);
    };

    const onDocumentClickCapture = (event) => {
        if (replayingSubmit) return;

        const sendButton = event.target?.closest?.(GEMINI_SEND_BUTTON_SELECTOR);
        if (!sendButton) return;

        runInterceptFlow(event);
    };

    const attachSendButtonListener = () => {
        const sendButton = getSendButton();
        if (!sendButton || sendButton.dataset[ATTACHED_FLAG] === 'true') return;

        sendButton.addEventListener('click', onSendButtonClickCapture, true);
        sendButton.dataset[ATTACHED_FLAG] = 'true';
        console.log('[PromptShield] Gemini send-button capture listener attached.');
    };

    document.addEventListener('keydown', onDocumentKeydownCapture, true);
    document.addEventListener('click', onDocumentClickCapture, true);
    document.addEventListener('submit', onDocumentSubmitCapture, true);
    attachSendButtonListener();

    // Gemini is a SPA and may replace the editor/send button during route or
    // composer updates. Re-attach the direct button listener whenever needed.
    const observer = new MutationObserver(() => {
        attachSendButtonListener();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[PromptShield] Gemini pre-submit masking interceptor initialized.');
}

/**
 * renderFloatingShield - Positions and binds the floating Shield overlay next to active input.
 * NOW: Always visible, not hidden if input not found
 */
function renderFloatingShield() {
    // Check if button already exists
    if (activeShieldButton && document.body.contains(activeShieldButton)) {
        return; // Already rendered and still in DOM
    }

    // Inject styles on first render
    injectShieldStyle();

    // Create button - ALWAYS show it
    const button = document.createElement('div');
    button.className = 'promptshield-btn';
    button.innerHTML = SHIELD_SVG;
    button.title = 'Click to Mask Outbound Secrets via PromptShield';

    // Append globally to document.body as a premium fixed bottom-right floating shield
    document.body.appendChild(button);
    activeShieldButton = button;
    console.log('[PromptShield] Shield button rendered and visible in bottom-right');

    // Click handler: Intercept prompt, fetch masked state from background script worker
    button.addEventListener('click', async () => {
        console.log('[PromptShield] Shield button clicked!');
        
        // Dynamically find active input node to avoid stale React element references!
        const activeInput = findTargetInput();
        if (!activeInput) {
            console.warn('[PromptShield] Active conversational input area not found in DOM.');
            alert('PromptShield: Could not find text input area. Please click inside the text field first, then click the shield button.');
            return;
        }
        
        const rawText = getInputValue(activeInput);
        console.log('[PromptShield] Active Target Input Area Element:', activeInput);
        console.log('[PromptShield] Retrieved prompt text length:', rawText.length);
        
        if (!rawText.trim()) {
            console.warn('[PromptShield] Text area is empty. Ignoring click.');
            return;
        }

        // Check if shield is disabled by user in settings
        chrome.storage.local.get(['shieldActive'], async (res) => {
            console.log('[PromptShield] Current shieldActive setting:', res.shieldActive);
            if (res.shieldActive === false) {
                console.log('PromptShield is currently disabled.');
                return;
            }

            button.innerHTML = SHIELD_SVG_LOADING;
            console.log('[PromptShield] Dispatching mask message to background service worker...');

            chrome.runtime.sendMessage({
                action: 'mask',
                prompt: rawText,
                sessionId: sessionTabId
            }, async (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    console.error('[PromptShield] Runtime communication error:', lastError);
                    alert('PromptShield Warning: Please refresh this browser tab to reload the security context after updating the extension.');
                    button.innerHTML = SHIELD_SVG;
                    return;
                }

                console.log('[PromptShield] Masking response received:', response);
                if (response && response.success) {
                    mergePlaceholderMap(response.placeholderMap);
                    registerRequestMap(response.placeholderMap);
                    console.log('[PromptShield] Sensitive entities detected');
                    console.log('[PromptShield] Masked prompt sent');
                    if (containsSensitiveData(response.maskedPrompt)) {
                        button.innerHTML = SHIELD_SVG;
                        console.error('[PromptShield] Masked prompt still contains sensitive data. Blocking submit.');
                        return;
                    }
                    console.log('[PromptShield] Swapping text in input with:', response.maskedPrompt);
                    const verified = await updateAndVerifyMaskedInput(activeInput, response.maskedPrompt);
                    if (!verified) {
                        button.innerHTML = SHIELD_SVG;
                        return;
                    }
                    button.innerHTML = SHIELD_SVG_SUCCESS;
                    button.classList.add('success');

                    setTimeout(() => {
                        button.innerHTML = SHIELD_SVG;
                        button.classList.remove('success');
                    }, 2200);
                } else {
                    button.innerHTML = SHIELD_SVG;
                    console.error('PromptShield masking failed:', response?.error);
                }
            });
        });
    });

    // Clean up if node disappears
    const cleanupInterval = setInterval(() => {
        if (!document.body.contains(inputArea)) {
            button.remove();
            activeShieldButton = null;
            clearInterval(cleanupInterval);
        }
    }, 1500);
}

// ─────────────────────────────────────────────────────────────
//  INBOUND observer (AUTO-UNMASK STREAMING DIALOGUE NODES)
// ─────────────────────────────────────────────────────────────

const unmaskCache = new Map();
const pendingUnmask = new Set();
const PLACEHOLDER_PATTERN = /\[omni-[a-z0-9-]+\]/i;

/**
 * isPromptInputSurface - Keeps inbound unmasking away from active composer
 * fields while still allowing response/output areas to be restored.
 */
function isPromptInputSurface(el) {
    if (!el) return false;

    return Boolean(el.closest?.([
        'input',
        'textarea',
        '#prompt-textarea',
        'div[role="textbox"][aria-multiline="true"][aria-label="Enter a prompt for Gemini"]',
        '[contenteditable="true"][aria-label*="prompt" i]',
        '[contenteditable="true"][aria-label*="message" i]',
        '[contenteditable="true"][data-placeholder*="Ask" i]'
    ].join(',')));
}

function canRewriteTextContainer(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (isPromptInputSurface(el)) return false;
    if (['HTML', 'BODY', 'MAIN', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(el.tagName)) return false;

    return true;
}

function containsPlaceholder(text) {
    return typeof text === 'string' && PLACEHOLDER_PATTERN.test(text);
}

function requestUnmaskText(rawText, onUnmasked) {
    if (!containsPlaceholder(rawText)) return;

    // PIPELINE STAGE 5 & 6: Response received and restoration
    if (activeRequestId && tokenPipeline) {
        try {
            const lifecycle = tokenPipeline.getLifecycleState(activeRequestId);
            if (lifecycle && lifecycle.stage === 'SUBMITTED') {
                tokenPipeline.markResponseReceived(activeRequestId);
            }
        } catch (err) {
            console.warn('[PromptShield] Could not mark response received:', err);
        }
    }

    const locallyRestored = restoreMaskedTokens(rawText);
    if (locallyRestored !== rawText) {
        console.log('[PromptShield] AI response intercepted');
        console.log('[PromptShield] Restoring placeholders');
        unmaskCache.set(rawText, locallyRestored);
        onUnmasked(locallyRestored);
        console.log('[PromptShield] Final restored response injected');
        
        // PIPELINE STAGE 8 & 9: Restoration completion
        if (activeRequestId && tokenPipeline) {
            try {
                tokenPipeline.completeRestoration(activeRequestId);
                activeRequestId = null;
            } catch (err) {
                console.warn('[PromptShield] Could not complete restoration:', err);
            }
        }
        return;
    }

    if (unmaskCache.has(rawText)) {
        const cachedText = unmaskCache.get(rawText);
        if (cachedText !== rawText) {
            onUnmasked(cachedText);
            if (activeRequestId && tokenPipeline) {
                try {
                    tokenPipeline.completeRestoration(activeRequestId);
                    activeRequestId = null;
                } catch (err) {
                    console.warn('[PromptShield] Could not complete restoration:', err);
                }
            }
        }
        return;
    }

    if (pendingUnmask.has(rawText)) return;
    pendingUnmask.add(rawText);

    chrome.runtime.sendMessage({
        action: 'unmask',
        text: rawText,
        sessionId: sessionTabId,
        requestId: activeRequestId
    }, (response) => {
        pendingUnmask.delete(rawText);

        if (response && response.success && response.unmaskedText !== rawText) {
            console.log('[PromptShield] AI response intercepted');
            console.log('[PromptShield] Restoring placeholders');
            unmaskCache.set(rawText, response.unmaskedText);
            onUnmasked(response.unmaskedText);
            console.log('[PromptShield] Final restored response injected');
            
            // PIPELINE STAGE 8 & 9: Restoration completion
            if (activeRequestId && tokenPipeline) {
                try {
                    tokenPipeline.completeRestoration(activeRequestId);
                    activeRequestId = null;
                } catch (err) {
                    console.warn('[PromptShield] Could not complete restoration:', err);
                }
            }
        }
    });
}

function reactiveUnmaskElement(el) {
    if (!canRewriteTextContainer(el)) return;

    const rawText = el.textContent;
    if (!containsPlaceholder(rawText)) return;
    if (rawText.length > 4000) return;

    // Prefer text-node replacement when the token is intact in one node. Only
    // rewrite an element's whole text when Gemini split a placeholder across
    // nested inline nodes and no child owns the complete token.
    for (const child of el.children) {
        if (containsPlaceholder(child.textContent)) {
            return;
        }
    }

    requestUnmaskText(rawText, (unmaskedText) => {
        if (el.isConnected && !isPromptInputSurface(el) && el.textContent === rawText) {
            el.textContent = unmaskedText;
        }
    });
}

/**
 * reactiveUnmaskNode - Scans text elements for [omni-*] placeholders, fetches
 * original values from background cache, and dynamically restores them in DOM.
 * 
 * @param {Node} textNode Target DOM Text Node.
 */
function reactiveUnmaskNode(textNode) {
    const rawVal = textNode.nodeValue;
    if (!rawVal || typeof rawVal !== 'string') return;

    const parent = textNode.parentElement;
    if (isPromptInputSurface(parent)) {
        return;
    }

    requestUnmaskText(rawVal, (unmaskedText) => {
        if (textNode.isConnected && textNode.nodeValue === rawVal && !isPromptInputSurface(parent)) {
            // Safely update values inside the DOM node
            textNode.nodeValue = unmaskedText;
        }
    });

    // Capture and style legal Copyleft/GPL warnings returned from the gateway server
    if (rawVal.includes('PromptShield has detected copyleft licensed code')) {
        if (parent && !parent.classList.contains('ps-compliance-box') && parent.tagName !== 'STYLE') {
            // Reformat container element into a premium warning box
            parent.className = 'ps-compliance-box';
            // Increment local extension dashboard metrics
            chrome.runtime.sendMessage({ action: 'incrementCompliance' });
        }
    }
}

/**
 * runDomObserver - Monitors the DOM tree continuously for new streaming text nodes.
 * IDEMPOTENT RESTORATION - Prevents duplicate replacements and stale observations.
 */
function runDomObserver() {
    const processedTextNodes = new WeakSet();
    const processedElements = new WeakSet();
    let observerActive = true;

    const scanSubtree = (root) => {
        if (!root) return;

        if (root.nodeType === Node.TEXT_NODE) {
            // Skip already processed text nodes (idempotent)
            if (!processedTextNodes.has(root)) {
                reactiveUnmaskNode(root);
                processedTextNodes.add(root);
            }
            
            // Also check parent element
            const parentEl = root.parentElement;
            if (parentEl && !processedElements.has(parentEl)) {
                reactiveUnmaskElement(parentEl);
                processedElements.add(parentEl);
            }
            return;
        }

        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
            return;
        }

        if (root.nodeType === Node.ELEMENT_NODE) {
            if (!processedElements.has(root)) {
                reactiveUnmaskElement(root);
                processedElements.add(root);
            }
        }

        const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        let textNode;
        while ((textNode = textWalker.nextNode())) {
            if (!processedTextNodes.has(textNode)) {
                reactiveUnmaskNode(textNode);
                processedTextNodes.add(textNode);
            }
        }

        const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
        let elementNode;
        while ((elementNode = elementWalker.nextNode())) {
            if (!processedElements.has(elementNode)) {
                reactiveUnmaskElement(elementNode);
                processedElements.add(elementNode);
            }
        }
    };

    const observer = new MutationObserver((mutations) => {
        if (!observerActive) return;

        for (const mutation of mutations) {
            // New nodes: scan for placeholders
            for (const node of mutation.addedNodes) {
                if (!processedElements.has(node) || node.nodeType === Node.TEXT_NODE) {
                    scanSubtree(node);
                }
            }

            // Character data changes in text nodes
            if (mutation.type === 'characterData' && !processedTextNodes.has(mutation.target)) {
                reactiveUnmaskNode(mutation.target);
                processedTextNodes.add(mutation.target);
                
                const parentEl = mutation.target.parentElement;
                if (parentEl && !processedElements.has(parentEl)) {
                    reactiveUnmaskElement(parentEl);
                    processedElements.add(parentEl);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Catch placeholders that were already rendered before this content script
    // or before the observer attached.
    scanSubtree(document.body);

    // Some AI pages stream by replacing nested spans in batches that can briefly
    // split placeholders across nodes. A light polling pass catches those final
    // settled render states without touching the prompt composer.
    const pollingInterval = setInterval(() => {
        if (observerActive) {
            scanSubtree(document.body);
        }
    }, 1500);

    // Cleanup function for graceful shutdown
    window.addEventListener('beforeunload', () => {
        observerActive = false;
        observer.disconnect();
        clearInterval(pollingInterval);
        processedTextNodes = null;
        processedElements = null;
    });

    console.log('[PromptShield] Idempotent DOM observer initialized');
}

// ─────────────────────────────────────────────────────────────
//  INITIALIZATION
// ─────────────────────────────────────────────────────────────

console.log('[PromptShield] 🚀 Starting initialization...');

// Run overlay rendering periodically or on dynamic page transitions
setInterval(() => {
    try {
        renderFloatingShield();
    } catch (err) {
        console.error('[PromptShield] Error in renderFloatingShield:', err);
    }
}, 1000);

// Capture Gemini submissions before the page framework consumes raw prompt text.
try {
    interceptAndMask();
    console.log('[PromptShield] ✅ Masking interception initialized');
} catch (err) {
    console.error('[PromptShield] Error initializing masking interception:', err);
}

// Initialize DOM listener
try {
    runDomObserver();
    console.log('[PromptShield] ✅ DOM observer initialized');
} catch (err) {
    console.error('[PromptShield] Error initializing DOM observer:', err);
}

console.log('[PromptShield] ✅✅✅ FULLY INITIALIZED - Shield button should be visible in bottom-right corner');
