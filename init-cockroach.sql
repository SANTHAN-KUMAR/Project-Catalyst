-- CockroachDB Initialization Script
-- This creates the audit_trail and donations tables

-- Create audit_trail table for blockchain-like verification
CREATE TABLE IF NOT EXISTS defaultdb.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT now(),
    event_type VARCHAR(100) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    target_id VARCHAR(255),
    details JSONB,
    previous_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_event_type (event_type),
    INDEX idx_actor_id (actor_id)
);

-- Create donations table
CREATE TABLE IF NOT EXISTS defaultdb.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL,
    ngo_id UUID NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'verified',
    campaignName VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    INDEX idx_donor_id (donor_id),
    INDEX idx_ngo_id (ngo_id),
    INDEX idx_created_at (created_at)
);

-- Verify tables were created
SHOW TABLES FROM defaultdb;
