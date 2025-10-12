const crypto = require('crypto');
const auditService = require('./auditTrailService');

function createHash(record) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(record));
  return hash.digest('hex');
}

async function verifyChainIntegrity() {
  const client = await auditService.cockroachPool.connect();
  
  try {
    const result = await client.query(
      'SELECT * FROM defaultdb.audit_trail ORDER BY timestamp ASC'
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
        details: record.details,
        previousHash: record.previous_hash,
      };
      
      const expectedHash = createHash(recordToHash);
      
      if (expectedHash !== record.current_hash) {
        console.error(`[Chain Validator] INTEGRITY BREACH at record ${record.id}`);
        return { valid: false, corruptedRecordId: record.id };
      }
      
      // Check previous hash linkage
      if (i > 0) {
        const previousRecord = records[i - 1];
        if (record.previous_hash !== previousRecord.current_hash) {
          console.error(`[Chain Validator] CHAIN BREAK between records ${previousRecord.id} and ${record.id}`);
          return { valid: false, breakBetween: [previousRecord.id, record.id] };
        }
      }
    }
    
    console.log(`[Chain Validator] Chain integrity verified for ${records.length} records`);
    return { valid: true, totalRecords: records.length };
    
  } finally {
    client.release();
  }
}

module.exports = { verifyChainIntegrity };
