/**
 * ============================================================
 *  PromptShield AI — Component 6: Popup Controller
 *  File: popup.js (Chrome Extension Manifest V3)
 * ============================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const healthStatusEl = document.getElementById('health-status');
    const healthPulseEl = document.getElementById('health-pulse');
    const shieldToggleEl = document.getElementById('shield-toggle');
    
    // Metrics Elements
    const statEmailsEl = document.getElementById('stat-emails');
    const statKeysEl = document.getElementById('stat-keys');
    const statPiiEl = document.getElementById('stat-pii');
    const statComplianceEl = document.getElementById('stat-compliance');
    
    const btnResetEl = document.getElementById('btn-reset');

    /**
     * updateStatsUI - Reads local statistics from Chrome storage and renders them.
     */
    function updateStatsUI() {
        chrome.storage.local.get(['stats'], (result) => {
            const stats = result.stats || {
                keysBlocked: 0,
                emailsShielded: 0,
                piiProtected: 0,
                complianceWarnings: 0
            };

            statEmailsEl.innerText = stats.emailsShielded;
            statKeysEl.innerText = stats.keysBlocked;
            statPiiEl.innerText = stats.piiProtected;
            statComplianceEl.innerText = stats.complianceWarnings;
        });
    }

    /**
     * checkGatewayHealth - Asynchronously audits the state of the local Node.js proxy server.
     */
    function checkGatewayHealth() {
        chrome.runtime.sendMessage({ action: 'checkHealth' }, (response) => {
            healthPulseEl.className = 'ps-pulse'; // Reset base classes
            
            if (response && response.status === 'online') {
                healthStatusEl.innerText = 'SHIELD SECURED';
                healthStatusEl.style.color = '#FFFFFF';
                healthPulseEl.classList.add('online');
            } else {
                healthStatusEl.innerText = 'GATEWAY OFFLINE';
                healthStatusEl.style.color = '#EF4444';
                healthPulseEl.classList.add('offline');
            }
        });
    }

    // 1. Initialize Toggle State from storage
    chrome.storage.local.get(['shieldActive'], (result) => {
        // Default to active if unset
        const active = result.shieldActive !== false;
        shieldToggleEl.checked = active;
    });

    // 2. Bind Toggle Event to Storage
    shieldToggleEl.addEventListener('change', () => {
        chrome.storage.local.set({ shieldActive: shieldToggleEl.checked }, () => {
            console.log(`PromptShield protection set to: ${shieldToggleEl.checked}`);
        });
    });

    // 3. Bind Reset Stats Action
    btnResetEl.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your local shielding history?')) {
            chrome.runtime.sendMessage({ action: 'resetStats' }, (response) => {
                if (response && response.success) {
                    updateStatsUI();
                }
            });
        }
    });

    // 4. Run Status and UI Sync
    checkGatewayHealth();
    updateStatsUI();

    // Dynamically poll health in-view
    const pollHealthInterval = setInterval(checkGatewayHealth, 4000);

    // Clean interval on popup unload
    window.addEventListener('unload', () => {
        clearInterval(pollHealthInterval);
    });
});
