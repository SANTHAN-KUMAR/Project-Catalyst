import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerNGO } from '../api/api';
import { toast } from 'react-toastify';
import { Upload, Shield } from 'lucide-react';

const NGORegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    registrationId: '',
    category: 'education'
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Please upload a registration certificate');
      return;
    }

    setLoading(true);
    const data = new FormData();
    data.append('name', formData.name);
    data.append('description', formData.description);
    data.append('registrationId', formData.registrationId);
    data.append('category', formData.category);
    data.append('registrationFile', file);

    try {
      const response = await registerNGO(data);
      toast.success('NGO registration submitted! Awaiting AI verification.');
      console.log('Registration response:', response.data);
      navigate('/ngos');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 border border-white/20">
        <div className="flex items-center space-x-3 mb-8">
          <Shield className="h-10 w-10 text-white" />
          <div>
            <h1 className="text-3xl font-bold text-white">Register Your NGO</h1>
            <p className="text-white/70">Submit for blockchain verification</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">Organization Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="Enter NGO name"
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="Describe your organization's mission"
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">Registration ID</label>
            <input
              type="text"
              name="registrationId"
              value={formData.registrationId}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              placeholder="e.g., 12A, 80G, or official reg number"
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="education" className="text-purple-900">Education</option>
              <option value="health" className="text-purple-900">Healthcare</option>
              <option value="environment" className="text-purple-900">Environment</option>
              <option value="poverty" className="text-purple-900">Poverty Alleviation</option>
              <option value="disaster" className="text-purple-900">Disaster Relief</option>
              <option value="other" className="text-purple-900">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">Registration Certificate (PDF/Image)</label>
            <div className="flex items-center space-x-4">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center justify-center px-4 py-3 bg-white/10 border-2 border-dashed border-white/30 rounded-md hover:bg-white/20 transition">
                  <Upload className="h-5 w-5 text-white/70 mr-2" />
                  <span className="text-white/70">{file ? file.name : 'Choose file'}</span>
                </div>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  required
                />
              </label>
            </div>
            <p className="text-white/50 text-xs mt-2">Upload official registration document for AI verification</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-purple-700 py-3 rounded-md font-semibold hover:bg-white/90 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-purple-700"></div>
                <span>Submitting for Verification...</span>
              </>
            ) : (
              <>
                <Shield className="h-5 w-5" />
                <span>Submit for Verification</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NGORegister;
