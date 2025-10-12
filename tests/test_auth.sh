#!/bin/bash
source ../test_config.sh

echo "================================"
echo "TEST SUITE 1: AUTHENTICATION"
echo "================================"
echo ""

# Test 1: User Registration
echo "TEST 1.1: Donor Registration"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Donor","email":"test'$(date +%s)'@example.com","password":"test123"}')
HTTP_CODE=$(echo "$RESULT" | tail -n1)
assert_equals "$HTTP_CODE" "200" "Donor registration"

# Test 2: User Login
echo "TEST 1.2: User Login"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"senthankarnala@gmail.com","password":"lucky2006"}')
HTTP_CODE=$(echo "$RESULT" | tail -n1)
TOKEN=$(echo "$RESULT" | head -n-1 | jq -r '.token')
assert_equals "$HTTP_CODE" "200" "User login"
assert_not_empty "$TOKEN" "JWT token generation"

# Test 3: Invalid credentials
echo "TEST 1.3: Invalid Credentials"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@email.com","password":"wrongpass"}')
HTTP_CODE=$(echo "$RESULT" | tail -n1)
assert_equals "$HTTP_CODE" "401" "Invalid credentials rejection"

echo ""
print_summary "Authentication Tests"
