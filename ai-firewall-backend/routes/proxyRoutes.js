const express = require("express");
const router = express.Router();
const proxyController = require("../controllers/proxyController");

// Health check
router.get("/", proxyController.getHealth);

// Chat proxy endpoint
router.post("/api/proxy/chat", proxyController.chatProxy);

// Standard utility endpoints for browser extensions
router.post("/api/proxy/mask", proxyController.maskOnly);
router.post("/api/proxy/unmask", proxyController.unmaskOnly);

// Get audit logs
router.get("/api/logs", proxyController.getLogs);

// Get statistics
router.get("/api/stats", proxyController.getStats);

module.exports = router;
