// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/authRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const donationRoutes = require('./routes/donationRoutes');

// Import smart contract processor
const { startSmartContractProcessor } = require('./services/smartContractProcessor');

const app = express();

// CORS configuration - IMPORTANT: Update this to allow your frontend origin
const corsOptions = {
  origin: '*', // For development - in production, specify your frontend domain
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); 

const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/donations', donationRoutes);

// Simple welcome route
app.get('/', (req, res) => {
  res.send('Welcome to the Project Catalyst Main API - Blockchain-Enabled Trust Engine');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      mainAPI: 'running',
      smartContract: 'active',
      blockchain: 'simulated-cockroachdb'
    }
  });
});

// Blockchain status endpoint
app.get('/blockchain/status', async (req, res) => {
  const { Pool } = require('pg');
  const cockroachPool = new Pool({
    user: 'root',
    host: 'cockroachdb',
    database: 'defaultdb',
    port: 26257,
  });

  try {
    const result = await cockroachPool.query(
      'SELECT COUNT(*) as total_events, MAX(timestamp) as latest_event FROM defaultdb.audit_trail'
    );
    
    res.json({
      blockchain: 'operational',
      totalEvents: result.rows[0].total_events,
      latestEvent: result.rows[0].latest_event,
      message: 'CockroachDB-based immutable audit trail active'
    });
  } catch (error) {
    res.status(500).json({ 
      blockchain: 'error',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Main API listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=== Project Catalyst - Blockchain Trust Engine ===');
  console.log('Initializing Smart Contract Event Processor...');
  
  // Start the smart contract event processor
  // This monitors the audit_trail and triggers automated actions
  startSmartContractProcessor();
  
  console.log('✓ Smart Contract Processor: ACTIVE');
  console.log('✓ Immutable Audit Trail: ENABLED');
  console.log('✓ Chain Hashing: SHA-256');
  console.log('==========================================');
});
