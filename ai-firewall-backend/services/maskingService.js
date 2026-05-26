function maskSensitiveData(prompt) {
    let SanitizedPrompt = prompt;
    SanitizedPrompt = SanitizedPrompt.replace(/\S+@\S+\.\S+/g, "[Email masked]");
    SanitizedPrompt = SanitizedPrompt.replace(/\b\d{10}\b/g, "[Phone masked]");
    SanitizedPrompt = SanitizedPrompt.replace(/password/gi, "[Password masked]");
    return SanitizedPrompt;
}

module.exports = maskSensitiveData;
