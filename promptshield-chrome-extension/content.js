/**
 * ============================================================
 *  PromptShield AI — Component 3: Injected Content Script
 *  File: content.js (Chrome Extension Manifest V3)
 * ============================================================
 */

'use strict';

// Shared Session ID for browser tab context
const sessionTabId = 'chrome-tab-' + Math.floor(Math.random() * 100000);
console.log(`PromptShield active in tab. Session ID: ${sessionTabId}`);

// Injected Sleek Floating Shield Overlay
let activeShieldButton = null;

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
        'textarea'                           // general fallback
    ];

    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
            return el;
        }
    }
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

        try {
            console.log('[PromptShield] Intercepted Gemini submit before framework handlers.');

            const response = await sendRuntimeMessage({
                action: 'mask',
                prompt: rawText,
                sessionId: sessionTabId
            });

            if (!response || !response.success || typeof response.maskedPrompt !== 'string') {
                console.error('[PromptShield] Masking failed; refusing to send raw prompt:', response?.error);
                return;
            }

            lastMaskedPrompt = response.maskedPrompt;
            syncMaskedTextIntoGemini(textbox, response.maskedPrompt);

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

            // Keep the bypass flag alive long enough for the replayed click and
            // any follow-up form submit event to finish before intercepting again.
            setTimeout(() => {
                replayingSubmit = false;
            }, 250);
        } catch (err) {
            console.error('[PromptShield] Pre-submit interception failed:', err);
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
 */
function renderFloatingShield() {
    const inputArea = findTargetInput();
    if (!inputArea) {
        if (activeShieldButton) {
            activeShieldButton.remove();
            activeShieldButton = null;
        }
        return;
    }

    if (activeShieldButton) return; // Already rendered

    injectShieldStyle();

    const button = document.createElement('div');
    button.className = 'promptshield-btn';
    button.innerHTML = SHIELD_SVG;
    button.title = 'Click to Mask Outbound Secrets via PromptShield';

    // Append globally to document.body as a premium fixed bottom-left floating shield
    document.body.appendChild(button);
    activeShieldButton = button;

    // Click handler: Intercept prompt, fetch masked state from background script worker
    button.addEventListener('click', async () => {
        console.log('[PromptShield] Shield button clicked!');
        
        // Dynamically find active input node to avoid stale React element references!
        const activeInput = findTargetInput();
        if (!activeInput) {
            console.warn('[PromptShield] Active conversational input area not found in DOM.');
            return;
        }
        
        const rawText = getInputValue(activeInput);
        console.log('[PromptShield] Active Target Input Area Element:', activeInput);
        console.log('[PromptShield] Retrieved prompt text:', rawText);
        
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
            }, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    console.error('[PromptShield] Runtime communication error:', lastError);
                    alert('PromptShield Warning: Please refresh this browser tab to reload the security context after updating the extension.');
                    button.innerHTML = SHIELD_SVG;
                    return;
                }

                console.log('[PromptShield] Masking response received:', response);
                if (response && response.success) {
                    console.log('[PromptShield] Swapping text in input with:', response.maskedPrompt);
                    updateInputValue(activeInput, response.maskedPrompt);
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
    if (parent && parent.closest?.(
        'textarea, input, [contenteditable="true"], div[role="textbox"][aria-multiline="true"]'
    )) {
        return;
    }

    // Matches [omni-email-1], [omni-oai-Fk9...], [omni-ai-3]
    const placeholderRegex = /\[omni-[a-z0-9-]+\]/gi;

    if (placeholderRegex.test(rawVal)) {
        // Trigger unmask via background fetch
        chrome.runtime.sendMessage({
            action: 'unmask',
            text: rawVal,
            sessionId: sessionTabId
        }, (response) => {
            if (response && response.success && response.unmaskedText !== rawVal) {
                // Safely update values inside the DOM node
                textNode.nodeValue = response.unmaskedText;
            }
        });
    }

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
 */
function runDomObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                // If it is a Text Node, scan it
                if (node.nodeType === Node.TEXT_NODE) {
                    reactiveUnmaskNode(node);
                } else {
                    // Traverse children text elements
                    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
                    let textNode;
                    while ((textNode = walker.nextNode())) {
                        reactiveUnmaskNode(textNode);
                    }
                }
            }

            // Also check for attribute modifications on already existing streaming text nodes
            if (mutation.type === 'characterData') {
                reactiveUnmaskNode(mutation.target);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

// ─────────────────────────────────────────────────────────────
//  INITIALIZATION
// ─────────────────────────────────────────────────────────────

// Run overlay rendering periodically or on dynamic page transitions
setInterval(renderFloatingShield, 1000);

// Capture Gemini submissions before the page framework consumes raw prompt text.
interceptAndMask();

// Initialize DOM listener
runDomObserver();
