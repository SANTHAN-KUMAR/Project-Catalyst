import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNGOAuditTrail, getDonationAuditTrail, verifyNGOChain } from '../api/api';
import { toast } from 'react-toastify';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';

const AuditTrail = () => {
  const { type, id } = useParams();
  const [auditTrail, setAuditTrail] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        let response;
        if (type === 'ngo') {
          response = await getNGOAuditTrail(id);
          const verifyRes = await verifyNGOChain(id);
          setVerification(verifyRes.data);
        } else {
          response = await getDonationAuditTrail(id);
        }
        setAuditTrail(response.data);
      } catch (error) {
        toast.error('Failed to fetch audit trail');
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [type, id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="h-10 w-10 text-white" />
          <div>
            <h1 className="text-4xl font-bold text-white">Blockchain Audit Trail</h1>
            <p className="text-white/70 text-lg capitalize">{type} ID: {id}</p>
          </div>
        </div>

        {verification && (
          <div className={`p-4 rounded-lg border ${
            verification.isValid 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-center space-x-2">
              {verification.isValid ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-400" />
                  <span className="text-green-300 font-semibold">Blockchain Verified ✓</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-red-400" />
                  <span className="text-red-300 font-semibold">Verification Failed</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {auditTrail.map((event, index) => (
          <div key={event.id || index} className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">{event.event_type}</h3>
                <p className="text-white/60 text-sm">{new Date(event.timestamp).toLocaleString()}</p>
              </div>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium">
                Block #{auditTrail.length - index}
              </span>
            </div>

            {event.details && (
              <div className="mb-4">
                <p className="text-white/70 text-sm">{JSON.stringify(event.details)}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-white/50 mb-1">Current Hash</p>
                <p className="text-white/80 font-mono break-all">{event.current_hash}</p>
              </div>
              <div>
                <p className="text-white/50 mb-1">Previous Hash</p>
                <p className="text-white/80 font-mono break-all">{event.previous_hash}</p>
              </div>
            </div>

            {event.actor_id && (
              <div className="mt-3">
                <p className="text-white/50 text-xs">Actor: {event.actor_id}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {auditTrail.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/70 text-lg">No audit trail found</p>
        </div>
      )}
    </div>
  );
};

export default AuditTrail;
