import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './NGOList.css';

const NGOList = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/active');
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ngo-list-container">
      <h1>🎯 Active Campaigns</h1>
      <p className="subtitle">Support verified campaigns with blockchain transparency</p>

      {loading ? (
        <div className="loading">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="no-campaigns">No active campaigns available</div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="campaign-card">
              <div className="campaign-image">
                <img 
                  src={campaign.image_url || 'https://placehold.co/400x250/667eea/ffffff?text=Campaign'} 
                  alt={campaign.title}
                />
                <span className="category-badge">{campaign.category}</span>
              </div>
              
              <div className="campaign-content">
                <h3>{campaign.title}</h3>
                <p className="ngo-name">by {campaign.ngo_name}</p>
                <p className="description">{campaign.description}</p>
                
                <div className="progress-section">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{width: `${Math.min((campaign.raised_amount/campaign.goal_amount)*100, 100)}%`}}
                    ></div>
                  </div>
                  <div className="progress-stats">
                    <span className="raised">₹{(campaign.raised_amount || 0).toLocaleString()}</span>
                    <span className="goal">Goal: ₹{campaign.goal_amount.toLocaleString()}</span>
                  </div>
                  <p className="donor-count">{campaign.donor_count || 0} donors</p>
                </div>

                <button 
                  onClick={() => navigate('/donate', { state: { campaign } })} 
                  className="btn-donate"
                >
                  💝 Donate Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NGOList;
