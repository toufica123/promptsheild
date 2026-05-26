const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({

    originalPrompt: {
        type: String,
        required: true
    },

    sanitizedPrompt: {
        type: String,
        required: true
    },

    riskScore: {
        type: Number,
        required: true
    },

    detected: {
        type: [String],
        default: []
    },

    blocked: {
        type: Boolean,
        default: false
    },

    copyleftDetected: {
        type: Boolean,
        default: false
    },

    matchedLicense: {
        type: String,
        default: ""
    },

    licenseSimilarity: {
        type: Number,
        default: 0.0
    },

    offendingCode: {
        type: String,
        default: ""
    },

    aiResponse: {
        type: String,
        default: ""
    },

    timestamp: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("AuditLog", auditLogSchema);