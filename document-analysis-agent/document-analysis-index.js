require('dotenv').config();

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pool } = require('pg');
const crypto = require('crypto');

// Import prompt optimization library
const promptLib = require('../shared/promptOptimizationLib');

const app = express();
app.use(express.json({ limit: '50mb' }));
const port = 3003;

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
    console.log(`[Document Analysis Agent - Audit Trail] Event logged: ${eventType}`);
    return currentHash;
  } catch (error) {
    console.error('[Document Analysis Agent - Audit Trail] Failed to write event:', error);
    throw error;
  } finally {
    client.release();
  }
}

// === MAIN ENDPOINT: ANALYZE DOCUMENT ===

app.post('/analyze', async (req, res) => {
  const startTime = Date.now();
  const { fileContent, mimeType, originalFilePath } = req.body;

  if (!fileContent || !mimeType) {
    return res.status(400).json({ message: 'fileContent and mimeType are required.' });
  }

  try {
    console.log('[Document Analysis Agent] Starting document analysis...');

    // === GET OPTIMIZED PROMPT ===
    const promptData = promptLib.getActivePrompt('documentAnalysis');
    console.log(`[Document Analysis Agent] Using prompt version: ${promptData.version} (accuracy: ${promptData.accuracy})`);

    // Create input hash for tracking
    const inputHash = promptLib.createInputHash(fileContent.substring(0, 1000));

    // === CALL GEMINI AI WITH OPTIMIZED PROMPT ===
    const aiInput = [
      promptData.template,
      {
        inlineData: {
          mimeType: mimeType,
          data: fileContent
        }
      }
    ];

    console.log('[Document Analysis Agent] Calling Gemini API...');
    const result = await model.generateContent(aiInput);
    const responseText = result.response.text();

    // Parse AI response
    let analysisData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      analysisData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      console.error('[Document Analysis Agent] JSON parsing failed:', parseError);
      
      // Log parsing failure
      await promptLib.logPromptUsage(
        'documentAnalysis',
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
    console.log(`[Document Analysis Agent] Analysis completed in ${executionTime}ms`);

    // === LOG PROMPT USAGE ===
    await promptLib.logPromptUsage(
      'documentAnalysis',
      promptData.version,
      inputHash,
      analysisData,
      executionTime,
      analysisData.confidence || 0.5
    );

    // === LOG TO BLOCKCHAIN ===
    await writeAuditEvent(
      'DOCUMENT_ANALYZED',
      'document-analysis-agent',
      originalFilePath || 'unknown-document',
      {
        documentType: analysisData.documentType,
        riskScore: analysisData.riskScore,
        fraudFlags: analysisData.fraudFlags || [],
        confidence: analysisData.confidence,
        promptVersion: promptData.version,
        executionTime: executionTime
      }
    );

    // Add metadata to response
    analysisData.analyzedAt = new Date().toISOString();
    analysisData.promptVersion = promptData.version;
    analysisData.executionTime = executionTime;
    analysisData.inputHash = inputHash; // For feedback submission

    res.status(200).json(analysisData);

  } catch (error) {
    console.error('[Document Analysis Agent] Error during analysis:', error);
    res.status(500).json({ 
      message: 'Document analysis failed',
      error: error.message 
    });
  }
});

// === ENDPOINT: SUBMIT FEEDBACK ===

app.post('/analyze/feedback', async (req, res) => {
  const { inputHash, wasCorrect, feedbackNotes, promptVersion } = req.body;

  if (!inputHash || wasCorrect === undefined) {
    return res.status(400).json({ 
      message: 'inputHash and wasCorrect are required' 
    });
  }

  try {
    const result = await promptLib.recordPromptFeedback(
      'documentAnalysis',
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
    console.error('[Document Analysis Agent] Error recording feedback:', error);
    res.status(500).json({ message: 'Failed to record feedback' });
  }
});

// === ENDPOINT: GET PROMPT PERFORMANCE STATS ===

app.get('/stats/prompt-performance', async (req, res) => {
  try {
    const stats = await promptLib.getPromptStats('documentAnalysis');

    res.status(200).json({
      agentType: 'documentAnalysis',
      statistics: stats
    });

  } catch (error) {
    console.error('[Document Analysis Agent] Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

// === HEALTH CHECK ===

app.get('/health', (req, res) => {
  const promptData = promptLib.getActivePrompt('documentAnalysis');
  
  res.json({ 
    status: 'healthy',
    service: 'Document Analysis Agent',
    promptVersion: promptData.version,
    promptAccuracy: promptData.accuracy,
    timestamp: new Date().toISOString() 
  });
});

// === STARTUP ===

app.listen(port, async () => {
  console.log(`Document Analysis Agent listening on port ${port}`);
  console.log('=== Prompt Optimization Enabled ===');
  
  // Initialize database tables
  const dbInit = await promptLib.initializeDatabase();
  if (dbInit) {
    console.log('✓ Prompt tracking database: READY');
  }
  
  const promptData = promptLib.getActivePrompt('documentAnalysis');
  console.log(`✓ Active prompt version: ${promptData.version}`);
  console.log(`✓ Prompt accuracy: ${(promptData.accuracy * 100).toFixed(1)}%`);
  console.log('=============================');
});
