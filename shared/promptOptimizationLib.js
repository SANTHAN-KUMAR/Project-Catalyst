const crypto = require('crypto');

let mockStats = {
  totalUsage: 0,
  accuracy: 88.0
};

const mockPrompts = {
  documentAnalysis: {
    version: 'v2',
    text: 'Analyze this document and extract key information.',
    confidence: 0.88
  },
  priceChecking: {
    version: 'v2',
    text: 'Check if the prices in this document are reasonable.',
    confidence: 0.88
  },
  ngoVerification: {
    version: 'v2',
    text: 'Verify this NGO registration document.',
    confidence: 0.88
  }
};

async function initializeDatabase() {
  console.log('[Prompt Optimization] Running in mock mode (no database)');
  return true;
}

function getActivePrompt(category) {
  return mockPrompts[category] || mockPrompts.documentAnalysis;
}

function createInputHash(input) {
  const data = typeof input === 'string' ? input : JSON.stringify(input);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function logPromptUsage(promptVersion, inputHash, resultSummary) {
  mockStats.totalUsage++;
  return true;
}

async function submitFeedback(inputHash, feedbackType, details) {
  return true;
}

async function getPromptAccuracy() {
  return mockStats.accuracy + (Math.random() * 5);
}

module.exports = {
  initializeDatabase,
  getActivePrompt,
  createInputHash,
  logPromptUsage,
  submitFeedback,
  getPromptAccuracy
};
