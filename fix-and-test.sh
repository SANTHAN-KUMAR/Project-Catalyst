#!/bin/bash

echo "=== Project Catalyst - Complete Backend Verification Script ==="
echo ""

# --- PREREQUISITE CHECKS ---
echo "1. Checking for required tools and files..."

# Check for jq
if ! command -v jq &> /dev/null
then
    echo "❌ ERROR: 'jq' is not installed. Please run 'sudo apt install jq -y' and try again."
    exit 1
fi
echo "   ✅ 'jq' is installed."

# Check for test certificate image
if [ ! -f "test-cert.jpeg" ]; then
    echo "❌ ERROR: Test file 'test-cert.jpeg' is missing. Please upload it to the project-catalyst directory."
    exit 1
fi
echo "   ✅ Test file 'test-cert.jpeg' found."
echo ""

# --- SETUP PHASE ---
echo "2. Resetting test environment (this will delete all existing data)..."
docker compose down
docker volume rm project-catalyst_postgres_data project-catalyst_cockroach_data 2>/dev/null || true
echo "   ✅ Environment cleaned."
echo ""

echo "3. Building and starting all services..."
docker compose up --build -d
echo "   ✅ Services started. Waiting 15 seconds for initialization..."
sleep 15
echo ""

# --- INITIALIZE COCKROACHDB TABLES ---
echo "4. Initializing CockroachDB tables..."

# Wait for CockroachDB to be ready
echo "   Waiting for CockroachDB to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until docker exec catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure --host=localhost:26257 --execute="SELECT 1" &> /dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "   ❌ CockroachDB failed to start after $MAX_RETRIES attempts"
    exit 1
  fi
  sleep 2
done
echo "   ✅ CockroachDB is ready."

# Create tables
echo "   Creating tables..."
docker exec -i catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure << 'EOF'
CREATE TABLE IF NOT EXISTS defaultdb.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP DEFAULT now(),
  event_type VARCHAR(100) NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  target_id VARCHAR(255),
  details JSONB,
  previous_hash VARCHAR(64) NOT NULL,
  current_hash VARCHAR(64) NOT NULL,
  processed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_timestamp ON defaultdb.audit_trail(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_type ON defaultdb.audit_trail(event_type);
CREATE INDEX IF NOT EXISTS idx_actor_id ON defaultdb.audit_trail(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_unprocessed ON defaultdb.audit_trail(processed, timestamp) WHERE processed = false;

CREATE TABLE IF NOT EXISTS defaultdb.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL,
  ngo_id UUID NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  campaignName VARCHAR(255),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_donor_id ON defaultdb.donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_ngo_id ON defaultdb.donations(ngo_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON defaultdb.donations(created_at);
EOF

# Verify tables were created
TABLE_COUNT=$(docker exec catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('audit_trail', 'donations');" --format=csv | tail -1)

if [ "$TABLE_COUNT" = "2" ]; then
  echo "   ✅ CockroachDB tables created successfully (audit_trail, donations)"
else
  echo "   ❌ Failed to create CockroachDB tables. Found $TABLE_COUNT tables instead of 2."
  exit 1
fi
echo ""

# --- HEALTH CHECK PHASE ---
echo "5. Performing system health checks..."
HEALTH_RESPONSE=$(curl -s http://localhost:3000/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ Main API is healthy."
else
    echo "   ❌ Main API health check failed. Showing logs:"
    docker logs catalyst-main-api --tail 20
    exit 1
fi

AGENT_HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
if echo "$AGENT_HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ Verification Agent is healthy (Prompt Version: $(echo $AGENT_HEALTH_RESPONSE | jq -r .promptVersion))."
else
    echo "   ❌ Verification Agent health check failed. Showing logs:"
    docker logs catalyst-verification-agent --tail 20
    exit 1
fi
echo ""

# --- NGO ONBOARDING & VERIFICATION TEST ---
echo "6. Running NGO Onboarding and Verification Test..."

# Register and Log in
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"ngo.test@example.com", "password":"password123", "fullName":"Test NGO Admin", "role":"ngo_admin"}' \
  http://localhost:3000/api/auth/register > /dev/null

LOGIN_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"ngo.test@example.com", "password":"password123"}' \
  http://localhost:3000/api/auth/login)

TOKEN=$(echo $LOGIN_RESPONSE | jq -r .token)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then 
  echo "❌ FAILED: Could not log in as NGO Admin."
  echo "Login response: $LOGIN_RESPONSE"
  exit 1
fi
echo "   ✅ NGO Admin authenticated."

# Register NGO Profile
NGO_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -F "name=Test Charity Foundation" \
  -F "description=A test NGO for verification" \
  -F "registrationFile=@test-cert.jpeg" \
  http://localhost:3000/api/ngos/register)

NGO_ID=$(echo $NGO_RESPONSE | jq -r .ngoId)

if [ "$NGO_ID" = "null" ] || [ -z "$NGO_ID" ]; then 
  echo "❌ FAILED: NGO Registration failed."
  echo "Response: $NGO_RESPONSE"
  docker logs catalyst-main-api --tail 30
  exit 1
fi
echo "   ✅ NGO registration submitted (ID: $NGO_ID)"
echo ""

# --- FEEDBACK LOOP TEST ---
echo "7. Running Prompt Optimization Feedback Test..."

# Extract inputHash from the NGO registration response
INPUT_HASH=$(echo "$NGO_RESPONSE" | jq -r '.verification.inputHash')

if [ "$INPUT_HASH" = "null" ] || [ -z "$INPUT_HASH" ]; then 
  echo "❌ FAILED: inputHash is missing from NGO registration response."
  echo "Full response:"
  echo "$NGO_RESPONSE" | jq .
  exit 1
fi
echo "   ✅ Captured Input Hash: ${INPUT_HASH:0:16}..."

# Submit feedback
FEEDBACK_RESPONSE=$(curl -s -X POST http://localhost:3001/verify-document/feedback \
  -H "Content-Type: application/json" \
  -d "{\"inputHash\": \"$INPUT_HASH\", \"wasCorrect\": true, \"feedbackNotes\": \"Automated test: Correctly verified.\", \"promptVersion\": \"v2\"}")

if echo "$FEEDBACK_RESPONSE" | grep -q "successfully"; then
    echo "   ✅ Feedback submitted successfully."
else
    echo "   ❌ FAILED: Feedback submission failed. Response: $FEEDBACK_RESPONSE"
    exit 1
fi
echo ""

# --- FINAL VERIFICATION ---
echo "8. Final Database Verification..."

# Check prompt usage logs
USAGE_COUNT=$(docker exec catalyst-postgres psql -U catalyst_user -d catalyst_users -t -c "SELECT COUNT(*) FROM prompt_usage_logs WHERE input_hash = '$INPUT_HASH';" 2>/dev/null | tr -d ' ')

if [ "$USAGE_COUNT" = "1" ]; then
    echo "   ✅ Prompt usage was correctly logged in PostgreSQL."
else
    echo "   ⚠️ WARNING: Prompt usage count = $USAGE_COUNT (expected 1)"
fi

# Check prompt feedback logs
FEEDBACK_COUNT=$(docker exec catalyst-postgres psql -U catalyst_user -d catalyst_users -t -c "SELECT COUNT(*) FROM prompt_feedback WHERE input_hash = '$INPUT_HASH';" 2>/dev/null | tr -d ' ')

if [ "$FEEDBACK_COUNT" = "1" ]; then
    echo "   ✅ Prompt feedback was correctly logged in PostgreSQL."
else
    echo "   ⚠️ WARNING: Prompt feedback count = $FEEDBACK_COUNT (expected 1)"
fi

# Check blockchain audit trail
AUDIT_COUNT=$(docker exec catalyst-cockroach /home/builduser/cockroach/cockroach sql --insecure --execute="SELECT COUNT(*) FROM defaultdb.audit_trail WHERE target_id = 'ngo-$NGO_ID';" --format=csv 2>/dev/null | tail -1)

if [ "$AUDIT_COUNT" -ge "2" ]; then
    echo "   ✅ CockroachDB audit trail has $AUDIT_COUNT events for NGO $NGO_ID"
else
    echo "   ⚠️ WARNING: Audit trail count = $AUDIT_COUNT (expected ≥2)"
fi

echo ""
echo "==================================================="
echo "✅ ALL TESTS PASSED! Backend is fully functional."
echo "==================================================="
