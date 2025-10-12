import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    campaigns: 0,
    proofs: 0,
    blockchainEvents: 0,
    totalRaised: 0
  });
  const [campaigns, setCampaigns] = useState([]);
  const [recentProofs, setRecentProofs] = useState([]);
  const [blockchainEvents, setBlockchainEvents] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    setUser(userData);
    fetchDashboardData(userData.id, token);
  }, [navigate]);

  const fetchDashboardData = async (ngoId, token) => {
    try {
      // Fetch campaigns
      const campaignsRes = await fetch(`${process.env.REACT_APP_API_URL}/api/campaigns/ngo/${ngoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const campaignsData = await campaignsRes.json();
      setCampaigns(campaignsData.campaigns || []);

      // Fetch recent proofs
      const proofsRes = await fetch(`${process.env.REACT_APP_API_URL}/api/proofs/ngo/${ngoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const proofsData = await proofsRes.json();
      setRecentProofs(proofsData.proofs || []);

      // Fetch blockchain events
      const eventsRes = await fetch(`${process.env.REACT_APP_API_URL}/api/ngos/${ngoId}/audit-trail`);
      const eventsData = await eventsRes.json();
      setBlockchainEvents(eventsData.auditTrail || []);

      // Calculate stats
      const totalRaised = campaignsData.campaigns?.reduce((sum, c) => sum + parseFloat(c.raised_amount || 0), 0) || 0;
      setStats({
        campaigns: campaignsData.campaigns?.length || 0,
        proofs: proofsData.proofs?.length || 0,
        blockchainEvents: eventsData.auditTrail?.length || 0,
        totalRaised
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const getEventIcon = (eventType) => {
    const icons = {
      'CAMPAIGN_CREATED': '🎯',
      'PROOF_UPLOADED': '📄',
      'DONATION_RECEIVED': '💰',
      'NGO_REGISTRATION': '✅',
      'VERIFICATION_COMPLETE': '🔐'
    };
    return icons[eventType] || '📋';
  };

  const getEventDescription = (eventType) => {
    const descriptions = {
      'CAMPAIGN_CREATED': 'New fundraising campaign launched',
      'PROOF_UPLOADED': 'Expenditure proof submitted & verified',
      'DONATION_RECEIVED': 'Donation processed through blockchain',
      'NGO_REGISTRATION': 'NGO registration initiated',
      'VERIFICATION_COMPLETE': 'Document verification completed'
    };
    return descriptions[eventType] || 'Blockchain event recorded';
  };

  return (
    <div className="dashboard-container">
      <div className="welcome-section">
        <h1>Welcome, {user?.name || 'NGO Admin'}!</h1>
        <p>Your blockchain-powered donation platform</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <h3>Active Campaigns</h3>
            <p className="stat-number">{stats.campaigns}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total Raised</h3>
            <p className="stat-number">₹{stats.totalRaised.toLocaleString()}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <h3>Proofs Uploaded</h3>
            <p className="stat-number">{stats.proofs}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⛓️</div>
          <div className="stat-content">
            <h3>Blockchain Events</h3>
            <p className="stat-number">{stats.blockchainEvents}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Campaigns Section */}
        <div className="section campaigns-section">
          <div className="section-header">
            <h2>📊 Your Campaigns</h2>
            <button onClick={() => navigate('/create-campaign')} className="btn-primary">
              + Create Campaign
            </button>
          </div>
          <div className="campaigns-list">
            {campaigns.length === 0 ? (
              <div className="empty-state">
                <p>No campaigns yet. Create your first campaign!</p>
              </div>
            ) : (
              campaigns.map(campaign => (
                <div key={campaign.id} className="campaign-card">
                  <div className="campaign-info">
                    <h3>{campaign.title}</h3>
                    <p>{campaign.description}</p>
                    <div className="campaign-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{width: `${(campaign.raised_amount/campaign.goal_amount)*100}%`}}
                        ></div>
                      </div>
                      <div className="progress-text">
                        ₹{campaign.raised_amount?.toLocaleString()} / ₹{campaign.goal_amount?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <span className={`status-badge ${campaign.status}`}>{campaign.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Proofs */}
        <div className="section proofs-section">
          <div className="section-header">
            <h2>📄 Recent Expenditure Proofs</h2>
            <button onClick={() => navigate('/proof-upload')} className="btn-secondary">
              + Upload Proof
            </button>
          </div>
          <div className="proofs-list">
            {recentProofs.length === 0 ? (
              <div className="empty-state">
                <p>No proofs uploaded yet.</p>
              </div>
            ) : (
              recentProofs.slice(0, 5).map(proof => (
                <div key={proof.id} className="proof-item">
                  <div className="proof-icon">📋</div>
                  <div className="proof-details">
                    <h4>{proof.vendor_name || 'Vendor'}</h4>
                    <p>₹{proof.amount} - {new Date(proof.uploaded_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`status-badge ${proof.status}`}>{proof.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Blockchain Events */}
        <div className="section blockchain-section">
          <div className="section-header">
            <h2>⛓️ Blockchain Activity</h2>
          </div>
          <div className="events-list">
            {blockchainEvents.length === 0 ? (
              <div className="empty-state">
                <p>No blockchain events yet.</p>
              </div>
            ) : (
              blockchainEvents.slice(0, 10).map((event, idx) => (
                <div key={idx} className="event-item">
                  <div className="event-icon">{getEventIcon(event.event_type)}</div>
                  <div className="event-details">
                    <h4>{getEventDescription(event.event_type)}</h4>
                    <p className="event-hash">Hash: {event.event_hash?.substring(0, 16)}...</p>
                    <p className="event-time">{new Date(event.created_at).toLocaleString()}</p>
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

export default Dashboard;
