require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const donationRoutes = require('./routes/donationRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const proofRoutes = require('./routes/proofRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/proofs', proofRoutes);

app.get('/blockchain/status', async (req, res) => {
  res.json({ blockchain: 'operational', message: 'CockroachDB-based immutable audit trail active' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Main API listening on port ${PORT}`);
  console.log('=== Project Catalyst - Blockchain Trust Engine ===');
});
