const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

const logAuditTrailEvent = async (eventType, entityId, metadata = {}) => {
  try {
    const eventData = {
      eventType,
      entityId,
      timestamp: new Date().toISOString(),
      metadata
    };

    const eventHash = hashData(JSON.stringify(eventData));

    await pool.query(
      'INSERT INTO audit_trail (event_type, entity_id, event_hash, metadata, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [eventType, entityId, eventHash, JSON.stringify(metadata)]
    );

    console.log(`[Audit Trail] ✓ Event logged: ${eventType} for ${entityId}`);
    return eventHash;
  } catch (error) {
    console.error('[Audit Trail] Error:', error.message);
    return null;
  }
};

module.exports = {
  logAuditTrailEvent
};
