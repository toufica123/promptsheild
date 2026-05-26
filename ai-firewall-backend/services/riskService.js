function detectRisk(prompt) {
    // Implementation for risk detection
    let riskScore = 0;
    let detected = [];

    const emailRegex = /\S+@\S+\.\S+/g;
    if (emailRegex.test(prompt)) {
        riskScore += 30;
        detected.push("Email Address detected");
    }

    const phoneNumberRegex = /\b\d{10}\b/g;
    if (phoneNumberRegex.test(prompt)) {
        riskScore += 50;
        detected.push("Phone Number detected");
    }

    const apiKeyRegex = /sk-[a-zA-Z0-9]+/g;
    if (apiKeyRegex.test(prompt)) {
        riskScore += 50;
        detected.push("API Key Detected");
    }

    if (prompt.toLowerCase().includes("password")) {
        riskScore += 50;
        detected.push("Password detected");
    }

    return {
        riskScore,
        detected
    };
}

module.exports = detectRisk;
