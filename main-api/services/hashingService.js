const crypto = require('crypto');

// Creates a SHA256 hash from a record's data
function createHash(record) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(record));
  return hash.digest('hex');
}

// Connects to the database and fetches the most recent hash
async function getLastHash(dbPool) {
  const client = await dbPool.connect();
  try {
    const result = await client.query('SELECT current_hash FROM defaultdb.audit_trail ORDER BY timestamp DESC LIMIT 1');
    if (result.rows.length > 0) {
      return result.rows[0].current_hash;
    }
    // This is the "genesis block" hash if the table is empty
    return '0000000000000000000000000000000000000000000000000000000000000000';
  } finally {
    client.release();
  }
}

module.exports = { createHash, getLastHash };
