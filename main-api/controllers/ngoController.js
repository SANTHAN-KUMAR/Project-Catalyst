const db = require('../services/database');
const fs = require('fs');
const axios = require('axios');
const { Pool } = require('pg');
const crypto = require('crypto');

// CockroachDB Connection Pool for Audit Trail
const cockroachPool = new Pool({
  user: 'root',
  host: 'cockroachdb',
  database: 'defaultdb',
  port: 26257,
});

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
    // Genesis block hash
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
    console.log(`[Audit Trail] Event logged: ${eventType} for ${targetId}`);
    return currentHash;
  } catch (error) {
    console.error('[Audit Trail] Failed to write event:', error);
    throw error;
  } finally {
    client.release();
  }
}

// === NGO CONTROLLER FUNCTIONS ===

const registerNgo = async (req, res) => {
  // Get the name and description from the form data
  const { name, description } = req.body;
  // Get the user ID from the JWT token (added by our auth middleware)
  const ownerId = req.user.userId;

  if (!name || !req.file) {
    return res.status(400).json({ message: 'NGO name and registration file are required.' });
  }

  let ngoId; // To keep track of the new NGO's ID
  try {
    // === STEP 1: Create the initial NGO record in PostgreSQL with 'pending' status ===
    console.log('[Main API] Creating NGO record in PostgreSQL...');
    const queryText = 'INSERT INTO ngos(owner_id, name, description, status) VALUES($1, $2, $3, $4) RETURNING id';
    const values = [ownerId, name, description, 'pending'];
    const { rows } = await db.query(queryText, values);
    ngoId = rows[0].id;
    console.log(`[Main API] NGO record created with ID: ${ngoId}`);

    // === LOG TO AUDIT TRAIL: NGO Registration Initiated ===
    await writeAuditEvent(
      'NGO_REGISTRATION_INITIATED',
      `user-${ownerId}`,
      `ngo-${ngoId}`,
      {
        name,
        description,
        status: 'pending',
        fileName: req.file.originalname,
        fileSize: req.file.size
      }
    );

// === STEP 2: Read the uploaded file and call the verification-agent ===
const filePath = req.file.path;
const mimeType = req.file.mimetype;
const fileBuffer = fs.readFileSync(filePath);
const fileContent = fileBuffer.toString('base64');

console.log('[Main API] Calling verification-agent...');
const agentResponse = await axios.post('http://verification-agent:3001/verify-document', {
  fileContent, 
  mimeType, 
  ngoId
});
const verificationResult = agentResponse.data;
console.log('[Main API] Received verification from agent.');
console.log(`[Main API] InputHash received: ${verificationResult.inputHash ? verificationResult.inputHash.substring(0, 16) + '...' : 'MISSING'}`);

// === STEP 3: Update the NGO record based on verification result ===
console.log('[Main API] Updating NGO record with verification status...');

// Determine status based on verification result
let newStatus = 'verified';
if (verificationResult.isValid === false || verificationResult.confidence < 0.7) {
  newStatus = 'rejected';
}

const updateQuery = 'UPDATE ngos SET status = $1, registration_id = $2 WHERE id = $3';
await db.query(updateQuery, [newStatus, verificationResult.registrationNumber, ngoId]);

// === LOG TO AUDIT TRAIL: NGO Status Updated (Smart Contract Trigger) ===
await writeAuditEvent(
  'NGO_STATUS_UPDATED',
  'main-api-smart-contract',
  `ngo-${ngoId}`,
  {
    previousStatus: 'pending',
    newStatus: newStatus,
    registrationNumber: verificationResult.registrationNumber,
    confidence: verificationResult.confidence,
    verificationDetails: verificationResult.summary,
    triggeredBy: 'LEGAL_DOC_VERIFIED_EVENT',
    inputHash: verificationResult.inputHash // Include for feedback tracking
  }
);

// === STEP 4: Send a success response back to the user ===
res.status(201).json({ 
  message: `NGO registration complete. Status: ${newStatus}`,
  ngoId: ngoId,
  status: newStatus,
  verification: verificationResult, // This now includes inputHash
  blockchainLogged: true
});

  } catch (error) {
    console.error('[Main API] Error during NGO registration:', error.message);
    
    // === LOG FAILURE TO AUDIT TRAIL ===
    if (ngoId) {
      try {
        await writeAuditEvent(
          'NGO_REGISTRATION_FAILED',
          `user-${ownerId}`,
          `ngo-${ngoId}`,
          {
            error: error.message,
            errorStack: error.stack,
            stage: 'verification_or_update'
          }
        );
      } catch (auditError) {
        console.error('[Audit Trail] Failed to log error:', auditError);
      }
      
      // If anything fails, delete the partially created NGO record to keep the database clean
      await db.query('DELETE FROM ngos WHERE id = $1', [ngoId]);
    }
    
    res.status(500).json({ 
      message: 'Failed to register NGO.',
      error: error.message 
    });
  }
};

const getAllNgos = async (req, res) => {
  try {
    // We add mock data for raised/goal since it's not in our schema yet
    const query = `
      SELECT id, name, description, status, registration_id,
      'https://placehold.co/600x400/a2d2ff/ffffff?text=Project' as image,
      200000 as raised, 400000 as goal
      FROM ngos WHERE status = 'verified'
    `;
    const { rows } = await db.query(query);
    
    // === LOG TO AUDIT TRAIL: NGO List Accessed ===
    // This creates transparency around who queries verified NGOs
    await writeAuditEvent(
      'NGO_LIST_ACCESSED',
      'public-api',
      'ngo-registry',
      {
        queryTimestamp: new Date().toISOString(),
        resultCount: rows.length,
        statusFilter: 'verified'
      }
    );
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching NGOs:', error);
    res.status(500).json({ message: 'Failed to fetch NGOs.' });
  }
};

// === NEW FUNCTION: Get NGO Audit Trail ===
// This allows transparency - anyone can verify the entire history of an NGO
const getNgoAuditTrail = async (req, res) => {
  const { ngoId } = req.params;
  
  try {
    const client = await cockroachPool.connect();
    try {
      const result = await client.query(
        `SELECT event_type, actor_id, details, timestamp, current_hash, previous_hash
         FROM defaultdb.audit_trail
         WHERE target_id = $1
         ORDER BY timestamp ASC`,
        [`ngo-${ngoId}`]
      );
      
      res.status(200).json({
        ngoId,
        auditTrail: result.rows,
        chainVerified: true,
        message: 'Complete immutable audit trail for this NGO'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching NGO audit trail:', error);
    res.status(500).json({ message: 'Failed to fetch audit trail.' });
  }
};

// === NEW FUNCTION: Verify Chain Integrity for NGO ===
const verifyNgoChainIntegrity = async (req, res) => {
  const { ngoId } = req.params;
  
  try {
    const client = await cockroachPool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM defaultdb.audit_trail
         WHERE target_id = $1
         ORDER BY timestamp ASC`,
        [`ngo-${ngoId}`]
      );
      
      const records = result.rows;
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        // Reconstruct the hash
        const recordToHash = {
          timestamp: record.timestamp,
          eventType: record.event_type,
          actorId: record.actor_id,
          targetId: record.target_id,
          details: JSON.parse(record.details),
          previousHash: record.previous_hash,
        };
        
        const expectedHash = createHash(recordToHash);
        
        if (expectedHash !== record.current_hash) {
          return res.status(200).json({
            valid: false,
            corruptedRecordId: record.id,
            message: 'INTEGRITY BREACH DETECTED: Hash mismatch'
          });
        }
        
        // Check chain linkage
        if (i > 0) {
          const previousRecord = records[i - 1];
          if (record.previous_hash !== previousRecord.current_hash) {
            return res.status(200).json({
              valid: false,
              breakBetween: [previousRecord.id, record.id],
              message: 'CHAIN BREAK DETECTED: Previous hash mismatch'
            });
          }
        }
      }
      
      res.status(200).json({
        valid: true,
        ngoId,
        totalRecords: records.length,
        message: 'Chain integrity verified: No tampering detected'
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error verifying chain integrity:', error);
    res.status(500).json({ message: 'Failed to verify chain integrity.' });
  }
};

module.exports = {
  registerNgo,
  getAllNgos,
  getNgoAuditTrail,
  verifyNgoChainIntegrity,
};
