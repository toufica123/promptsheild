const AuditLog = require("../models/AuditLog");
const detectRisk = require("../services/riskService");
const { maskSensitiveData, unmaskSensitiveData } = require("../services/maskingService");
const detectPromptInjection = require("../services/promptInjectionService");
const { callGroqAPI } = require("../services/openaiService");
const { extractCodeBlocks } = require("../services/codeAnalysis/textExtractor");
const { analyzeLicenseRisk } = require("../services/codeAnalysis/licenseMatcher");

const BLOCK_THRESHOLD = 80;

// Health check endpoint
exports.getHealth = (req, res) => {
    res.send("AI Proxy Server Running");
};

// Main chat proxy endpoint
exports.chatProxy = async (req, res) => {
    try {
        const { prompt } = req.body;
        const sessionId = req.body.sessionId || req.headers['x-session-id'] || 'session-global';

        // Validate prompt
        if (!prompt) {
            return res.status(400).json({
                error: "Prompt is required"
            });
        }

        // Detect prompt injection
        const injectionAnalysis = detectPromptInjection(prompt);
        console.log("Injection Analysis:", injectionAnalysis);

        if (injectionAnalysis.injectionDetected) {
            return res.status(403).json({
                success: false,
                message: "Prompt Injection Attempt Detected",
                detectedPatterns: injectionAnalysis.detectedPatterns
            });
        }

        // Detect risk
        const riskAnalysis = detectRisk(prompt);
        console.log("Risk Analysis:", riskAnalysis);

        if (riskAnalysis.riskScore >= BLOCK_THRESHOLD) {
            return res.status(403).json({
                success: false,
                message: "Prompt blocked due to sensitive data",
                riskScore: riskAnalysis.riskScore,
                detected: riskAnalysis.detected
            });
        }

        // Mask sensitive data (Regex + Local LLM dual-layer engine)
        const sanitizedPrompt = await maskSensitiveData(sessionId, prompt);
        console.log("Sanitized Prompt:", sanitizedPrompt);

        // Call Groq API
        const aiResponse = await callGroqAPI(sanitizedPrompt);

        // Code Analysis & Copyleft License Auditing on AI Response
        const codeBlocks = extractCodeBlocks(aiResponse);
        let copyleftDetected = false;
        let matchedLicense = "";
        let licenseSimilarity = 0.0;
        let offendingCode = "";
        
        let finalRiskScore = riskAnalysis.riskScore;
        const finalDetectedList = [...riskAnalysis.detected];

        for (const block of codeBlocks) {
            const licenseResult = analyzeLicenseRisk(block.code, block.language);
            if (licenseResult.matched) {
                copyleftDetected = true;
                matchedLicense = licenseResult.license;
                licenseSimilarity = licenseResult.similarity;
                offendingCode = block.code;

                finalRiskScore = Math.min(100, finalRiskScore + 40);
                finalDetectedList.push(`Copyleft License detected: ${licenseResult.license}`);
                break; // Flag the first matching copyleft violation
            }
        }

        // Unmask the response before sending to user (replaces [omni-*] back with real values)
        let restoredResponse = unmaskSensitiveData(sessionId, aiResponse);

        // If copyleft violations are present, append a legal warning banner
        if (copyleftDetected) {
            restoredResponse = `[⚠️ WARNING: PromptShield has detected copyleft licensed code (${matchedLicense}) within this response. Use at your own legal risk.]\n\n${restoredResponse}`;
        }

        // Create audit log with comprehensive compliance data in one write
        await AuditLog.create({
            originalPrompt: prompt,
            sanitizedPrompt: sanitizedPrompt,
            riskScore: finalRiskScore,
            detected: finalDetectedList,
            blocked: false,
            copyleftDetected: copyleftDetected,
            matchedLicense: matchedLicense,
            licenseSimilarity: licenseSimilarity,
            offendingCode: offendingCode,
            aiResponse: restoredResponse
        });

        res.json({
            success: true,
            riskScore: finalRiskScore,
            detected: finalDetectedList,
            sanitizedPrompt,
            copyleftDetected,
            matchedLicense,
            licenseSimilarity,
            aiResponse: restoredResponse
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Groq Proxy Failed"
        });
    }
};

// Mask only endpoint for external clients (like Chrome Extensions)
exports.maskOnly = async (req, res) => {
    try {
        const { prompt, sessionId } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }
        const sId = sessionId || 'session-global';
        const masked = await maskSensitiveData(sId, prompt);
        
        res.json({
            success: true,
            maskedPrompt: masked
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Unmask only endpoint for external clients (like Chrome Extensions)
exports.unmaskOnly = async (req, res) => {
    try {
        const { text, sessionId } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }
        const sId = sessionId || 'session-global';
        const unmasked = unmaskSensitiveData(sId, text);
        
        res.json({
            success: true,
            unmaskedText: unmasked
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get audit logs
exports.getLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (error) {
        console.error("Error fetching logs:", error.message);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};

// Get statistics
exports.getStats = async (req, res) => {
    try {
        // Total requests
        const totalRequests = await AuditLog.countDocuments();

        // Blocked requests
        const blockedRequests = await AuditLog.countDocuments({
            blocked: true
        });

        // Safe requests
        const safeRequests = await AuditLog.countDocuments({
            blocked: false
        });

        // Average risk score
        const logs = await AuditLog.find();

        let totalRisk = 0;
        logs.forEach((log) => {
            totalRisk += log.riskScore;
        });

        const averageRiskScore =
            logs.length > 0
                ? (totalRisk / logs.length).toFixed(2)
                : 0;

        res.json({
            totalRequests,
            blockedRequests,
            safeRequests,
            averageRiskScore
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Failed to fetch stats"
        });
    }
};
