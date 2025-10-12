const { Pool } = require('pg');
const crypto = require('crypto');

const postgresPool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: 'postgres',
  database: 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

const cockroachPool = new Pool({
  user: 'root',
  host: 'cockroachdb',
  database: 'defaultdb',
  port: 26257,
});

// === BLOCKCHAIN AUDIT FUNCTIONS ===

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
    console.log(`[Admin - Audit Trail] Event logged: ${eventType}`);
    return currentHash;
  } catch (error) {
    console.error('[Admin - Audit Trail] Failed to write event:', error);
    throw error;
  } finally {
    client.release();
  }
}

// === ADMIN DASHBOARD ENDPOINTS ===

/**
 * Get all flagged items requiring human review
 */
const getFlaggedItems = async (req, res) => {
  const { type, severity, status } = req.query;
  const adminId = req.user.userId;

  try {
    let query = 'SELECT * FROM fraud_alerts WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (type) {
      query += ` AND alert_type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (severity) {
      query += ` AND severity = $${paramCount}`;
      params.push(severity);
      paramCount++;
    }

    if (status) {
      const resolved = status === 'resolved';
      query += ` AND resolved = $${paramCount}`;
      params.push(resolved);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await postgresPool.query(query, params);

    // Log admin access
    await writeAuditEvent(
      'ADMIN_FLAGGED_ITEMS_ACCESSED',
      `admin-${adminId}`,
      'fraud-alerts',
      {
        filterType: type,
        filterSeverity: severity,
        resultCount: result.rows.length
      }
    );

    res.status(200).json({
      flaggedItems: result.rows,
      totalCount: result.rows.length
    });

  } catch (error) {
    console.error('[Admin] Error fetching flagged items:', error);
    res.status(500).json({ message: 'Failed to fetch flagged items' });
  }
};

/**
 * Review and resolve a flagged item
 */
const resolveFlag = async (req, res) => {
  const { flagId } = req.params;
  const { resolution, notes, action } = req.body;
  const adminId = req.user.userId;

  if (!resolution || !action) {
    return res.status(400).json({ 
      message: 'resolution and action are required' 
    });
  }

  try {
    // Get flag details
    const flagResult = await postgresPool.query(
      'SELECT * FROM fraud_alerts WHERE id = $1',
      [flagId]
    );

    if (flagResult.rows.length === 0) {
      return res.status(404).json({ message: 'Flag not found' });
    }

    const flag = flagResult.rows[0];

    // Update flag status
    await postgresPool.query(
      `UPDATE fraud_alerts 
       SET resolved = true, 
           resolution = $1, 
           resolved_by = $2,
           resolved_at = NOW(),
           admin_notes = $3
       WHERE id = $4`,
      [resolution, adminId, notes, flagId]
    );

    // Execute action based on admin decision
    if (action === 'approve') {
      // Approve the flagged item
      if (flag.target_type === 'ngo') {
        await postgresPool.query(
          'UPDATE ngos SET status = $1 WHERE id = $2',
          ['verified', flag.target_id]
        );
      } else if (flag.target_type === 'donation') {
        await cockroachPool.query(
          'UPDATE defaultdb.donations SET status = $1 WHERE id = $2',
          ['verified', flag.target_id]
        );
      }
    } else if (action === 'reject') {
      // Reject the flagged item
      if (flag.target_type === 'ngo') {
        await postgresPool.query(
          'UPDATE ngos SET status = $1 WHERE id = $2',
          ['rejected', flag.target_id]
        );
      } else if (flag.target_type === 'donation') {
        await cockroachPool.query(
          'UPDATE defaultdb.donations SET status = $1 WHERE id = $2',
          ['rejected', flag.target_id]
        );
      }
    } else if (action === 'investigate') {
      // Flag for further investigation
      await postgresPool.query(
        `INSERT INTO fraud_alerts 
         (target_type, target_id, alert_type, severity, details, resolved)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [
          flag.target_type,
          flag.target_id,
          'REQUIRES_INVESTIGATION',
          'high',
          JSON.stringify({ escalatedBy: adminId, originalFlag: flagId, notes })
        ]
      );
    }

    // Log to blockchain
    await writeAuditEvent(
      'ADMIN_FLAG_RESOLVED',
      `admin-${adminId}`,
      `flag-${flagId}`,
      {
        flagType: flag.alert_type,
        targetType: flag.target_type,
        targetId: flag.target_id,
        resolution,
        action,
        adminNotes: notes
      }
    );

    res.status(200).json({
      message: 'Flag resolved successfully',
      flagId,
      action,
      blockchainLogged: true
    });

  } catch (error) {
    console.error('[Admin] Error resolving flag:', error);
    res.status(500).json({ message: 'Failed to resolve flag' });
  }
};

/**
 * Get AI decision analytics
 */
const getAIAnalytics = async (req, res) => {
  const { timeRange } = req.query; // '7d', '30d', '90d'

  try {
    let interval = '7 days';
    if (timeRange === '30d') interval = '30 days';
    if (timeRange === '90d') interval = '90 days';

    // Get AI accuracy metrics
    const accuracyQuery = `
      SELECT 
        COUNT(*) as total_decisions,
        COUNT(CASE WHEN resolved = true AND resolution = 'correct' THEN 1 END) as correct_decisions,
        COUNT(CASE WHEN resolved = true AND resolution = 'incorrect' THEN 1 END) as incorrect_decisions,
        AVG(CASE WHEN details::jsonb->>'confidence' IS NOT NULL 
            THEN (details::jsonb->>'confidence')::float 
            END) as avg_confidence
      FROM fraud_alerts
      WHERE created_at > NOW() - INTERVAL '${interval}'
    `;

    const accuracyResult = await postgresPool.query(accuracyQuery);
    const stats = accuracyResult.rows[0];

    const accuracy = stats.correct_decisions > 0
      ? ((stats.correct_decisions / (stats.correct_decisions + stats.incorrect_decisions)) * 100).toFixed(2)
      : 0;

    // Get flagging patterns
    const patternsQuery = `
      SELECT 
        alert_type,
        severity,
        COUNT(*) as count
      FROM fraud_alerts
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY alert_type, severity
      ORDER BY count DESC
    `;

    const patternsResult = await postgresPool.query(patternsQuery);

    res.status(200).json({
      timeRange: interval,
      aiAccuracy: accuracy,
      totalDecisions: parseInt(stats.total_decisions),
      correctDecisions: parseInt(stats.correct_decisions),
      incorrectDecisions: parseInt(stats.incorrect_decisions),
      avgConfidence: parseFloat(stats.avg_confidence || 0).toFixed(2),
      flaggingPatterns: patternsResult.rows
    });

  } catch (error) {
    console.error('[Admin] Error fetching AI analytics:', error);
    res.status(500).json({ message: 'Failed to fetch AI analytics' });
  }
};

/**
 * Override AI decision
 */
const overrideAIDecision = async (req, res) => {
  const { targetType, targetId, newStatus, reason } = req.body;
  const adminId = req.user.userId;

  if (!targetType || !targetId || !newStatus || !reason) {
    return res.status(400).json({ 
      message: 'targetType, targetId, newStatus, and reason are required' 
    });
  }

  try {
    // Update status based on target type
    if (targetType === 'ngo') {
      await postgresPool.query(
        'UPDATE ngos SET status = $1 WHERE id = $2',
        [newStatus, targetId]
      );
    } else if (targetType === 'donation') {
      await cockroachPool.query(
        'UPDATE defaultdb.donations SET status = $1 WHERE id = $2',
        [newStatus, targetId]
      );
    } else if (targetType === 'campaign') {
      await postgresPool.query(
        'UPDATE campaigns SET status = $1 WHERE id = $2',
        [newStatus, targetId]
      );
    }

    // Log override to blockchain
    await writeAuditEvent(
      'ADMIN_AI_OVERRIDE',
      `admin-${adminId}`,
      `${targetType}-${targetId}`,
      {
        targetType,
        targetId,
        newStatus,
        reason,
        overrideType: 'manual_intervention'
      }
    );

    // Store feedback for AI improvement
    await postgresPool.query(
      `INSERT INTO ai_feedback 
       (target_type, target_id, feedback_type, feedback_data, provided_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        targetType,
        targetId,
        'admin_override',
        JSON.stringify({ newStatus, reason }),
        adminId
      ]
    );

    res.status(200).json({
      message: 'AI decision overridden successfully',
      targetType,
      targetId,
      newStatus,
      blockchainLogged: true
    });

  } catch (error) {
    console.error('[Admin] Error overriding AI decision:', error);
    res.status(500).json({ message: 'Failed to override AI decision' });
  }
};

/**
 * Get system-wide statistics
 */
const getSystemStats = async (req, res) => {
  try {
    // NGO statistics
    const ngoStats = await postgresPool.query(`
      SELECT 
        COUNT(*) as total_ngos,
        COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_ngos,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_ngos,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_ngos
      FROM ngos
    `);

    // Donation statistics
    const donationStats = await cockroachPool.query(`
      SELECT 
        COUNT(*) as total_donations,
        SUM(amount) as total_amount,
        COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_donations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_donations
      FROM defaultdb.donations
    `);

    // Blockchain statistics
    const blockchainStats = await cockroachPool.query(`
      SELECT 
        COUNT(*) as total_events,
        MAX(timestamp) as latest_event
      FROM defaultdb.audit_trail
    `);

    // Flag statistics
    const flagStats = await postgresPool.query(`
      SELECT 
        COUNT(*) as total_flags,
        COUNT(CASE WHEN resolved = false THEN 1 END) as pending_flags,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_flags
      FROM fraud_alerts
    `);

    res.status(200).json({
      ngos: ngoStats.rows[0],
      donations: donationStats.rows[0],
      blockchain: blockchainStats.rows[0],
      flags: flagStats.rows[0],
      systemHealth: 'operational',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Admin] Error fetching system stats:', error);
    res.status(500).json({ message: 'Failed to fetch system statistics' });
  }
};

module.exports = {
  getFlaggedItems,
  resolveFlag,
  getAIAnalytics,
  overrideAIDecision,
  getSystemStats
};
