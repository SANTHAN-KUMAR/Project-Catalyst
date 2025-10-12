import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveCampaigns();
  }, []);

  const fetchActiveCampaigns = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/campaigns/active`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>🌍 Project Catalyst</h1>
          <p className="tagline">Blockchain-Powered Transparent Donations</p>
          <p className="subtitle">
            Every donation tracked. Every proof verified. Every transaction transparent.
          </p>
          <div className="cta-buttons">
            <button onClick={() => navigate('/login?role=donor')} className="btn-primary">
              💰 Donate Now
            </button>
            <button onClick={() => navigate('/login?role=ngo')} className="btn-secondary">
              🏢 NGO Login
            </button>
          </div>
        </div>
      </section>

      {/* Active Campaigns */}
      <section className="campaigns-section">
        <h2>🎯 Active Campaigns</h2>
        <p>Choose a cause and make an impact today</p>

        {loading ? (
          <div className="loading">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="no-campaigns">No active campaigns at the moment</div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.map(campaign => (
              <div key={campaign.id} className="campaign-card">
                <div className="campaign-image">
                  <img src={campaign.image_url || 'https://placehold.co/400x250/667eea/ffffff?text=Campaign'} alt={campaign.title} />
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
                      <span className="raised">₹{(campaign.raised_amount || 0).toLocaleString()} raised</span>
                      <span className="goal">Goal: ₹{campaign.goal_amount.toLocaleString()}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/campaign/${campaign.id}`)} 
                    className="btn-donate"
                  >
                    💝 Donate Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h2>⚡ How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-icon">1️⃣</div>
            <h3>Choose Campaign</h3>
            <p>Browse verified campaigns and select one to support</p>
          </div>
          <div className="step">
            <div className="step-icon">2️⃣</div>
            <h3>Donate Securely</h3>
            <p>Your funds are held in blockchain smart contract escrow</p>
          </div>
          <div className="step">
            <div className="step-icon">3️⃣</div>
            <h3>AI Verification</h3>
            <p>NGO uploads proofs → AI verifies authenticity</p>
          </div>
          <div className="step">
            <div className="step-icon">4️⃣</div>
            <h3>Funds Released</h3>
            <p>Smart contract releases funds only after verification</p>
          </div>
        </div>
      </section>

      {/* Transparency Section */}
      <section className="transparency-section">
        <h2>🔐 100% Transparent</h2>
        <div className="transparency-features">
          <div className="feature">
            <span className="feature-icon">⛓️</span>
            <h3>Blockchain Verified</h3>
            <p>Every transaction recorded immutably</p>
          </div>
          <div className="feature">
            <span className="feature-icon">🤖</span>
            <h3>AI-Powered</h3>
            <p>Automated proof verification using Gemini AI</p>
          </div>
          <div className="feature">
            <span className="feature-icon">📊</span>
            <h3>Real-Time Tracking</h3>
            <p>See exactly how your donation is used</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
