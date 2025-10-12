require('dotenv').config();

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pool } = require('pg');
const crypto = require('crypto');

// Import prompt optimization library
const promptLib = require('../shared/promptOptimizationLib');

const app = express();
app.use(express.json({ limit: '50mb' }));
const port = 3002;

// === DATABASE CONNECTIONS ===

const cockroachPool = new Pool({
  user: 'root',
  host: 'cockroachdb',
  database: 'defaultdb',
  port: 26257,
});

// === GEMINI API INITIALIZATION ===
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// === BLOCKCHAIN HASHING FUNCTIONS ===

function createHash(record) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(record));
  return hash.digest('hex');
}

async function getLastHash() {
  const client = await cockroachPool.connect();
  try {
    const result = await client.query(
      'SELECT current_hash FROM defaultdb.audit_trail ORDER BY timestamp DESC LIMIT 1'
    );
    if (result.rows.length > 0 && result.rows[0].current_hash) {
      return result.rows[0].current_hash;
    }
    return '0000000000000000000000000000000000000000000000000000000000000000';
  } finally {
    client.release();
  }
}

async function writeAuditEvent(eventType, actorId, targetId, details) {
  const previousHash = await getLastHash();
  const timestamp = new Date().toISOString();
  
  const recordToHash = {
    timestamp,
    eventType,
    actorId,
    targetId,
    details,
    previousHash,
  };
  
  const currentHash = createHash(recordToHash);
  
  const client = await cockroachPool.connect();
  try {
    await client.query(
      `INSERT INTO defaultdb.audit_trail 
       (event_type, actor_id, target_id, details, previous_hash, current_hash, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [eventType, actorId, targetId, JSON.stringify(details), previousHash, currentHash, timestamp]
    );
    console.log(`[Price Checking Agent - Audit Trail] Event logged: ${eventType}`);
    return currentHash;
  } catch (error) {
    console.error('[Price Checking Agent - Audit Trail] Failed to write event:', error);
    throw error;
  } finally {
    client.release();
  }
}

// === MAIN ENDPOINT: CHECK PRICES ===

app.post('/check-price', async (req, res) => {
  const startTime = Date.now();
  const { fileContent, mimeType, documentSummary, originalFilePath } = req.body;

  if (!fileContent || !mimeType) {
    return res.status(400).json({ message: 'fileContent and mimeType are required.' });
  }

  try {
    console.log('[Price Checking Agent] Starting price analysis...');

    // === GET OPTIMIZED PROMPT ===
    const promptData = promptLib.getActivePrompt('priceChecking');
    console.log(`[Price Checking Agent] Using prompt version: ${promptData.version} (accuracy: ${promptData.accuracy})`);

    // Create input hash for tracking
    const inputHash = promptLib.createInputHash(fileContent.substring(0, 1000));

    // === CALL GEMINI AI WITH OPTIMIZED PROMPT ===
    const aiInput = [
      promptData.template,
      documentSummary ? `\nContext from previous analysis: ${documentSummary}\n` : '',
      {
        inlineData: {
          mimeType: mimeType,
          data: fileContent
        }
      }
    ];

    console.log('[Price Checking Agent] Calling Gemini API...');
    const result = await model.generateContent(aiInput);
    const responseText = result.response.text();

    // Parse AI response
    let priceData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      priceData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      console.error('[Price Checking Agent] JSON parsing failed:', parseError);
      
      // Log parsing failure
      await promptLib.logPromptUsage(
        'priceChecking',
        promptData.version,
        inputHash,
        { error: 'JSON parsing failed', rawResponse: responseText },
        Date.now() - startTime,
        0.0
      );
      
      return res.status(500).json({ 
        message: 'AI returned invalid format',
        rawResponse: responseText 
      });
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Price Checking Agent] Price check completed in ${executionTime}ms`);

    // === LOG PROMPT USAGE ===
    await promptLib.logPromptUsage(
      'priceChecking',
      promptData.version,
      inputHash,
      priceData,
      executionTime,
      priceData.confidence || 0.5
    );

    // === LOG TO BLOCKCHAIN ===
    const overpricedItems = priceData.lineItems?.filter(item => item.isOverpriced) || [];
    
    await writeAuditEvent(
      'PRICE_CHECK_COMPLETE',
      'price-checking-agent',
      originalFilePath || 'unknown-invoice',
      {
        totalAmount: priceData.totalAmount,
        expectedAmount: priceData.expectedAmount,
        overallDeviation: priceData.overallDeviation,
        overallAssessment: priceData.overallAssessment,
        overpricedItemsCount: overpricedItems.length,
        redFlags: priceData.redFlags || [],
        confidence: priceData.confidence,
        promptVersion: promptData.version,
        executionTime: executionTime
      }
    );

    // Add metadata to response
    priceData.analyzedAt = new Date().toISOString();
    priceData.promptVersion = promptData.version;
    priceData.executionTime = executionTime;
    priceData.inputHash = inputHash; // For feedback submission

    res.status(200).json(priceData);

  } catch (error) {
    console.error('[Price Checking Agent] Error during price check:', error);
    res.status(500).json({ 
      message: 'Price check failed',
      error: error.message 
    });
  }
});

// === ENDPOINT: SUBMIT FEEDBACK ===

app.post('/check-price/feedback', async (req, res) => {
  const { inputHash, wasCorrect, feedbackNotes, promptVersion } = req.body;

  if (!inputHash || wasCorrect === undefined) {
    return res.status(400).json({ 
      message: 'inputHash and wasCorrect are required' 
    });
  }

  try {
    const result = await promptLib.recordPromptFeedback(
      'priceChecking',
      promptVersion || 'v2',
      inputHash,
      wasCorrect,
      feedbackNotes
    );

    res.status(200).json({
      message: 'Feedback recorded successfully',
      result
    });

  } catch (error) {
    console.error('[Price Checking Agent] Error recording feedback:', error);
    res.status(500).json({ message: 'Failed to record feedback' });
  }
});

// === ENDPOINT: GET PROMPT PERFORMANCE STATS ===

app.get('/stats/prompt-performance', async (req, res) => {
  try {
    const stats = await promptLib.getPromptStats('priceChecking');

    res.status(200).json({
      agentType: 'priceChecking',
      statistics: stats
    });

  } catch (error) {
    console.error('[Price Checking Agent] Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

// === HEALTH CHECK ===

app.get('/health', (req, res) => {
  const promptData = promptLib.getActivePrompt('priceChecking');
  
  res.json({ 
    status: 'healthy',
    service: 'Price Checking Agent',
    promptVersion: promptData.version,
    promptAccuracy: promptData.accuracy,
    timestamp: new Date().toISOString() 
  });
});

// === STARTUP ===

app.listen(port, async () => {
  console.log(`Price Checking Agent listening on port ${port}`);
  console.log('=== Prompt Optimization Enabled ===');
  
  // Initialize database tables
  const dbInit = await promptLib.initializeDatabase();
  if (dbInit) {
    console.log('✓ Prompt tracking database: READY');
  }
  
  const promptData = promptLib.getActivePrompt('priceChecking');
  console.log(`✓ Active prompt version: ${promptData.version}`);
  console.log(`✓ Prompt accuracy: ${(promptData.accuracy * 100).toFixed(1)}%`);
  console.log('=============================');
});
