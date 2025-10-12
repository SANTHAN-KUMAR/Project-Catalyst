#!/bin/bash

# Configuration
API_BASE="http://localhost:3000"
API="$API_BASE/api"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Assert functions
assert_equals() {
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$1" == "$2" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $3"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $3 (Expected: $2, Got: $1)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

assert_not_empty() {
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ -n "$1" ] && [ "$1" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $2 (Value is empty or null)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

assert_greater_than() {
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$1" -gt "$2" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $3"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $3 (Value: $1, Expected > $2)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

print_summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$1 - Summary"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Tests Run: $TESTS_RUN"
  echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
  if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
  else
    echo "Failed: 0"
  fi
  echo ""
}
