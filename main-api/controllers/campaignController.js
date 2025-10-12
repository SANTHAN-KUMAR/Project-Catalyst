const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

// Get all active campaigns for landing page
const getActiveCampaigns = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        n.name as ngo_name,
        n.registration_id,
        (SELECT COUNT(*) FROM donations WHERE campaign_id = c.id) as donor_count
      FROM campaigns c
      LEFT JOIN ngos n ON c.ngo_id = n.id
      WHERE c.status = 'active' AND n.status = 'verified'
      ORDER BY c.created_at DESC
    `;
    
    const { rows } = await pool.query(query);
    
    res.json({
      success: true,
      campaigns: rows
    });
  } catch (error) {
    console.error('[Campaign] Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

// Get single campaign details
const getCampaignDetails = async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaignQuery = `
      SELECT 
        c.*,
        n.name as ngo_name,
        n.description as ngo_description,
        n.registration_id,
        (SELECT COUNT(*) FROM donations WHERE campaign_id = c.id) as donor_count,
        (SELECT COUNT(*) FROM expenditure_proofs WHERE campaign_id = c.id) as proof_count
      FROM campaigns c
      LEFT JOIN ngos n ON c.ngo_id = n.id
      WHERE c.id = $1
    `;
    
    const { rows } = await pool.query(campaignQuery, [campaignId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Get recent proofs for this campaign
    const proofsQuery = `
      SELECT id, amount, vendor_name, status, uploaded_at
      FROM expenditure_proofs
      WHERE campaign_id = $1
      ORDER BY uploaded_at DESC
      LIMIT 5
    `;
    const proofs = await pool.query(proofsQuery, [campaignId]);
    
    // Get impact metrics
    const impactQuery = `
      SELECT metric_name, metric_value, reported_date
      FROM campaign_impact
      WHERE campaign_id = $1
      ORDER BY reported_date DESC
    `;
    const impact = await pool.query(impactQuery, [campaignId]);
    
    res.json({
      success: true,
      campaign: rows[0],
      recentProofs: proofs.rows,
      impact: impact.rows
    });
  } catch (error) {
    console.error('[Campaign] Error fetching campaign details:', error);
    res.status(500).json({ error: 'Failed to fetch campaign details' });
  }
};

// Create new campaign (NGO only)
const createCampaign = async (req, res) => {
  try {
    const { title, description, goal_amount, category, end_date, image_url } = req.body;
    const ngoId = req.user.ngoId; // from auth middleware
    
    if (!title || !goal_amount) {
      return res.status(400).json({ error: 'Title and goal amount are required' });
    }
    
    const query = `
      INSERT INTO campaigns (ngo_id, title, description, goal_amount, category, end_date, image_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      ngoId, title, description, goal_amount, category, end_date, image_url
    ]);
    
    console.log('[Campaign] ✓ New campaign created:', title);
    
    res.json({
      success: true,
      campaign: rows[0]
    });
  } catch (error) {
    console.error('[Campaign] Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

// Get campaigns for specific NGO
const getNGOCampaigns = async (req, res) => {
  try {
    const ngoId = req.user.ngoId;
    
    const query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM donations WHERE campaign_id = c.id) as donor_count,
        (SELECT SUM(amount) FROM donations WHERE campaign_id = c.id AND status = 'released') as total_released
      FROM campaigns c
      WHERE c.ngo_id = $1
      ORDER BY c.created_at DESC
    `;
    
    const { rows } = await pool.query(query, [ngoId]);
    
    res.json({
      success: true,
      campaigns: rows
    });
  } catch (error) {
    console.error('[Campaign] Error fetching NGO campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

module.exports = {
  getActiveCampaigns,
  getCampaignDetails,
  createCampaign,
  getNGOCampaigns
};
