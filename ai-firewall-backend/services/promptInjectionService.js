function detectPromptInjection(prompt) {

    const injectionPatterns = [

        "ignore previous instructions",

        "bypass security",

        "reveal system prompt",

        "forget previous rules",

        "act as administrator",

        "disable safety",

        "jailbreak",

        "developer mode",

        "you are no longer bound",

        "reveal confidential",

        "show hidden instructions"

    ];

    let detected = [];

    let riskScore = 0;

    const lowerPrompt = prompt.toLowerCase();

    injectionPatterns.forEach((pattern) => {

        if (lowerPrompt.includes(pattern)) {

            detected.push(pattern);

            riskScore += 40;
        }

    });

    return {

        injectionDetected: detected.length > 0,

        detectedPatterns: detected,

        injectionRiskScore: riskScore

    };

}

module.exports = detectPromptInjection;