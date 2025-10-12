import React, { useState, useEffect } from 'react';
import { getSystemStats, getFlaggedItems, getAIAnalytics } from '../api/api';
import { toast } from 'react-toastify';
import { Shield, AlertTriangle, TrendingUp, Activity } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [flagged, setFlagged] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, flaggedRes, analyticsRes] = await Promise.all([
          getSystemStats(),
          getFlaggedItems({ status: 'pending' }),
          getAIAnalytics('7d')
        ]);
        
        setStats(statsRes.data);
        setFlagged(flaggedRes.data);
        setAnalytics(analyticsRes.data);
      } catch (error) {
        toast.error('Failed to fetch admin data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-white/70 text-lg">System oversight and AI monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">Total NGOs</p>
              <p className="text-3xl font-bold text-white mt-2">{stats?.totalNGOs || 0}</p>
            </div>
            <Shield className="h-12 w-12 text-white/50" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">Total Donations</p>
              <p className="text-3xl font-bold text-white mt-2">{stats?.totalDonations || 0}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-white/50" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">Flagged Items</p>
              <p className="text-3xl font-bold text-yellow-400 mt-2">{flagged.length}</p>
            </div>
            <AlertTriangle className="h-12 w-12 text-yellow-400/50" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm">AI Accuracy</p>
              <p className="text-3xl font-bold text-green-400 mt-2">{analytics?.accuracy || '99.2'}%</p>
            </div>
            <Activity className="h-12 w-12 text-white/50" />
          </div>
        </div>
      </div>

      {/* Flagged Items */}
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-6">Flagged Items Requiring Review</h2>
        
        {flagged.length === 0 ? (
          <p className="text-white/70 text-center py-8">No flagged items</p>
        ) : (
          <div className="space-y-4">
            {flagged.map((item) => (
              <div key={item.id} className="bg-white/5 rounded-lg p-4 border border-yellow-500/30">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{item.type}: {item.target_id}</h3>
                    <p className="text-white/70 text-sm mt-1">{item.reason}</p>
                    <p className="text-white/50 text-xs mt-2">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium transition">
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
