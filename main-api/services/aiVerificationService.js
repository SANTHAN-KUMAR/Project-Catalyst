const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const { Pool } = require('pg');

// CockroachDB Pool for the audit ledger
const cockroachPool = new Pool({
  user: 'root',
  host: 'cockroachdb',
  database: 'defaultdb',
  port: 26257,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// === BLOCKCHAIN HASHING FUNCTIONS WITH LOCKING ===

function createHash(record) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(record));
  return hash.digest('hex');
}

/**
 * Writes an event to the CockroachDB ledger.
 * Uses a basic advisory lock or transaction isolation to prevent race conditions
 * where two concurrent requests read the same previous_hash.
 */
async function writeAuditEvent(eventType, actorId, targetId, details) {
  const client = await cockroachPool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // In CockroachDB, high isolation prevents write skews natively, but we can do a FOR UPDATE
    // on a singleton control row if we had one. Instead, we'll just read the latest inside the transaction
    // which Cockroach's serializable isolation will protect.
    const result = await client.query(
      'SELECT current_hash FROM defaultdb.audit_trail ORDER BY timestamp DESC LIMIT 1'
    );
    
    const previousHash = (result.rows.length > 0 && result.rows[0].current_hash) 
      ? result.rows[0].current_hash 
      : '0000000000000000000000000000000000000000000000000000000000000000';
      
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
    
    await client.query(
      `INSERT INTO defaultdb.audit_trail 
       (event_type, actor_id, target_id, details, previous_hash, current_hash, timestamp) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [eventType, actorId, targetId, JSON.stringify(details), previousHash, currentHash, timestamp]
    );
    
    await client.query('COMMIT');
    console.log(`[Audit Trail] Event logged safely: ${eventType}`);
    return currentHash;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Audit Trail] Failed to write event:', error);
    throw error;
  } finally {
    client.release();
  }
}

// === AI DOC VERIFICATION LOGIC ===

async function verifyDocument(fileContent, mimeType, ngoId) {
    console.log(`[Verification Agent] Starting document verification for NGO ${ngoId}...`);

    const promptTemplate = `
      You are a strict, objective verification agent for a philanthropic trust engine.
      Analyze the provided document (receipt, invoice, or registration certificate).
      
      Extract the following information and RETURN IT STRICTLY AS A JSON OBJECT.
      Do NOT wrap the JSON in markdown blocks (like \`\`\`json). Just return the raw JSON object.
      
      {
        "isValid": true/false, // True if the document appears to be a legitimate expense/registration
        "confidence": 0.0 to 1.0, // Your confidence in the analysis
        "ngoName": "Extracted NGO or vendor Name",
        "registrationNumber": "Extracted ID/Number if any, or null",
        "date": "Extracted date if any",
        "totalAmount": "Total amount if receipt, or null",
        "redFlags": ["Reason 1 why this might be fake", "Reason 2"] // Empty array if perfectly valid
      }
    `;

    const aiInput = [
      promptTemplate,
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

    // Parse AI response safely
    let verificationData;
    try {
      // Find the first { and last } to strip out markdown conversational text
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
          throw new Error("No JSON structure found in response");
      }
      
      const jsonString = responseText.substring(firstBrace, lastBrace + 1);
      verificationData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('[Verification Agent] JSON parsing failed entirely for AI response:', responseText);
      throw new Error(`AI generated invalid response format that could not be parsed. Error: ${parseError.message}`);
    }

    // Log to Blockchain safely
    await writeAuditEvent(
      'LEGAL_DOC_VERIFIED',
      'core-verification-agent',
      `ngo-${ngoId}`,
      {
        ...verificationData,
        verifiedAt: new Date().toISOString()
      }
    );

    verificationData.ngoId = ngoId;
    return verificationData;
}

module.exports = {
    verifyDocument,
    writeAuditEvent
};
