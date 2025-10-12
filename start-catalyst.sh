#!/bin/bash
set -e

echo "=== Starting Project Catalyst Platform ==="

# Stop any existing containers
echo "Stopping existing containers..."
docker compose down

# Initialize CockroachDB tables
echo "Ensuring CockroachDB tables exist..."
docker compose up -d cockroachdb
sleep 10

docker exec -i catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure << 'SQL'
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

CREATE INDEX IF NOT EXISTS audit_trail_target_idx ON defaultdb.audit_trail (target_id);
CREATE INDEX IF NOT EXISTS audit_trail_timestamp_idx ON defaultdb.audit_trail (timestamp);
CREATE INDEX IF NOT EXISTS audit_trail_actor_idx ON defaultdb.audit_trail (actor_id);
CREATE INDEX IF NOT EXISTS audit_trail_hash_idx ON defaultdb.audit_trail (current_hash);

CREATE TABLE IF NOT EXISTS defaultdb.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id INT NOT NULL,
    ngo_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status STRING NOT NULL DEFAULT 'pending',
    transaction_hash STRING,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS donations_donor_idx ON defaultdb.donations (donor_id);
CREATE INDEX IF NOT EXISTS donations_ngo_idx ON defaultdb.donations (ngo_id);
CREATE INDEX IF NOT EXISTS donations_status_idx ON defaultdb.donations (status);
SQL

echo "✅ CockroachDB tables initialized"

# Start all services
echo "Starting all services..."
docker compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 15

# Check status
echo ""
echo "=== Service Status ==="
docker compose ps

echo ""
echo "=== Platform Ready ==="
echo "Frontend: http://$(curl -s ifconfig.me):3005"
echo "API: http://$(curl -s ifconfig.me):3000"
echo "CockroachDB UI: http://$(curl -s ifconfig.me):8081"
