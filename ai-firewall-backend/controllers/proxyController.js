const AuditLog = require("../models/AuditLog");
const detectRisk = require("../services/riskService");
const maskSensitiveData = require("../services/maskingService");
const detectPromptInjection = require("../services/promptInjectionService");
const { callGroqAPI } = require("../services/openaiService");

const BLOCK_THRESHOLD = 80;

// Health check endpoint
exports.getHealth = (req, res) => {
    res.send("AI Proxy Server Running");
};

// Main chat proxy endpoint
exports.chatProxy = async (req, res) => {
    try {
        const { prompt } = req.body;

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

        // Mask sensitive data
        const sanitizedPrompt = maskSensitiveData(prompt);
        console.log("Sanitized Prompt:", sanitizedPrompt);

        let blocked = false;
        if (riskAnalysis.riskScore >= BLOCK_THRESHOLD) {
            blocked = true;
        }

        // Create audit log
        await AuditLog.create({
            originalPrompt: prompt,
            sanitizedPrompt: sanitizedPrompt,
            riskScore: riskAnalysis.riskScore,
            detected: riskAnalysis.detected,
            blocked: blocked
        });

        // Call Groq API
        const aiResponse = await callGroqAPI(sanitizedPrompt);

        res.json({
            success: true,
            riskScore: riskAnalysis.riskScore,
            detected: riskAnalysis.detected,
            sanitizedPrompt,
            aiResponse: aiResponse
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Groq Proxy Failed"
        });
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
