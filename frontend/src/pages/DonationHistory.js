import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDonationHistory } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { ExternalLink, Clock } from 'lucide-react';

const DonationHistory = () => {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await getDonationHistory();
        setDonations(response.data);
      } catch (error) {
        toast.error('Failed to fetch donation history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
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
        <h1 className="text-4xl font-bold text-white mb-2">Donation History</h1>
        <p className="text-white/70 text-lg">View all your blockchain-verified transactions</p>
      </div>

      <div className="space-y-4">
        {donations.map((donation) => (
          <div key={donation.id} className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:border-white/40 transition">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-bold text-white">₹{parseFloat(donation.amount).toLocaleString()}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    donation.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                    donation.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {donation.status}
                  </span>
                </div>
                
                <p className="text-white/70 text-sm mb-2">
                  {user.role === 'donor' ? `To: ${donation.ngo_name || 'NGO'}` : `From: ${donation.donor_name || 'Anonymous'}`}
                </p>
                
                <div className="flex items-center space-x-4 text-white/60 text-xs">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(donation.created_at).toLocaleString()}</span>
                  </div>
                  {donation.transaction_hash && (
                    <span className="font-mono">Hash: {donation.transaction_hash.substring(0, 16)}...</span>
                  )}
                </div>
                
                {donation.message && (
                  <p className="text-white/70 text-sm mt-3 italic">"{donation.message}"</p>
                )}
              </div>
              
              <Link
                to={`/audit/donation/${donation.id}`}
                className="ml-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-md text-sm font-medium transition flex items-center space-x-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View Audit</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {donations.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/70 text-lg">No donations found</p>
        </div>
      )}
    </div>
  );
};

export default DonationHistory;
