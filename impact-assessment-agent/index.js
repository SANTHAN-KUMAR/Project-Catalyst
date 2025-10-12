require('dotenv').config();

const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '50mb' }));
const port = 3004;

// === DATABASE CONNECTIONS ===

// PostgreSQL for campaign data
const postgresPool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: 'postgres',
  database: process.env.POSTGRES_DB || 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

// CockroachDB for audit trail
const cockroachPool = new Pool({
  user: 'root',
  host: 'cockroachdb',
  database: 'defaultdb',
  port: 26257,
});

// === GEMINI AI INITIALIZATION ===
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
    console.log(`[Impact Agent - Audit Trail] Event logged: ${eventType}`);
    return currentHash;
  } catch (error) {
    console.error('[Impact Agent - Audit Trail] Failed to write event:', error);
    throw error;
  } finally {
    client.release();
  }
}

// === AI PROMPT TEMPLATES ===

function getImpactAnalysisPrompt() {
  return `You are an AI impact assessment expert for NGO campaigns. Analyze the provided progress report and extract key metrics.

IMPORTANT: Return ONLY valid JSON with this exact structure:

{
  "beneficiariesServed": <number>,
  "beneficiariesTarget": <number>,
  "resourcesDistributed": {
    "items": [{"name": "string", "quantity": number, "unit": "string"}],
    "totalValue": <number>
  },
  "outcomesAchieved": ["outcome1", "outcome2"],
  "impactScore": <number between 0-100>,
  "efficiency": {
    "costPerBeneficiary": <number>,
    "resourceUtilization": <percentage 0-100>
  },
  "redFlags": ["flag1", "flag2"],
  "confidence": <number between 0.0-1.0>,
  "summary": "brief summary string"
}

Evaluation Criteria:
1. beneficiariesServed: Actual number of people helped (extract from report)
2. impactScore: Overall effectiveness (0-100)
   - 90-100: Exceptional impact, exceeded targets
   - 70-89: Good impact, meeting targets
   - 50-69: Moderate impact, below targets
   - Below 50: Poor impact, significant issues
3. efficiency.costPerBeneficiary: Total spent / beneficiaries served
4. efficiency.resourceUtilization: % of resources effectively used
5. redFlags: Issues like:
   - "Beneficiaries count suspiciously high"
   - "Cost per beneficiary exceeds industry average"
   - "Vague outcomes, no verifiable metrics"
   - "Resource distribution not documented"
6. confidence: How confident you are in extraction (0.0-1.0)

Extract numbers, verify claims, and flag inconsistencies.`;
}

// === MAIN ENDPOINT: ASSESS IMPACT ===

app.post('/assess-impact', async (req, res) => {
  const { campaignId, ngoId, reportContent, reportType, fileContent, mimeType } = req.body;

  if (!campaignId || !ngoId) {
    return res.status(400).json({ 
      message: 'campaignId and ngoId are required.' 
    });
  }

  if (!reportContent && !fileContent) {
    return res.status(400).json({ 
      message: 'Either reportContent (text) or fileContent (base64) is required.' 
    });
  }

  try {
    console.log(`[Impact Agent] Assessing impact for campaign ${campaignId}...`);

    // Prepare AI input
    let prompt = getImpactAnalysisPrompt();
    let aiInput = [prompt];

    if (fileContent && mimeType) {
      // Handle file-based report
      aiInput.push({
        inlineData: {
          mimeType: mimeType,
          data: fileContent
        }
      });
    } else {
      // Handle text-based report
      aiInput.push(`\n\nPROGRESS REPORT:\n${reportContent}`);
    }

    // Call Gemini AI
    console.log('[Impact Agent] Calling Gemini API...');
    const result = await model.generateContent(aiInput);
    const responseText = result.response.text();
    
    // Parse AI response
    let impactData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      impactData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      console.error('[Impact Agent] JSON parsing failed:', parseError);
      return res.status(500).json({ 
        message: 'AI returned invalid format',
        rawResponse: responseText 
      });
    }

    // Validate and enrich data
    impactData.campaignId = campaignId;
    impactData.ngoId = ngoId;
    impactData.assessmentDate = new Date().toISOString();
    impactData.reportType = reportType || 'progress_report';

    // Calculate additional metrics
    const impactQuality = calculateImpactQuality(impactData);
    impactData.impactQuality = impactQuality;

    // === STORE IN DATABASE ===
    const client = await postgresPool.connect();
    try {
      await client.query('BEGIN');

      // Insert impact assessment record
      const insertQuery = `
        INSERT INTO impact_assessments 
        (campaign_id, ngo_id, beneficiaries_served, beneficiaries_target, 
         impact_score, cost_per_beneficiary, resource_utilization, 
         red_flags, confidence, summary, full_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;
      const values = [
        campaignId, ngoId,
        impactData.beneficiariesServed || 0,
        impactData.beneficiariesTarget || 0,
        impactData.impactScore || 0,
        impactData.efficiency?.costPerBeneficiary || 0,
        impactData.efficiency?.resourceUtilization || 0,
        JSON.stringify(impactData.redFlags || []),
        impactData.confidence || 0.5,
        impactData.summary || '',
        JSON.stringify(impactData)
      ];
      
      const insertResult = await client.query(insertQuery, values);
      const assessmentId = insertResult.rows[0].id;
      impactData.assessmentId = assessmentId;

      // Update campaign table with latest metrics
      await client.query(
        `UPDATE campaigns 
         SET beneficiaries_served = $1, 
             last_impact_score = $2,
             last_assessment_date = NOW()
         WHERE id = $3`,
        [impactData.beneficiariesServed, impactData.impactScore, campaignId]
      );

      await client.query('COMMIT');
      console.log(`[Impact Agent] Assessment stored with ID: ${assessmentId}`);

    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

    // === LOG TO BLOCKCHAIN ===
    await writeAuditEvent(
      'IMPACT_ASSESSED',
      'impact-assessment-agent',
      `campaign-${campaignId}`,
      {
        assessmentId: impactData.assessmentId,
        ngoId,
        impactScore: impactData.impactScore,
        beneficiariesServed: impactData.beneficiariesServed,
        confidence: impactData.confidence,
        redFlags: impactData.redFlags,
        impactQuality: impactQuality
      }
    );

    // === TRIGGER SMART CONTRACT ACTIONS ===
    if (impactData.redFlags && impactData.redFlags.length > 2) {
      // Too many red flags - create fraud alert
      await writeAuditEvent(
        'IMPACT_RED_FLAGS_DETECTED',
        'impact-assessment-agent',
        `campaign-${campaignId}`,
        {
          severity: 'high',
          flagCount: impactData.redFlags.length,
          flags: impactData.redFlags
        }
      );
    }

    if (impactData.impactScore < 50) {
      // Poor impact - flag for review
      await writeAuditEvent(
        'LOW_IMPACT_DETECTED',
        'impact-assessment-agent',
        `campaign-${campaignId}`,
        {
          score: impactData.impactScore,
          recommendation: 'Consider discontinuing funding or requiring corrective action'
        }
      );
    }

    res.status(200).json({
      message: 'Impact assessment completed successfully',
      assessment: impactData,
      blockchainLogged: true
    });

  } catch (error) {
    console.error('[Impact Agent] Error during assessment:', error);
    res.status(500).json({ 
      message: 'Impact assessment failed',
      error: error.message 
    });
  }
});

// === HELPER FUNCTION: CALCULATE IMPACT QUALITY ===
function calculateImpactQuality(impactData) {
  let qualityScore = 0;
  let maxScore = 100;

  // Factor 1: Impact Score (40 points)
  qualityScore += (impactData.impactScore || 0) * 0.4;

  // Factor 2: Confidence Level (20 points)
  qualityScore += (impactData.confidence || 0) * 20;

  // Factor 3: Target Achievement (20 points)
  if (impactData.beneficiariesTarget > 0) {
    const achievementRate = Math.min(
      impactData.beneficiariesServed / impactData.beneficiariesTarget, 
      1.0
    );
    qualityScore += achievementRate * 20;
  }

  // Factor 4: Resource Efficiency (10 points)
  if (impactData.efficiency?.resourceUtilization) {
    qualityScore += (impactData.efficiency.resourceUtilization / 100) * 10;
  }

  // Factor 5: Red Flags Penalty (10 points deducted)
  const redFlagPenalty = (impactData.redFlags?.length || 0) * 5;
  qualityScore -= Math.min(redFlagPenalty, 10);

  return Math.max(0, Math.min(100, Math.round(qualityScore)));
}

// === ENDPOINT: GET CAMPAIGN IMPACT HISTORY ===
app.get('/campaign/:campaignId/history', async (req, res) => {
  const { campaignId } = req.params;

  try {
    const result = await postgresPool.query(
      `SELECT * FROM impact_assessments 
       WHERE campaign_id = $1 
       ORDER BY created_at DESC`,
      [campaignId]
    );

    res.status(200).json({
      campaignId,
      assessments: result.rows,
      totalAssessments: result.rows.length
    });
  } catch (error) {
    console.error('[Impact Agent] Error fetching history:', error);
    res.status(500).json({ message: 'Failed to fetch impact history' });
  }
});

// === ENDPOINT: GET NGO OVERALL IMPACT ===
app.get('/ngo/:ngoId/overall-impact', async (req, res) => {
  const { ngoId } = req.params;

  try {
    const result = await postgresPool.query(
      `SELECT 
        COUNT(*) as total_assessments,
        AVG(impact_score) as avg_impact_score,
        SUM(beneficiaries_served) as total_beneficiaries,
        AVG(confidence) as avg_confidence,
        COUNT(CASE WHEN impact_score >= 70 THEN 1 END) as successful_campaigns
       FROM impact_assessments
       WHERE ngo_id = $1`,
      [ngoId]
    );

    const stats = result.rows[0];
    
    res.status(200).json({
      ngoId,
      overallImpact: {
        totalAssessments: parseInt(stats.total_assessments),
        avgImpactScore: parseFloat(stats.avg_impact_score || 0).toFixed(2),
        totalBeneficiaries: parseInt(stats.total_beneficiaries || 0),
        avgConfidence: parseFloat(stats.avg_confidence || 0).toFixed(2),
        successRate: stats.total_assessments > 0 
          ? ((stats.successful_campaigns / stats.total_assessments) * 100).toFixed(2)
          : 0
      }
    });
  } catch (error) {
    console.error('[Impact Agent] Error calculating overall impact:', error);
    res.status(500).json({ message: 'Failed to calculate overall impact' });
  }
});

// === HEALTH CHECK ===
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Impact Assessment Agent',
    timestamp: new Date().toISOString() 
  });
});

app.listen(port, () => {
  console.log(`Impact Assessment Agent listening on port ${port}`);
  console.log('✓ AI-Powered Impact Verification: ACTIVE');
});

