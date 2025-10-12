const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const postgresPool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: 'postgres',
  database: 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

// Prompt version registry
const promptRegistry = {
  verification: {
    currentVersion: 'v2',
    versions: {}
  },
  documentAnalysis: {
    currentVersion: 'v2',
    versions: {}
  },
  priceChecking: {
    currentVersion: 'v2',
    versions: {}
  },
  impactAssessment: {
    currentVersion: 'v1',
    versions: {}
  }
};

/**
 * Initialize prompt system with versioned templates
 */
async function initializePrompts() {
  console.log('[Prompt Optimization] Loading prompt templates...');

  // Verification Agent Prompts
  promptRegistry.verification.versions['v1'] = {
    template: `Extract NGO registration details from this document.
Return JSON with: registrationNumber, ngoName, isValid, confidence.`,
    created: '2025-01-01',
    accuracy: 0.75
  };

  promptRegistry.verification.versions['v2'] = {
    template: `You are an expert legal document analyst specializing in Indian NGO registrations.

Analyze the provided document and extract:
1. **Registration Number**: Exact alphanumeric code
2. **NGO Name**: Official registered name
3. **Registration Authority**: Which government body issued this
4. **Validity**: Check if document appears authentic

Return ONLY JSON:
{
  "registrationNumber": "string",
  "ngoName": "string",
  "authority": "string",
  "isValid": boolean,
  "confidence": 0.0-1.0,
  "redFlags": ["flag1", "flag2"]
}

Red flags include:
- Blurry or edited document
- Invalid registration format
- Inconsistent information
- Missing official seals/signatures`,
    created: '2025-10-11',
    accuracy: 0.88,
    improvements: [
      'Added authority extraction',
      'Added red flag detection',
      'Improved JSON structure'
    ]
  };

  // Document Analysis Prompts
  promptRegistry.documentAnalysis.versions['v1'] = {
    template: `Analyze this document for fraud indicators.
Return JSON with summary, riskScore, fraudFlags.`,
    created: '2025-01-01',
    accuracy: 0.72
  };

  promptRegistry.documentAnalysis.versions['v2'] = {
    template: `You are a forensic document analyst for financial fraud detection.

Analyze this document for authenticity and fraud indicators:

1. **Visual Analysis**:
   - Check for image manipulation (blurring, copy-paste artifacts)
   - Verify watermarks and official stamps
   - Look for consistent formatting

2. **Content Analysis**:
   - Extract all financial amounts
   - Identify suspicious patterns (round numbers, unrealistic prices)
   - Check for logical inconsistencies

Return ONLY JSON:
{
  "summary": "brief description",
  "documentType": "invoice|receipt|report|other",
  "riskScore": 0.0-1.0,
  "fraudFlags": ["specific issues"],
  "extractedData": {
    "amounts": [{"item": "name", "value": number}],
    "dates": ["date1", "date2"],
    "entities": ["company1", "company2"]
  },
  "confidence": 0.0-1.0
}

Risk Score Scale:
- 0.0-0.3: Low risk, appears authentic
- 0.3-0.7: Medium risk, some concerns
- 0.7-1.0: High risk, likely fraudulent`,
    created: '2025-10-11',
    accuracy: 0.85,
    improvements: [
      'Added visual analysis criteria',
      'Structured extracted data',
      'Clear risk scoring guidelines'
    ]
  };

  // Price Checking Prompts
  promptRegistry.priceChecking.versions['v1'] = {
    template: `Extract line items and check if prices are reasonable.
Return JSON with lineItems array.`,
    created: '2025-01-01',
    accuracy: 0.70
  };

  promptRegistry.priceChecking.versions['v2'] = {
    template: `You are a procurement auditor with expertise in Indian market prices.

Analyze this invoice/receipt and evaluate pricing:

1. **Extract all line items** with:
   - Item name (exact as written)
   - Quantity
   - Unit price
   - Total price

2. **Price Validation**:
   - Compare against typical Indian market rates
   - Flag items >50% above market average
   - Identify bulk order discounts (should be present)
   - Check for hidden charges

Return ONLY JSON:
{
  "lineItems": [
    {
      "itemName": "string",
      "quantity": number,
      "unit": "kg|ltr|pieces",
      "unitPrice": number,
      "totalPrice": number,
      "marketAvgPrice": number,
      "priceDeviation": percentage,
      "isOverpriced": boolean,
      "notes": "explanation"
    }
  ],
  "totalAmount": number,
  "overallAssessment": "fair|questionable|suspicious",
  "confidence": 0.0-1.0
}

Context: Indian NGO procurement for charitable activities.
Be strict with pricing anomalies.`,
    created: '2025-10-11',
    accuracy: 0.82,
    improvements: [
      'Added market price comparison',
      'Structured line item extraction',
      'Context-aware assessment'
    ]
  };

  // Impact Assessment Prompt (already defined in earlier code)
  promptRegistry.impactAssessment.versions['v1'] = {
    template: `Extract impact metrics from progress report.
Return JSON with beneficiaries, outcomes, impactScore.`,
    created: '2025-10-11',
    accuracy: 0.80
  };

  console.log('[Prompt Optimization] Prompt templates loaded successfully');
}

/**
 * Get active prompt for a specific agent
 */
function getActivePrompt(agentType) {
  const agent = promptRegistry[agentType];
  if (!agent) {
    throw new Error(`Unknown agent type: ${agentType}`);
  }

  const currentVersion = agent.currentVersion;
  const prompt = agent.versions[currentVersion];

  if (!prompt) {
    throw new Error(`Prompt version ${currentVersion} not found for ${agentType}`);
  }

  return {
    template: prompt.template,
    version: currentVersion,
    accuracy: prompt.accuracy || 0
  };
}

/**
 * Log prompt usage for analytics
 */
async function logPromptUsage(agentType, promptVersion, inputHash, outputData, executionTime) {
  try {
    await postgresPool.query(
      `INSERT INTO prompt_usage_logs 
       (agent_type, prompt_version, input_hash, output_data, execution_time, logged_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [agentType, promptVersion, inputHash, JSON.stringify(outputData), executionTime]
    );
  } catch (error) {
    console.error('[Prompt Optimization] Failed to log usage:', error);
  }
}

/**
 * Record prompt accuracy feedback
 */
async function recordPromptFeedback(agentType, promptVersion, inputHash, wasCorrect, feedbackNotes) {
  try {
    await postgresPool.query(
      `INSERT INTO prompt_feedback 
       (agent_type, prompt_version, input_hash, was_correct, feedback_notes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [agentType, promptVersion, inputHash, wasCorrect, feedbackNotes]
    );

    console.log(`[Prompt Optimization] Feedback recorded: ${agentType} ${promptVersion} - ${wasCorrect ? 'Correct' : 'Incorrect'}`);
  } catch (error) {
    console.error('[Prompt Optimization] Failed to record feedback:', error);
  }
}

/**
 * Calculate prompt accuracy based on feedback
 */
async function calculatePromptAccuracy(agentType, promptVersion) {
  try {
    const result = await postgresPool.query(
      `SELECT 
        COUNT(*) as total_uses,
        COUNT(CASE WHEN was_correct = true THEN 1 END) as correct_uses
       FROM prompt_feedback
       WHERE agent_type = $1 AND prompt_version = $2`,
      [agentType, promptVersion]
    );

    const stats = result.rows[0];
    const accuracy = stats.total_uses > 0
      ? (stats.correct_uses / stats.total_uses)
      : 0;

    return {
      agentType,
      promptVersion,
      totalUses: parseInt(stats.total_uses),
      correctUses: parseInt(stats.correct_uses),
      accuracy: parseFloat(accuracy.toFixed(3))
    };
  } catch (error) {
    console.error('[Prompt Optimization] Failed to calculate accuracy:', error);
    return null;
  }
}

/**
 * Auto-suggest prompt improvements using AI
 */
async function suggestPromptImprovements(agentType) {
  try {
    // Get recent failures
    const failures = await postgresPool.query(
      `SELECT input_hash, feedback_notes
       FROM prompt_feedback
       WHERE agent_type = $1 AND was_correct = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [agentType]
    );

    if (failures.rows.length === 0) {
      return { message: 'No improvement suggestions - prompt performing well' };
    }

    // Analyze failure patterns with AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const currentPrompt = getActivePrompt(agentType);
    const failureNotes = failures.rows.map(f => f.feedback_notes).join('\n- ');

    const metaPrompt = `You are a prompt engineering expert.

Current prompt template:
${currentPrompt.template}

Recent failure feedback:
- ${failureNotes}

Analyze the failures and suggest specific improvements to the prompt template to address these issues.
Focus on:
1. Clarity and specificity
2. Output format consistency
3. Edge case handling
4. Context enhancement

Provide 3-5 concrete suggestions.`;

    const result = await model.generateContent(metaPrompt);
    const suggestions = result.response.text();

    return {
      agentType,
      currentVersion: currentPrompt.version,
      currentAccuracy: currentPrompt.accuracy,
      failureCount: failures.rows.length,
      suggestions
    };

  } catch (error) {
    console.error('[Prompt Optimization] Failed to generate suggestions:', error);
    return { error: error.message };
  }
}

/**
 * A/B test two prompt versions
 */
async function runPromptABTest(agentType, versionA, versionB, testDuration = 7) {
  try {
    await postgresPool.query(
      `INSERT INTO prompt_ab_tests 
       (agent_type, version_a, version_b, start_date, end_date, status)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${testDuration} days', 'active')`,
      [agentType, versionA, versionB]
    );

    console.log(`[Prompt Optimization] A/B test started: ${agentType} (${versionA} vs ${versionB})`);

    return {
      message: 'A/B test initiated',
      agentType,
      versions: [versionA, versionB],
      duration: `${testDuration} days`
    };
  } catch (error) {
    console.error('[Prompt Optimization] Failed to start A/B test:', error);
    return { error: error.message };
  }
}

module.exports = {
  initializePrompts,
  getActivePrompt,
  logPromptUsage,
  recordPromptFeedback,
  calculatePromptAccuracy,
  suggestPromptImprovements,
  runPromptABTest
};
