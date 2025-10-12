const pool = require('../config/database');

exports.uploadProof = async (req, res) => {
  const { campaignId, proofType, description, documentUrl } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO campaign_proofs (campaign_id, ngo_id, proof_type, description, document_url, verification_status, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW()) RETURNING *`,
      [campaignId, req.user.ngoId, proofType, description, documentUrl || 'proof_doc.pdf']
    );

    res.json({ success: true, message: 'Proof uploaded! Pending verification.', proof: result.rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to upload proof' });
  }
};

exports.verifyProof = async (req, res) => {
  const { proofId, status, verificationNotes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE campaign_proofs SET verification_status = $1, verification_notes = $2, verified_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, verificationNotes, proofId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proof not found' });
    }

    // Auto-release funds if verified
    if (status === 'verified') {
      await pool.query(
        `UPDATE donations SET escrow_status = 'released', released_at = NOW()
         WHERE campaign_id = $1 AND escrow_status = 'held'`,
        [result.rows[0].campaign_id]
      );
    }

    res.json({ success: true, message: status === 'verified' ? 'Proof verified! Funds released.' : 'Proof rejected.', proof: result.rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to verify proof' });
  }
};

exports.getCampaignProofs = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM campaign_proofs WHERE campaign_id = $1 ORDER BY uploaded_at DESC',
      [req.params.campaignId]
    );
    res.json({ success: true, proofs: result.rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch proofs' });
  }
};

module.exports = exports;
