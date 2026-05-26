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
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#F5C518" stroke-width="2" stroke-linejoin="round" fill="rgba(245,197,24,0.15)"/>
  <path d="M9 12L11 14L15 10" stroke="#F5C518" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const SHIELD_SVG_LOADING = `
<svg class="ps-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: ps-rotate 1s linear infinite;">
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
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            position: absolute;
            right: 48px;
            bottom: 12px;
            z-index: 999999;
            background: rgba(18, 18, 18, 0.85);
            border: 1px solid rgba(245, 197, 24, 0.4);
            border-radius: 6px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(8px);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
 */
function updateInputValue(el, value) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.value = value;
        // Trigger necessary event listeners on site frameworks
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.getAttribute('contenteditable') === 'true') {
        el.innerText = value;
        // Trigger React/Vue input watchers
        const textEvent = new InputEvent('input', { bubbles: true, cancelable: true });
        el.dispatchEvent(textEvent);
    }
}

/**
 * getInputValue - Retrieves value from inputs or contenteditable containers.
 */
function getInputValue(el) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        return el.value;
    } else if (el.getAttribute('contenteditable') === 'true') {
        return el.innerText;
    }
    return '';
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

    // Mount locally inside the parent container of the textarea so it anchors perfectly in the corner
    const parent = inputArea.parentElement;
    if (parent) {
        parent.style.position = 'relative';
        parent.appendChild(button);
    } else {
        document.body.appendChild(button);
    }
    activeShieldButton = button;

    // Click handler: Intercept prompt, fetch masked state from background script worker
    button.addEventListener('click', async () => {
        const rawText = getInputValue(inputArea);
        if (!rawText.trim()) return;

        // Check if shield is disabled by user in settings
        chrome.storage.local.get(['shieldActive'], async (res) => {
            if (res.shieldActive === false) {
                console.log('PromptShield is currently disabled.');
                return;
            }

            button.innerHTML = SHIELD_SVG_LOADING;

            chrome.runtime.sendMessage({
                action: 'mask',
                prompt: rawText,
                sessionId: sessionTabId
            }, (response) => {
                if (response && response.success) {
                    updateInputValue(inputArea, response.maskedPrompt);
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
        const parent = textNode.parentElement;
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

// Initialize DOM listener
runDomObserver();
