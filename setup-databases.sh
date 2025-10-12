#!/bin/bash

# Database Setup Script for Project Catalyst
# This script initializes both PostgreSQL and CockroachDB

echo "=========================================="
echo "Project Catalyst - Database Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Setting up PostgreSQL...${NC}"
echo "Creating init-postgres.sql if it doesn't exist..."

# Create db-init directory if it doesn't exist
mkdir -p db-init

# Create PostgreSQL init script
cat > db-init/init-postgres.sql << 'EOF'
-- PostgreSQL Initialization Script
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('donor', 'ngo_admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ngos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    registration_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_ngos_owner_id ON ngos(owner_id);
CREATE INDEX IF NOT EXISTS idx_ngos_status ON ngos(status);
CREATE INDEX IF NOT EXISTS idx_ngos_registration_id ON ngos(registration_id);
EOF

echo -e "${GREEN}✓ PostgreSQL init script created${NC}"

echo ""
echo -e "${YELLOW}Step 2: Initializing PostgreSQL database...${NC}"
docker exec -i catalyst-postgres psql -U catalyst_user -d catalyst_users < db-init/init-postgres.sql
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PostgreSQL initialized successfully${NC}"
else
    echo -e "${RED}✗ PostgreSQL initialization failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Setting up CockroachDB...${NC}"

# Create CockroachDB init script
cat > db-init/init-cockroach.sql << 'EOF'
-- CockroachDB Initialization Script
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
EOF

echo -e "${GREEN}✓ CockroachDB init script created${NC}"

echo ""
echo -e "${YELLOW}Step 4: Initializing CockroachDB database...${NC}"
docker exec -i catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure < db-init/init-cockroach.sql
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ CockroachDB initialized successfully${NC}"
else
    echo -e "${RED}✗ CockroachDB initialization failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 5: Verifying database setup...${NC}"

# Verify PostgreSQL tables
echo "Checking PostgreSQL tables..."
docker exec catalyst-postgres psql -U catalyst_user -d catalyst_users -c "\dt"

echo ""
echo "Checking CockroachDB tables..."
docker exec catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure -e "SHOW TABLES FROM defaultdb;"

echo ""
echo -e "${GREEN}=========================================="
echo "Database setup completed successfully!"
echo "==========================================${NC}"
echo ""
echo "You can now use your application with:"
echo "  - PostgreSQL: users, ngos tables"
echo "  - CockroachDB: audit_trail, donations tables"
echo ""
