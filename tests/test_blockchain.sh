#!/bin/bash
source ../test_config.sh

echo "================================"
echo "TEST SUITE 5: BLOCKCHAIN & AUDIT"
echo "================================"
echo ""

# Test 1: Blockchain Status
echo "TEST 5.1: Blockchain Service Status"
RESULT=$(curl -s -w "\n%{http_code}" "$API_BASE/blockchain/status")
HTTP_CODE=$(echo "$RESULT" | tail -n1)
assert_equals "$HTTP_CODE" "200" "Blockchain service operational"

# Test 2: Audit Trail Immutability
echo "TEST 5.2: Audit Trail Exists"
DONOR_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"senthankarnala@gmail.com","password":"lucky2006"}' | jq -r '.token')
RESULT=$(curl -s -H "Authorization: Bearer $DONOR_TOKEN" "$API/donations/user")
DONATIONS=$(echo "$RESULT" | jq '.donations | length')
assert_greater_than "$DONATIONS" "0" "Audit trail contains records"

# Test 3: Data Integrity
echo "TEST 5.3: Transaction Data Integrity"
DONATION=$(echo "$RESULT" | jq '.donations[0]')
HAS_ID=$(echo "$DONATION" | jq 'has("id")')
HAS_AMOUNT=$(echo "$DONATION" | jq 'has("amount")')
HAS_TIMESTAMP=$(echo "$DONATION" | jq 'has("created_at")')
assert_equals "$HAS_ID" "true" "Transaction has ID"
assert_equals "$HAS_AMOUNT" "true" "Transaction has amount"
assert_equals "$HAS_TIMESTAMP" "true" "Transaction has timestamp"

echo ""
print_summary "Blockchain & Audit Tests"
