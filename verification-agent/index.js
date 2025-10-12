require('dotenv').config();

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pool } = require('pg');
const crypto = require('crypto');

// Import prompt optimization library
const promptLib = require('../shared/promptOptimizationLib');

const app = express();
app.use(express.json({ limit: '50mb' }));
const port = 3001;

// === DATABASE CONNECTIONS ===

const cockroachPool = new Pool({
  user: 'root',
  host: 'cockroachdb',
  database: 'defaultdb',
  port: 26257,
});

// PostgreSQL pool for prompt optimization
const postgresPool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
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
    console.log(`[Verification Agent - Audit Trail] Event logged: ${eventType}`);
    return currentHash;
  } catch (error) {
    console.error('[Verification Agent - Audit Trail] Failed to write event:', error);
    throw error;
  } finally {
    client.release();
  }
}

// === MAIN ENDPOINT: VERIFY DOCUMENT ===

app.post('/verify-document', async (req, res) => {
  const startTime = Date.now();
  const { fileContent, mimeType, ngoId } = req.body;

  if (!fileContent || !mimeType) {
    return res.status(400).json({ message: 'fileContent and mimeType are required.' });
  }

  try {
    console.log(`[Verification Agent] Starting document verification for NGO ${ngoId}...`);

    // === GET OPTIMIZED PROMPT ===
    const promptData = promptLib.getActivePrompt('verification');
    console.log(`[Verification Agent] Using prompt version: ${promptData.version} (accuracy: ${promptData.accuracy})`);

    // Create input hash for tracking
    const inputHash = promptLib.createInputHash(fileContent.substring(0, 1000));
    console.log(`[Verification Agent] Generated inputHash: ${inputHash.substring(0, 16)}...`);

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

    console.log('[Verification Agent] Calling Gemini API...');
    const result = await model.generateContent(aiInput);
    const responseText = result.response.text();

    // Parse AI response
    let verificationData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      verificationData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      console.error('[Verification Agent] JSON parsing failed:', parseError);
      
      // Log parsing failure (WITH postgresPool parameter)
      await promptLib.logPromptUsage(
        postgresPool, // ⭐ ADDED
        'verification',
        promptData.version,
        inputHash,
        { error: 'JSON parsing failed', rawResponse: responseText },
        Date.now() - startTime,
        0.0
      );
      
      return res.status(500).json({ 
        message: 'AI returned invalid format',
        rawResponse: responseText,
        inputHash: inputHash
      });
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Verification Agent] Verification completed in ${executionTime}ms`);

    // === LOG PROMPT USAGE (WITH postgresPool parameter) ===
    await promptLib.logPromptUsage(
      postgresPool, // ⭐ ADDED
      'verification',
      promptData.version,
      inputHash,
      verificationData,
      executionTime,
      verificationData.confidence || 0.5
    );

    // === LOG TO BLOCKCHAIN ===
    await writeAuditEvent(
      'LEGAL_DOC_VERIFIED',
      'verification-agent',
      `ngo-${ngoId}`,
      {
        registrationNumber: verificationData.registrationNumber,
        ngoName: verificationData.ngoName,
        isValid: verificationData.isValid,
        confidence: verificationData.confidence,
        redFlags: verificationData.redFlags || [],
        promptVersion: promptData.version,
        executionTime: executionTime,
        inputHash: inputHash
      }
    );

    // === ADD METADATA TO RESPONSE (INCLUDING inputHash) ===
    verificationData.ngoId = ngoId;
    verificationData.verifiedAt = new Date().toISOString();
    verificationData.promptVersion = promptData.version;
    verificationData.executionTime = executionTime;
    verificationData.inputHash = inputHash;

    console.log(`[Verification Agent] Returning response with inputHash: ${inputHash.substring(0, 16)}...`);

    res.status(200).json(verificationData);

  } catch (error) {
    console.error('[Verification Agent] Error during verification:', error);
    res.status(500).json({ 
      message: 'Document verification failed',
      error: error.message 
    });
  }
});

// === ENDPOINT: SUBMIT FEEDBACK ON VERIFICATION ===

app.post('/verify-document/feedback', async (req, res) => {
  const { inputHash, wasCorrect, feedbackNotes, promptVersion } = req.body;

  if (!inputHash || wasCorrect === undefined) {
    return res.status(400).json({ 
      message: 'inputHash and wasCorrect are required' 
    });
  }

  try {
    // WITH postgresPool parameter
    const result = await promptLib.recordPromptFeedback(
      postgresPool, // ⭐ ADDED
      'verification',
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
    console.error('[Verification Agent] Error recording feedback:', error);
    res.status(500).json({ message: 'Failed to record feedback' });
  }
});

// === ENDPOINT: GET PROMPT PERFORMANCE STATS ===

app.get('/stats/prompt-performance', async (req, res) => {
  try {
    // WITH postgresPool parameter
    const stats = await promptLib.getPromptStats(
      postgresPool, // ⭐ ADDED
      'verification'
    );

    res.status(200).json({
      agentType: 'verification',
      statistics: stats
    });

  } catch (error) {
    console.error('[Verification Agent] Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

// === HEALTH CHECK ===

app.get('/health', (req, res) => {
  try {
    const promptData = promptLib.getActivePrompt('verification');
    
    res.json({ 
      status: 'healthy',
      service: 'Verification Agent',
      promptVersion: promptData.version,
      promptAccuracy: promptData.accuracy,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// === STARTUP ===

app.listen(port, async () => {
  console.log(`Verification Agent listening on port ${port}`);
  console.log('=== Prompt Optimization Enabled ===');
  
  try {
    // Initialize database tables (WITH postgresPool parameter)
    const dbInit = await promptLib.initializeDatabase(postgresPool); // ⭐ ADDED postgresPool
    if (dbInit) {
      console.log('✓ Prompt tracking database: READY');
    }
    
    const promptData = promptLib.getActivePrompt('verification');
    console.log(`✓ Active prompt version: ${promptData.version}`);
    console.log(`✓ Prompt accuracy: ${(promptData.accuracy * 100).toFixed(1)}%`);
    console.log('=============================');
  } catch (error) {
    console.error('❌ Startup error:', error.message);
    console.error('Agent will continue but may have limited functionality');
  }
});
