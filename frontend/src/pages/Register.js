import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Shield } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '', role: 'donor' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(formData.email, formData.password, formData.fullName, formData.role);
      toast.success('Registration successful! Please login.');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-lg shadow-2xl p-8 border border-white/20">
        <div className="text-center mb-8">
          <Shield className="h-16 w-16 text-white mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white">Create Account</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Full Name" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white placeholder-white/50 focus:outline-none" required />
          <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white placeholder-white/50 focus:outline-none" required />
          <input type="password" placeholder="Password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white placeholder-white/50 focus:outline-none" minLength="8" required />
          <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-md text-white focus:outline-none">
            <option value="donor" className="text-purple-900">Donor</option>
            <option value="ngo_admin" className="text-purple-900">NGO Admin</option>
          </select>
          <button type="submit" disabled={loading} className="w-full bg-white text-purple-700 py-3 rounded-md font-semibold hover:bg-white/90 disabled:opacity-50">
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        <p className="mt-6 text-center text-white/70">
          Already have an account? <Link to="/login" className="text-white font-semibold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
