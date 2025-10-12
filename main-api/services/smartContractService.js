const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'catalyst_user',
  host: process.env.POSTGRES_HOST || 'postgres',
  database: process.env.POSTGRES_DB || 'catalyst_users',
  password: process.env.POSTGRES_PASSWORD || 'catty123',
  port: 5432,
});

// This runs when a proof is verified - releases funds from escrow
const releaseFundsAfterVerification = async (proofId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get proof details
    const proofQuery = `
      SELECT campaign_id, amount, ngo_id
      FROM expenditure_proofs
      WHERE id = $1 AND status = 'verified'
    `;
    const proof = await client.query(proofQuery, [proofId]);
    
    if (proof.rows.length === 0) {
      console.log('[Smart Contract] Proof not found or not verified');
      return;
    }
    
    const { campaign_id, amount } = proof.rows[0];
    
    // Find escrowed donations for this campaign that can cover this proof
    const donationsQuery = `
      SELECT id, donor_id, amount, escrow_address, smart_contract_id
      FROM donations
      WHERE campaign_id = $1 AND status = 'escrowed'
      ORDER BY created_at ASC
    `;
    const donations = await client.query(donationsQuery, [campaign_id]);
    
    let remainingAmount = parseFloat(amount);
    const releasedDonations = [];
    
    // Release funds from donations to cover the proof amount
    for (const donation of donations.rows) {
      if (remainingAmount <= 0) break;
      
      const donationAmount = parseFloat(donation.amount);
      const amountToRelease = Math.min(donationAmount, remainingAmount);
      
      // Create donation-proof tracking
      await client.query(`
        INSERT INTO donation_proof_tracking (donation_id, proof_id, amount_utilized, verification_status, verified_at)
        VALUES ($1, $2, $3, 'verified', NOW())
      `, [donation.id, proofId, amountToRelease]);
      
      // If entire donation is used, mark as released
      if (amountToRelease >= donationAmount) {
        await client.query(`
          UPDATE donations
          SET status = 'released', released_at = NOW()
          WHERE id = $1
        `, [donation.id]);
        
        // Log smart contract event
        const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
        await client.query(`
          INSERT INTO smart_contract_events (donation_id, event_type, event_data, blockchain_hash)
          VALUES ($1, 'FUNDS_RELEASED', $2, $3)
        `, [
          donation.id,
          JSON.stringify({
            proof_id: proofId,
            amount_released: amountToRelease,
            escrow_address: donation.escrow_address,
            timestamp: new Date().toISOString()
          }),
          txHash
        ]);
        
        releasedDonations.push({
          donation_id: donation.id,
          donor_id: donation.donor_id,
          amount: amountToRelease,
          smart_contract_id: donation.smart_contract_id
        });
      }
      
      remainingAmount -= amountToRelease;
    }
    
    await client.query('COMMIT');
    
    console.log(`[Smart Contract] ✓ Released ₹${amount} from ${releasedDonations.length} donation(s)`);
    
    return releasedDonations;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Smart Contract] Error releasing funds:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  releaseFundsAfterVerification
};
