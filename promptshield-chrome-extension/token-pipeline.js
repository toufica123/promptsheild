/**
 * ============================================================
 *  PromptShield AI — Enterprise Token Lifecycle Pipeline
 *  File: token-pipeline.js (Chrome Extension)
 * ============================================================
 * 
 * Core responsibilities:
 * - Deterministic token lifecycle management
 * - Per-request isolation via token store
 * - Idempotent restoration logic
 * - Failsafe protection mechanisms
 * - Comprehensive audit trail
 */

'use strict';

const PIPELINE_DEBUG = true;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_STORED_REQUESTS = 500;
const PLACEHOLDER_PATTERN = /\[omni-[a-z0-9-]+\]/gi;
const RESTORATION_LOCK_TIMEOUT = 5000; // 5 seconds

class TokenPipelineError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR') {
        super(message);
        this.name = 'TokenPipelineError';
        this.code = code;
    }
}

/**
 * TokenLifecycleState - Tracks deterministic progression through masking/unmasking
 */
class TokenLifecycleState {
    constructor(requestId) {
        this.requestId = requestId;
        this.createdAt = Date.now();
        this.stage = 'INITIALIZED'; // INITIALIZED → MASKING → INPUT_REPLACED → SUBMITTED → RESPONSE_RECEIVED → RESTORING → COMPLETED
        this.originalPrompt = null;
        this.maskedPrompt = null;
        this.placeholderMap = new Map();
        this.submissionVerified = false;
        this.restorationInProgress = false;
        this.restorationLockTime = null;
        this.errors = [];
        this.metadata = {};
    }

    isExpired() {
        return Date.now() - this.createdAt > TOKEN_TTL_MS;
    }

    canTransition(targetStage) {
        const stages = ['INITIALIZED', 'MASKING', 'INPUT_REPLACED', 'SUBMITTED', 'RESPONSE_RECEIVED', 'RESTORING', 'COMPLETED'];
        const current = stages.indexOf(this.stage);
        const target = stages.indexOf(targetStage);
        return target > current;
    }

    transition(targetStage) {
        if (!this.canTransition(targetStage)) {
            throw new TokenPipelineError(
                `Invalid stage transition from ${this.stage} to ${targetStage}`,
                'INVALID_STAGE_TRANSITION'
            );
        }
        this.stage = targetStage;
        logPipeline(`[${this.requestId}] Stage transition: → ${targetStage}`);
    }

    addError(error) {
        this.errors.push({
            timestamp: Date.now(),
            message: error.message,
            code: error.code || 'UNKNOWN'
        });
    }
}

/**
 * PER-REQUEST TOKEN STORE - Isolated request lifecycle container
 */
class TokenStore {
    constructor(maxRequests = MAX_STORED_REQUESTS) {
        this.store = new Map();
        this.maxRequests = maxRequests;
        this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }

    create(requestId) {
        if (this.store.size >= this.maxRequests) {
            const oldest = Array.from(this.store.entries())
                .sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
            if (oldest) this.store.delete(oldest[0]);
        }

        const lifecycle = new TokenLifecycleState(requestId);
        this.store.set(requestId, lifecycle);
        logPipeline(`Token store: Created entry for ${requestId}`);
        return lifecycle;
    }

    get(requestId) {
        const lifecycle = this.store.get(requestId);
        if (lifecycle && lifecycle.isExpired()) {
            this.store.delete(requestId);
            logPipeline(`Token store: Expired entry removed ${requestId}`);
            return null;
        }
        return lifecycle;
    }

    delete(requestId) {
        return this.store.delete(requestId);
    }

    cleanup() {
        let removed = 0;
        for (const [key, lifecycle] of this.store) {
            if (lifecycle.isExpired()) {
                this.store.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            logPipeline(`Token store cleanup: Removed ${removed} expired entries`);
        }
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}

/**
 * RESTORATION ENGINE - Idempotent token replacement
 */
class RestorationEngine {
    constructor() {
        this.restorationCache = new Map();
        this.processingSet = new Set();
    }

    /**
     * restoreMaskedTokens - Deterministic, idempotent placeholder restoration
     * 
     * @param {string} text Input text with [omni-*] placeholders
     * @param {Map} placeholderMap Token → original value mapping
     * @returns {string} Restored text with all placeholders replaced
     */
    restoreMaskedTokens(text, placeholderMap) {
        if (!text || typeof text !== 'string') {
            throw new TokenPipelineError('Invalid text input', 'INVALID_TEXT');
        }

        if (!placeholderMap || !(placeholderMap instanceof Map) && typeof placeholderMap !== 'object') {
            logPipeline('[RestEngine] Invalid placeholder map, skipping restoration');
            return text;
        }

        // Generate cache key from text hash
        const cacheKey = this.generateCacheKey(text);
        const cacheEntry = this.restorationCache.get(cacheKey);
        
        // If we've already restored this exact text, return cached result
        if (cacheEntry && cacheEntry.mapHash === this.hashMap(placeholderMap)) {
            logPipeline('[RestEngine] Cache hit for restoration');
            return cacheEntry.result;
        }

        let restored = text;
        let replacementCount = 0;
        const entries = placeholderMap instanceof Map 
            ? Array.from(placeholderMap.entries()) 
            : Object.entries(placeholderMap);

        for (const [placeholder, original] of entries) {
            if (typeof placeholder !== 'string' || typeof original !== 'string') continue;

            // Escape special regex characters in placeholder
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedPlaceholder, 'g');
            const beforeCount = (restored.match(regex) || []).length;

            restored = restored.replace(regex, original);
            replacementCount += beforeCount;
        }

        logPipeline(`[RestEngine] Completed ${replacementCount} token replacements`);

        // Cache the result
        this.restorationCache.set(cacheKey, {
            result: restored,
            mapHash: this.hashMap(placeholderMap),
            timestamp: Date.now()
        });

        // Cleanup old cache entries
        if (this.restorationCache.size > 1000) {
            this.pruneCacheOldest();
        }

        return restored;
    }

    /**
     * verifyRestoration - Check if restoration was successful
     */
    verifyRestoration(original, restored, placeholderMap) {
        if (original === restored) {
            logPipeline('[RestEngine] No placeholders found in text');
            return true;
        }

        // Count remaining placeholders
        const remainingPlaceholders = (restored.match(PLACEHOLDER_PATTERN) || []).length;
        if (remainingPlaceholders > 0) {
            logPipeline(`[RestEngine] WARNING: ${remainingPlaceholders} placeholders remain after restoration`, true);
            return false;
        }

        return true;
    }

    generateCacheKey(text) {
        // Simple hash for cache key
        let hash = 0;
        for (let i = 0; i < Math.min(text.length, 100); i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit
        }
        return `cache-${hash}`;
    }

    hashMap(map) {
        const entries = map instanceof Map ? Array.from(map.entries()) : Object.entries(map);
        return entries.length.toString();
    }

    pruneCacheOldest() {
        const now = Date.now();
        const cacheTTL = 5 * 60 * 1000; // 5 minutes
        for (const [key, entry] of this.restorationCache) {
            if (now - entry.timestamp > cacheTTL) {
                this.restorationCache.delete(key);
            }
        }
    }

    clearCache() {
        this.restorationCache.clear();
    }
}

/**
 * MASKING VERIFIER - Pre-submission validation
 */
class MaskingVerifier {
    constructor(sensitivePatterns) {
        this.patterns = sensitivePatterns;
    }

    containsSensitiveData(text) {
        if (typeof text !== 'string') return false;

        // Remove placeholders before checking - they're safe outbound tokens
        const withoutPlaceholders = text.replace(PLACEHOLDER_PATTERN, '');
        return this.patterns.some(pattern => pattern.test(withoutPlaceholders));
    }

    /**
     * verifyDOMContent - Reads actual DOM value and validates masking
     */
    verifyDOMContent(element) {
        if (!element) {
            throw new TokenPipelineError('Element not found', 'ELEMENT_NOT_FOUND');
        }

        let actualDOMText = '';
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            actualDOMText = element.value;
        } else if (element.isContentEditable) {
            actualDOMText = element.innerText || element.textContent;
        }

        if (this.containsSensitiveData(actualDOMText)) {
            logPipeline('[Verifier] CRITICAL: DOM contains unmasked sensitive data!', true);
            return {
                valid: false,
                reason: 'UNMASKED_SENSITIVE_DATA',
                actualContent: '(hidden for security)'
            };
        }

        return {
            valid: true,
            contentLength: actualDOMText.length
        };
    }
}

/**
 * MAIN PIPELINE ORCHESTRATOR
 */
class TokenPipeline {
    constructor(sensitivePatterns) {
        this.tokenStore = new TokenStore();
        this.restorationEngine = new RestorationEngine();
        this.verifier = new MaskingVerifier(sensitivePatterns);
        this.activeRequestId = null;
    }

    /**
     * Stage 1: Initialize request lifecycle
     */
    initializeRequest(requestId) {
        const lifecycle = this.tokenStore.create(requestId);
        this.activeRequestId = requestId;
        lifecycle.transition('INITIALIZED');
        return lifecycle;
    }

    /**
     * Stage 2: Begin masking phase
     */
    beginMasking(requestId, originalPrompt) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        lifecycle.transition('MASKING');
        lifecycle.originalPrompt = originalPrompt;
        logPipeline(`[${requestId}] Begin masking phase with prompt length: ${originalPrompt.length}`);
        return lifecycle;
    }

    /**
     * Stage 3: Store masking result and verify
     */
    storeMaskingResult(requestId, maskedPrompt, placeholderMap) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        if (!maskedPrompt || typeof maskedPrompt !== 'string') {
            const error = new TokenPipelineError('Invalid masked prompt', 'INVALID_MASKED_PROMPT');
            lifecycle.addError(error);
            throw error;
        }

        // Verify masked prompt doesn't contain raw sensitive data
        if (this.verifier.containsSensitiveData(maskedPrompt)) {
            const error = new TokenPipelineError(
                'Masked prompt still contains sensitive data',
                'MASKING_FAILED'
            );
            lifecycle.addError(error);
            throw error;
        }

        // Store placeholder map
        if (placeholderMap instanceof Map) {
            lifecycle.placeholderMap = placeholderMap;
        } else if (typeof placeholderMap === 'object') {
            lifecycle.placeholderMap = new Map(Object.entries(placeholderMap));
        }

        lifecycle.maskedPrompt = maskedPrompt;
        logPipeline(`[${requestId}] Masking result stored: ${maskedPrompt.length} chars, ${lifecycle.placeholderMap.size} tokens`);
        return lifecycle;
    }

    /**
     * Stage 4: Verify input before submission
     */
    async verifyInputBeforeSubmission(requestId, element) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        const verification = this.verifier.verifyDOMContent(element);
        if (!verification.valid) {
            const error = new TokenPipelineError(
                `DOM verification failed: ${verification.reason}`,
                'DOM_VERIFICATION_FAILED'
            );
            lifecycle.addError(error);
            throw error;
        }

        lifecycle.submissionVerified = true;
        lifecycle.transition('INPUT_REPLACED');
        logPipeline(`[${requestId}] Input verified successfully before submission`);
        return lifecycle;
    }

    /**
     * Stage 5: Mark submission
     */
    markSubmission(requestId) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        if (!lifecycle.submissionVerified) {
            throw new TokenPipelineError(
                'Cannot submit: Input not verified',
                'SUBMISSION_NOT_VERIFIED'
            );
        }

        lifecycle.transition('SUBMITTED');
        logPipeline(`[${requestId}] Masked prompt submitted`);
        return lifecycle;
    }

    /**
     * Stage 6: Mark response received
     */
    markResponseReceived(requestId) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        lifecycle.transition('RESPONSE_RECEIVED');
        logPipeline(`[${requestId}] AI response intercepted`);
        return lifecycle;
    }

    /**
     * Stage 7: Begin restoration with idempotent lock
     */
    beginRestoration(requestId) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        if (lifecycle.restorationInProgress) {
            const lockAge = Date.now() - lifecycle.restorationLockTime;
            if (lockAge > RESTORATION_LOCK_TIMEOUT) {
                logPipeline(`[${requestId}] Restoration lock timeout, acquiring new lock`);
                lifecycle.restorationInProgress = false;
            } else {
                throw new TokenPipelineError(
                    'Restoration already in progress',
                    'RESTORATION_IN_PROGRESS'
                );
            }
        }

        lifecycle.restorationInProgress = true;
        lifecycle.restorationLockTime = Date.now();
        lifecycle.transition('RESTORING');
        logPipeline(`[${requestId}] Begin restoration phase`);
        return lifecycle;
    }

    /**
     * Stage 8: Perform restoration
     */
    performRestoration(requestId, maskedText) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        if (!lifecycle.restorationInProgress) {
            throw new TokenPipelineError(
                'Restoration not in progress',
                'RESTORATION_NOT_STARTED'
            );
        }

        try {
            const restored = this.restorationEngine.restoreMaskedTokens(
                maskedText,
                lifecycle.placeholderMap
            );

            const verificationResult = this.restorationEngine.verifyRestoration(
                maskedText,
                restored,
                lifecycle.placeholderMap
            );

            if (!verificationResult) {
                throw new TokenPipelineError(
                    'Restoration verification failed',
                    'RESTORATION_VERIFICATION_FAILED'
                );
            }

            logPipeline(`[${requestId}] Restoring placeholders`);
            return restored;
        } catch (error) {
            lifecycle.addError(error);
            throw error;
        }
    }

    /**
     * Stage 9: Complete restoration and cleanup
     */
    completeRestoration(requestId) {
        const lifecycle = this.tokenStore.get(requestId);
        if (!lifecycle) throw new TokenPipelineError('Request not found', 'REQUEST_NOT_FOUND');

        lifecycle.restorationInProgress = false;
        lifecycle.transition('COMPLETED');
        logPipeline(`[${requestId}] Final restored response injected`);
        logPipeline(`[${requestId}] Pipeline completed (total errors: ${lifecycle.errors.length})`);
        
        // Clean up after a delay to allow for any final observers
        setTimeout(() => {
            this.tokenStore.delete(requestId);
        }, 5000);

        return lifecycle;
    }

    /**
     * Unified masking flow (for compatibility)
     */
    async executeMaskingFlow(requestId, originalPrompt, element) {
        try {
            const init = this.initializeRequest(requestId);
            this.beginMasking(requestId, originalPrompt);
            
            // Note: Actual masking will be done by background.js and results stored via storeMaskingResult
            return init;
        } catch (error) {
            logPipeline(`Masking flow error: ${error.message}`, true);
            throw error;
        }
    }

    /**
     * Debug utility: Get lifecycle state
     */
    getLifecycleState(requestId) {
        return this.tokenStore.get(requestId);
    }

    /**
     * Cleanup
     */
    destroy() {
        this.tokenStore.destroy();
        this.restorationEngine.clearCache();
    }
}

/**
 * DEBUG LOGGING
 */
function logPipeline(message, isError = false) {
    if (!PIPELINE_DEBUG) return;
    const prefix = isError ? '[⚠ PIPELINE ERROR]' : '[✓ PIPELINE]';
    console.log(`${prefix} ${message}`);
}

/**
 * EXPORT FOR CONTENT SCRIPT
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TokenPipeline,
        TokenLifecycleState,
        TokenStore,
        RestorationEngine,
        MaskingVerifier,
        TokenPipelineError,
        logPipeline
    };
} else {
    // Browser environment
    window.TokenPipeline = TokenPipeline;
    window.TokenLifecycleState = TokenLifecycleState;
    window.RestorationEngine = RestorationEngine;
    window.MaskingVerifier = MaskingVerifier;
    window.TokenPipelineError = TokenPipelineError;
    window.logPipeline = logPipeline;
}
