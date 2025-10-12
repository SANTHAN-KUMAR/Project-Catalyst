import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import './CreateCampaign.css';

const CreateCampaign = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_amount: '',
    category: 'Environment',
    end_date: '',
    image_url: ''
  });

  const categories = [
    'Environment',
    'Education',
    'Health',
    'Water Conservation',
    'Energy',
    'Animal Welfare',
    'Disaster Relief',
    'Women Empowerment',
    'Child Welfare',
    'Other'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/campaigns/create', {
        ...formData,
        goal_amount: parseFloat(formData.goal_amount)
      });

      alert('✅ Campaign created successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-campaign-container">
      <div className="campaign-form-card">
        <h2>🎯 Create New Campaign</h2>
        <p className="subtitle">Launch a fundraising campaign for your cause</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Campaign Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="e.g., Plant 1 Million Trees"
              required
            />
          </div>

          <div className="form-group">
            <label>Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe your campaign goals and impact..."
              rows="5"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Goal Amount (₹) *</label>
              <input
                type="number"
                min="1000"
                value={formData.goal_amount}
                onChange={(e) => setFormData({...formData, goal_amount: e.target.value})}
                placeholder="500000"
                required
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                required
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({...formData, end_date: e.target.value})}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label>Image URL (Optional)</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => setFormData({...formData, image_url: e.target.value})}
              placeholder="https://example.com/campaign-image.jpg"
            />
          </div>

          <button type="submit" className="btn-create" disabled={loading}>
            {loading ? '⏳ Creating...' : '🚀 Launch Campaign'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateCampaign;
