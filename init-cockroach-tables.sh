#!/bin/bash
echo "=== Initializing CockroachDB Tables ==="

# Wait for CockroachDB to be ready
echo "Waiting for CockroachDB to start..."
sleep 5

# Create the tables
docker exec -i catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure << 'SQL'
-- Create audit_trail table
CREATE TABLE IF NOT EXISTS defaultdb.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type STRING NOT NULL,
    actor_id STRING NOT NULL,
    target_id STRING NOT NULL,
    details JSONB,
    previous_hash STRING NOT NULL,
    current_hash STRING NOT NULL,
    timestamp TIMESTAMP NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS audit_trail_target_idx ON defaultdb.audit_trail (target_id);
CREATE INDEX IF NOT EXISTS audit_trail_timestamp_idx ON defaultdb.audit_trail (timestamp);
CREATE INDEX IF NOT EXISTS audit_trail_actor_idx ON defaultdb.audit_trail (actor_id);
CREATE INDEX IF NOT EXISTS audit_trail_hash_idx ON defaultdb.audit_trail (current_hash);

-- Create donations table
CREATE TABLE IF NOT EXISTS defaultdb.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id INT NOT NULL,
    ngo_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status STRING NOT NULL DEFAULT 'pending',
    transaction_hash STRING,
    created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for donations
CREATE INDEX IF NOT EXISTS donations_donor_idx ON defaultdb.donations (donor_id);
CREATE INDEX IF NOT EXISTS donations_ngo_idx ON defaultdb.donations (ngo_id);
CREATE INDEX IF NOT EXISTS donations_status_idx ON defaultdb.donations (status);

-- Verify tables were created
SHOW TABLES FROM defaultdb;
SQL

echo ""
echo "✅ CockroachDB tables initialized successfully!"
echo ""

# Verify the tables
echo "Verifying tables exist..."
docker exec -i catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure -e "SHOW TABLES FROM defaultdb;"

echo ""
echo "=== Initialization Complete ==="
