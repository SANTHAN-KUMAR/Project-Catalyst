import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './CreateDonation.css';

const CreateDonation = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    campaign_id: '',
    amount: '',
    payment_method: 'UPI',
    message: ''
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns/active');
      setCampaigns(response.data.campaigns || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      alert('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.campaign_id || !formData.amount) {
      alert('Please select a campaign and enter amount');
      return;
    }

    try {
      const response = await api.post('/donations/create', {
        campaign_id: formData.campaign_id,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method
      });

      alert('🎉 Donation Successful! Your funds are now in smart contract escrow.');
      navigate('/history');
    } catch (error) {
      console.error('Donation error:', error);
      alert('Failed to process donation: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="create-donation-container">
      <div className="donation-form-card">
        <h2>💝 Make a Donation</h2>
        <p className="subtitle">Support verified campaigns with blockchain transparency</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Campaign</label>
            {loading ? (
              <p>Loading campaigns...</p>
            ) : (
              <select
                value={formData.campaign_id}
                onChange={(e) => setFormData({...formData, campaign_id: e.target.value})}
                required
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title} - {campaign.ngo_name} (₹{campaign.raised_amount?.toLocaleString()} / ₹{campaign.goal_amount?.toLocaleString()})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              min="1"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              placeholder="Enter amount"
              required
            />
          </div>

          <div className="form-group">
            <label>Payment Method</label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
            >
              <option value="UPI">UPI</option>
              <option value="Card">Credit/Debit Card</option>
              <option value="NetBanking">Net Banking</option>
              <option value="Wallet">Wallet</option>
            </select>
          </div>

          <div className="form-group">
            <label>Message (Optional)</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Add a personal message"
              rows="3"
            />
          </div>

          <button type="submit" className="btn-donate">
            🎯 Donate Now
          </button>
        </form>

        <div className="info-box">
          <h4>🔐 How Your Donation Works:</h4>
          <ul>
            <li>✅ Your funds go to smart contract escrow</li>
            <li>✅ NGO uploads proof of expenditure</li>
            <li>✅ AI verifies the proof automatically</li>
            <li>✅ Smart contract releases funds to NGO</li>
            <li>✅ Complete blockchain tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CreateDonation;
