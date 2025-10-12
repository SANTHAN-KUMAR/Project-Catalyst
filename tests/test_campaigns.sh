#!/bin/bash
source ../test_config.sh

echo "================================"
echo "TEST SUITE 2: CAMPAIGNS"
echo "================================"
echo ""

# Login as NGO
NGO_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenearth.org","password":"password"}' | jq -r '.token')

# Test 1: Get Active Campaigns
echo "TEST 2.1: Get Active Campaigns"
RESULT=$(curl -s -w "\n%{http_code}" "$API/campaigns/active")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
CAMPAIGNS=$(echo "$RESULT" | head -n-1 | jq '.campaigns | length')
assert_equals "$HTTP_CODE" "200" "Get campaigns"
assert_greater_than "$CAMPAIGNS" "0" "Campaigns exist"

# Test 2: Get Campaign Details
echo "TEST 2.2: Get Campaign Details"
CAMPAIGN_ID=$(curl -s "$API/campaigns/active" | jq -r '.campaigns[0].id')
RESULT=$(curl -s -w "\n%{http_code}" "$API/campaigns/$CAMPAIGN_ID")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
assert_equals "$HTTP_CODE" "200" "Get campaign details"

# Test 3: Create Campaign (with auth)
echo "TEST 2.3: Create Campaign"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$API/campaigns/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NGO_TOKEN" \
  -d '{"title":"Test Campaign","description":"Test","goalAmount":10000,"category":"Education","endDate":"2025-12-31"}')
HTTP_CODE=$(echo "$RESULT" | tail -n1)
assert_equals "$HTTP_CODE" "200" "Campaign creation"

echo ""
print_summary "Campaign Tests"
