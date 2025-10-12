const pool = require('../config/database');

exports.createDonation = async (req, res) => {
  const { campaignId, amount, paymentMethod, message } = req.body;
  const donorId = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO donations (donor_id, campaign_id, amount, payment_method, escrow_status, message, created_at)
       VALUES ($1, $2, $3, $4, 'held', $5, NOW()) RETURNING *`,
      [donorId, campaignId, amount, paymentMethod || 'UPI', message]
    );

    await pool.query(
      'UPDATE campaigns SET raised_amount = raised_amount + $1 WHERE id = $2',
      [amount, campaignId]
    );

    res.json({ success: true, message: 'Donation successful! Funds held in escrow.', donation: result.rows[0] });
  } catch (error) {
    console.error('Donation error:', error);
    res.status(500).json({ error: 'Donation failed' });
  }
};

exports.getUserDonations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, c.title as campaign_title, n.name as ngo_name, n.registration_id
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN ngos n ON c.ngo_id = n.id
       WHERE d.donor_id = $1
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, donations: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
};

// TRACKING PAGE ENDPOINT
exports.getDonationById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, c.title as campaign_title, c.description as campaign_description,
              n.name as ngo_name, n.registration_id, u.name as donor_name
       FROM donations d
       JOIN campaigns c ON d.campaign_id = c.id
       JOIN ngos n ON c.ngo_id = n.id
       JOIN users u ON d.donor_id = u.id
       WHERE d.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    const proofs = await pool.query(
      'SELECT * FROM campaign_proofs WHERE campaign_id = $1 ORDER BY uploaded_at DESC',
      [result.rows[0].campaign_id]
    );

    res.json({ success: true, donation: result.rows[0], proofs: proofs.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch donation details' });
  }
};

module.exports = exports;
