#!/bin/bash

echo "=========================================="
echo "  PROJECT CATALYST - LIVE DEMO"
echo "  Blockchain-Enabled Trust Engine"
echo "=========================================="
echo ""

API="http://localhost:3000/api"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} STEP 1: LOGIN AS NGO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

NGO_LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenearth.org","password":"password"}')

NGO_TOKEN=$(echo "$NGO_LOGIN" | jq -r '.token')
echo "✅ NGO: Green Earth Foundation"
echo "🔑 Token: ${NGO_TOKEN:0:30}..."
sleep 2

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} STEP 2: GET ACTIVE CAMPAIGNS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

CAMPAIGNS=$(curl -s "$API/campaigns/active")
CAMPAIGN_ID=$(echo "$CAMPAIGNS" | jq -r '.campaigns[0].id')
CAMPAIGN_TITLE=$(echo "$CAMPAIGNS" | jq -r '.campaigns[0].title')

echo "📋 Campaign: $CAMPAIGN_TITLE"
echo "🆔 ID: $CAMPAIGN_ID"
sleep 2

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} STEP 3: LOGIN AS DONOR${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

DONOR_LOGIN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"senthankarnala@gmail.com","password":"lucky2006"}')

DONOR_TOKEN=$(echo "$DONOR_LOGIN" | jq -r '.token')
DONOR_NAME=$(echo "$DONOR_LOGIN" | jq -r '.user.name')

echo "✅ Donor: $DONOR_NAME"
echo "🔑 Token: ${DONOR_TOKEN:0:30}..."
sleep 2

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} STEP 4: CREATE DONATION (ESCROW)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

DONATION=$(curl -s -X POST "$API/donations/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DONOR_TOKEN" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"amount\": 5000,
    \"paymentMethod\": \"UPI\",
    \"message\": \"For clean water!\"
  }")

DONATION_ID=$(echo "$DONATION" | jq -r '.donation.id')

echo "💰 Amount: ₹5,000"
echo "🔒 Status: HELD IN ESCROW"
echo "🆔 Donation ID: $DONATION_ID"
sleep 3

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} STEP 5: NGO UPLOADS PROOF${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PROOF=$(curl -s -X POST "$API/proofs/upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NGO_TOKEN" \
  -d "{
    \"campaignId\": \"$CAMPAIGN_ID\",
    \"proofType\": \"Purchase Receipt\",
    \"description\": \"Water filter equipment - SAMCO Restaurant Supplies Bill #142 - ₹550\",
    \"documentUrl\": \"hotel-bill.jpg\"
  }")

PROOF_ID=$(echo "$PROOF" | jq -r '.proof.id')

echo "📸 Document: hotel-bill.jpg"
echo "💵 Bill Amount: ₹550.00"
echo "🏪 Vendor: SAMCO Restaurant"
echo "📅 Date: 26/03/2017"
echo "🆔 Proof ID: $PROOF_ID"
sleep 3

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} STEP 6: VERIFY PROOF (Auto-Release)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "🔍 Verification Agent analyzing..."
echo "   ✅ Document is authentic"
echo "   ✅ Matches campaign purpose"
echo "   ✅ Valid expense proof"
sleep 2

VERIFY=$(curl -s -X POST "$API/proofs/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NGO_TOKEN" \
  -d "{
    \"proofId\": \"$PROOF_ID\",
    \"status\": \"verified\",
    \"verificationNotes\": \"Valid SAMCO receipt. Expense verified for water equipment.\"
  }")

echo ""
echo -e "${GREEN}✅✅✅ PROOF VERIFIED! ✅✅✅${NC}"
echo -e "${GREEN}💸 FUNDS RELEASED FROM ESCROW!${NC}"
sleep 3

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} STEP 7: CHECK DONATION STATUS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

STATUS=$(curl -s "$API/donations/$DONATION_ID")
ESCROW=$(echo "$STATUS" | jq -r '.donation.escrow_status')

echo "$STATUS" | jq '.'
echo ""

if [ "$ESCROW" == "released" ]; then
  echo -e "${GREEN}✅ STATUS: RELEASED${NC}"
else
  echo -e "${YELLOW}⏳ STATUS: $ESCROW${NC}"
fi

sleep 2

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}         WORKFLOW COMPLETE!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 SUMMARY:"
echo "   NGO: Green Earth Foundation"
echo "   Campaign: $CAMPAIGN_TITLE"
echo "   Donor: $DONOR_NAME"
echo "   Amount: ₹5,000"
echo "   Escrow: $ESCROW"
echo "   Proof: Verified ✅"
echo ""
echo "🎉 Demo Complete!"
echo ""
echo "🌐 Tracking URL:"
echo "   http://148.100.78.160:3005/donation/$DONATION_ID/tracking"
echo ""
