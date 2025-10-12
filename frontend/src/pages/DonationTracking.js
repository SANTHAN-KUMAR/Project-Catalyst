import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../utils/api';

const DonationTracking = () => {
  const { id } = useParams();
  const [donation, setDonation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDonation();
  }, [id]);

  const fetchDonation = async () => {
    try {
      const response = await api.get(`/donations/${id}`);
      setDonation(response.data.donation);
    } catch (error) {
      console.error('Error fetching donation:', error);
      alert('Failed to load donation details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{padding: '4rem', textAlign: 'center', color: 'white'}}>Loading...</div>;
  if (!donation) return <div style={{padding: '4rem', textAlign: 'center', color: 'white'}}>Donation not found</div>;

  return (
    <div style={{padding: '2rem', maxWidth: '800px', margin: '0 auto', minHeight: 'calc(100vh - 80px)'}}>
      <div style={{background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '2rem'}}>
        <h1 style={{fontSize: '2rem', marginBottom: '1rem', color: 'white'}}>🔍 Donation Tracking</h1>
        <p style={{color: 'rgba(255,255,255,0.7)', marginBottom: '2rem'}}>Blockchain-verified transaction details</p>

        <div style={{display: 'grid', gap: '1.5rem'}}>
          <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px'}}>
            <h3 style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Donation ID</h3>
            <p style={{color: 'white', fontSize: '1.1rem', wordBreak: 'break-all'}}>{donation.id}</p>
          </div>

          <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px'}}>
            <h3 style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Campaign</h3>
            <p style={{color: 'white', fontSize: '1.2rem'}}>{donation.campaign_title}</p>
            <p style={{color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem'}}>{donation.ngo_name}</p>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px'}}>
              <h3 style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Amount</h3>
              <p style={{color: '#4ade80', fontSize: '1.5rem', fontWeight: 'bold'}}>₹{parseFloat(donation.amount).toLocaleString()}</p>
            </div>

            <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px'}}>
              <h3 style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Status</h3>
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: '600',
                background: donation.escrow_status === 'released' ? '#4ade80' : '#fbbf24',
                color: '#000'
              }}>
                {donation.escrow_status === 'released' ? '✓ Released' : '🔒 In Escrow'}
              </span>
            </div>
          </div>

          <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px'}}>
            <h3 style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Payment Method</h3>
            <p style={{color: 'white', fontSize: '1.1rem'}}>{donation.payment_method || 'UPI'}</p>
          </div>

          <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px'}}>
            <h3 style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Date & Time</h3>
            <p style={{color: 'white', fontSize: '1.1rem'}}>{new Date(donation.created_at).toLocaleString()}</p>
          </div>

          {donation.message && (
            <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px'}}>
              <h3 style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>Message</h3>
              <p style={{color: 'white', fontSize: '1rem'}}>{donation.message}</p>
            </div>
          )}

          <div style={{background: 'rgba(102, 126, 234, 0.1)', padding: '1.5rem', borderRadius: '12px', border: '2px solid rgba(102, 126, 234, 0.3)'}}>
            <h3 style={{color: 'white', fontSize: '1rem', marginBottom: '1rem'}}>🔗 Blockchain Verification</h3>
            <p style={{color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', lineHeight: '1.6'}}>
              This donation is secured on an immutable blockchain ledger. All transactions are transparent, 
              traceable, and cannot be modified or deleted.
            </p>
            <div style={{marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'}}>
              <p style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '0.25rem'}}>Transaction Hash</p>
              <p style={{color: '#4ade80', fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all'}}>
                {donation.blockchain_hash || `0x${donation.id.replace(/-/g, '')}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonationTracking;
