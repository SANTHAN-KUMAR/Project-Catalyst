const { Pool } = require('pg');

const cockroachPool = new Pool({
  user: 'root',
  host: 'cockroachdb',
  database: 'defaultdb',
  port: 26257,
});

async function processAuditTrailEvents() {
  let client;
  try {
    client = await cockroachPool.connect();
    
    // Simple direct query - no table check
    const result = await client.query(
      "SELECT * FROM audit_trail WHERE timestamp > now() - INTERVAL '1 minute' ORDER BY timestamp DESC LIMIT 100"
    );

    if (result.rows.length > 0) {
      console.log(`[Smart Contract] Processing ${result.rows.length} events`);
      
      for (const event of result.rows) {
        switch (event.event_type) {
          case 'LEGAL_DOC_VERIFIED':
            console.log('[Smart Contract] NGO verification event detected');
            break;
          case 'DONATION_CREATED':
            console.log('[Smart Contract] Donation event detected');
            break;
          case 'PROOF_UPLOADED':
            console.log('[Smart Contract] Proof upload event detected');
            break;
        }
      }
    }
  } catch (error) {
    // Silent - only log real errors
    if (!error.message.includes('does not exist') && !error.message.includes('relation')) {
      console.error('[Smart Contract] Error:', error.message);
    }
  } finally {
    if (client) client.release();
  }
}

function startSmartContractProcessor() {
  console.log('[Smart Contract Processor] Starting background service...');
  
  setTimeout(() => {
    console.log('[Smart Contract Processor] Initial run');
    processAuditTrailEvents();
    setInterval(processAuditTrailEvents, 30000);
  }, 15000);
}

module.exports = { startSmartContractProcessor };
