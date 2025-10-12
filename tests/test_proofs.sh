#!/bin/bash
source ../test_config.sh

echo "================================"
echo "TEST SUITE 4: PROOF VERIFICATION"
echo "================================"
echo ""

# Login as NGO
NGO_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenearth.org","password":"password"}' | jq -r '.token')

CAMPAIGN_ID=$(curl -s "$API/campaigns/active" | jq -r '.campaigns[0].id')

# Test 1: Upload Proof
echo "TEST 4.1: Upload Proof Document"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$API/proofs/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NGO_TOKEN" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"proofType\":\"Receipt\",\"description\":\"Test proof\",\"documentUrl\":\"test.pdf\"}")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
PROOF=$(echo "$RESULT" | head -n-1)
PROOF_ID=$(echo "$PROOF" | jq -r '.proof.id')
PROOF_STATUS=$(echo "$PROOF" | jq -r '.proof.verification_status')

assert_equals "$HTTP_CODE" "200" "Proof upload"
assert_equals "$PROOF_STATUS" "pending" "Proof pending verification"
assert_not_empty "$PROOF_ID" "Proof ID generated"

# Test 2: Verify Proof
echo "TEST 4.2: Verify Proof (Auto-Release Funds)"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$API/proofs/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NGO_TOKEN" \
  -d "{\"proofId\":\"$PROOF_ID\",\"status\":\"verified\",\"verificationNotes\":\"Test verification\"}")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
VERIFIED=$(echo "$RESULT" | head -n-1 | jq -r '.proof.verification_status')
assert_equals "$HTTP_CODE" "200" "Proof verification"
assert_equals "$VERIFIED" "verified" "Proof marked as verified"

# Test 3: Check if funds released
echo "TEST 4.3: Verify Funds Released from Escrow"
if [ -f /tmp/test_donation_id ]; then
  DONATION_ID=$(cat /tmp/test_donation_id)
  RESULT=$(curl -s "$API/donations/$DONATION_ID")
  ESCROW=$(echo "$RESULT" | jq -r '.donation.escrow_status')
  assert_equals "$ESCROW" "released" "Funds auto-released after verification"
fi

echo ""
print_summary "Proof Verification Tests"
