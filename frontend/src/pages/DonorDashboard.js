import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './Dashboard.css';

const DonorDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalDonated: 0,
    activeDonations: 0,
    campaignsSupported: 0,
    fundsReleased: 0
  });
  const [recentDonations, setRecentDonations] = useState([]);

  useEffect(() => {
    fetchDonorData();
  }, []);

  const fetchDonorData = async () => {
    try {
      const response = await api.get('/donations/my-donations');
      const donations = response.data.donations || [];
      
      setRecentDonations(donations.slice(0, 5));
      
      const total = donations.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
      const escrowed = donations.filter(d => d.status === 'escrowed').length;
      const released = donations.filter(d => d.status === 'released').reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const campaigns = new Set(donations.map(d => d.campaign_id)).size;
      
      setStats({
        totalDonated: total,
        activeDonations: escrowed,
        campaignsSupported: campaigns,
        fundsReleased: released
      });
    } catch (error) {
      console.error('Error fetching donor data:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'escrowed': '🔒 In Escrow',
      'released': '✅ Released',
      'pending': '⏳ Pending'
    };
    return badges[status] || status;
  };

  return (
    <div className="dashboard-container">
      <div className="welcome-section">
        <h1>Welcome, Donor!</h1>
        <p>Track your donations and their impact</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Donated</h3>
            <p className="stat-number">₹{stats.totalDonated.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔒</div>
          <div className="stat-content">
            <h3>In Escrow</h3>
            <p className="stat-number">{stats.activeDonations}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Funds Released</h3>
            <p className="stat-number">₹{stats.fundsReleased.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <h3>Campaigns Supported</h3>
            <p className="stat-number">{stats.campaignsSupported}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="section">
          <div className="section-header">
            <h2>💝 Recent Donations</h2>
            <button onClick={() => navigate('/donate')} className="btn-primary">
              + New Donation
            </button>
          </div>
          
          <div className="donations-list">
            {recentDonations.length === 0 ? (
              <div className="empty-state">
                <p>No donations yet. Start making an impact today!</p>
                <button onClick={() => navigate('/ngos')} className="btn-secondary">
                  Browse Campaigns
                </button>
              </div>
            ) : (
              recentDonations.map(donation => (
                <div key={donation.id} className="donation-item" onClick={() => navigate(`/donation/${donation.id}/tracking`)}>
                  <div className="donation-details">
                    <h4>{donation.campaign_title || 'Campaign'}</h4>
                    <p className="ngo-name">{donation.ngo_name}</p>
                    <p className="donation-amount">₹{parseFloat(donation.amount).toLocaleString()}</p>
                  </div>
                  <div className="donation-meta">
                    <span className={`status-badge ${donation.status}`}>
                      {getStatusBadge(donation.status)}
                    </span>
                    <p className="donation-date">{new Date(donation.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonorDashboard;
