#!/bin/bash

# Verification Script for Applied Fixes
# Run this after restarting the server

BASE_URL="http://localhost:6740"
PASS=0
FAIL=0

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           🔍 VERIFYING APPLIED FIXES 🔍                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Helper function to test endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local method="${3:-GET}"
  local expected_status="${4:-200}"
  
  echo -n "Testing: $name ... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d '{}')
  fi
  
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$status" = "$expected_status" ]; then
    # Check if response is JSON (not HTML error)
    if echo "$body" | jq . >/dev/null 2>&1; then
      echo "✅ PASS (HTTP $status, valid JSON)"
      PASS=$((PASS + 1))
      return 0
    else
      echo "❌ FAIL (HTTP $status, but not JSON)"
      echo "   Response: $(echo "$body" | head -c 100)"
      FAIL=$((FAIL + 1))
      return 1
    fi
  else
    echo "❌ FAIL (HTTP $status, expected $expected_status)"
    echo "   Response: $(echo "$body" | head -c 100)"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 FIX 1: Approval Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create a test conversation first
echo "Setting up test conversation..."
TEST_RESPONSE=$(curl -s -X POST $BASE_URL/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message for approval verification", "energyBudget": 50}')
TEST_ID=$(echo $TEST_RESPONSE | jq -r '.requestId')
echo "Test conversation ID: $TEST_ID"
echo ""

sleep 2

# Test approval endpoints
test_endpoint "Get Approvals" "$BASE_URL/conversations/$TEST_ID/approvals"
test_endpoint "Approve Request" "$BASE_URL/conversations/$TEST_ID/approve" "POST"
test_endpoint "Reject Request" "$BASE_URL/conversations/$TEST_ID/reject" "POST"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 FIX 2: Apps Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "List Apps" "$BASE_URL/apps"
test_endpoint "Get App Details" "$BASE_URL/apps/chat"
test_endpoint "Get App Energy" "$BASE_URL/apps/chat/energy"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 EXISTING ENDPOINTS (Regression Check)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "Health Check" "$BASE_URL/health"
test_endpoint "Statistics" "$BASE_URL/stats"
test_endpoint "Conversations List" "$BASE_URL/conversations"
test_endpoint "Conversation Detail" "$BASE_URL/conversations/$TEST_ID"
test_endpoint "API Docs JSON" "$BASE_URL/api-docs.json"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 FIX 3: WebSocket Connection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -n "Testing: WebSocket Connection ... "
if command -v wscat >/dev/null 2>&1; then
  # Test with wscat if available
  timeout 2 wscat -c "ws://localhost:6740/ws" >/dev/null 2>&1
  if [ $? -eq 124 ]; then
    echo "✅ PASS (connection established)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL (connection refused)"
    FAIL=$((FAIL + 1))
  fi
elif [ -f "websocket-test.js" ]; then
  # Test with our Node.js script
  timeout 5 node websocket-test.js >/dev/null 2>&1
  if [ $? -eq 0 ] || [ $? -eq 124 ]; then
    echo "✅ PASS (connection established)"
    PASS=$((PASS + 1))
  else
    echo "❌ FAIL (connection refused)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "⚠️  SKIP (no WebSocket test tool available)"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VERIFICATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$((PASS + FAIL))
echo "Total Tests: $TOTAL"
echo "Passed: ✅ $PASS"
echo "Failed: ❌ $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║              ✅ ALL FIXES VERIFIED ✅                        ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  exit 0
else
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║         ⚠️  SOME TESTS FAILED - CHECK ABOVE ⚠️              ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Possible causes:"
  echo "  • Server not restarted after applying fixes"
  echo "  • Server running on different port"
  echo "  • Database initialization issues"
  echo ""
  echo "Try:"
  echo "  1. Restart the server: npm start"
  echo "  2. Check server logs for errors"
  echo "  3. Verify port 6740 is correct"
  exit 1
fi
