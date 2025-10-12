import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// NGO APIs
export const getAllNGOs = () => api.get('/api/ngos');
export const registerNGO = (formData) => api.post('/api/ngos/register', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getNGOAuditTrail = (ngoId) => api.get(`/api/ngos/${ngoId}/audit-trail`);
export const verifyNGOChain = (ngoId) => api.get(`/api/ngos/${ngoId}/verify-chain`);

// Donation APIs
export const createDonation = (data) => api.post('/api/donations', data);
export const getDonationHistory = () => api.get('/api/donations/history');
export const getDonationAuditTrail = (donationId) => api.get(`/api/donations/${donationId}/audit-trail`);
export const getPendingDonations = () => api.get('/api/donations/pending/all');
export const updateDonationStatus = (donationId, data) => api.put(`/api/donations/${donationId}/status`, data);

// Proof Upload API
export const uploadProof = (formData) => api.post('/api/ngos/proof', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Admin APIs
export const getSystemStats = () => api.get('/api/admin/stats');
export const getFlaggedItems = (params) => api.get('/api/admin/flagged', { params });
export const resolveFlag = (flagId, data) => api.put(`/api/admin/flagged/${flagId}/resolve`, data);
export const getAIAnalytics = (timeRange) => api.get('/api/admin/ai-analytics', { params: { timeRange } });
export const overrideAIDecision = (data) => api.post('/api/admin/ai-override', data);

// Blockchain API
export const getBlockchainStatus = () => api.get('/blockchain/status');

export default api;
