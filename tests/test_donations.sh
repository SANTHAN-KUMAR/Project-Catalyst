#!/bin/bash
source ../test_config.sh

echo "================================"
echo "TEST SUITE 3: DONATIONS & ESCROW"
echo "================================"
echo ""

# Login
DONOR_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"senthankarnala@gmail.com","password":"lucky2006"}' | jq -r '.token')

CAMPAIGN_ID=$(curl -s "$API/campaigns/active" | jq -r '.campaigns[0].id')

# Test 1: Create Donation
echo "TEST 3.1: Create Donation (Escrow)"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$API/donations/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DONOR_TOKEN" \
  -d "{\"campaignId\":\"$CAMPAIGN_ID\",\"amount\":1000,\"paymentMethod\":\"UPI\",\"message\":\"Test donation\"}")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
DONATION=$(echo "$RESULT" | head -n-1)
DONATION_ID=$(echo "$DONATION" | jq -r '.donation.id')
ESCROW_STATUS=$(echo "$DONATION" | jq -r '.donation.escrow_status')

assert_equals "$HTTP_CODE" "200" "Donation creation"
assert_equals "$ESCROW_STATUS" "held" "Funds in escrow"
assert_not_empty "$DONATION_ID" "Donation ID generated"

# Test 2: Get User Donations
echo "TEST 3.2: Get User Donations"
RESULT=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $DONOR_TOKEN" "$API/donations/user")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
DONATIONS=$(echo "$RESULT" | head -n-1 | jq '.donations | length')
assert_equals "$HTTP_CODE" "200" "Get user donations"
assert_greater_than "$DONATIONS" "0" "User has donations"

# Test 3: Get Donation by ID (Tracking)
echo "TEST 3.3: Donation Tracking"
RESULT=$(curl -s -w "\n%{http_code}" "$API/donations/$DONATION_ID")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
DONATION_DATA=$(echo "$RESULT" | head -n-1)
assert_equals "$HTTP_CODE" "200" "Get donation details"

# Save donation ID for next tests
echo "$DONATION_ID" > /tmp/test_donation_id

echo ""
print_summary "Donation & Escrow Tests"
