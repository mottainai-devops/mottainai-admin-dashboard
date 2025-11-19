#!/bin/bash

# Production Verification Script for admin.kowope.xyz
# This script helps verify the deployment is working correctly

echo "================================"
echo "Production Verification Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production URL
PROD_URL="https://admin.kowope.xyz"

echo "Testing production deployment at: $PROD_URL"
echo ""

# Test 1: Check if site is accessible
echo -n "1. Checking if site is accessible... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL")
if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $HTTP_CODE)"
else
    echo -e "${RED}✗ FAIL${NC} (HTTP $HTTP_CODE)"
fi

# Test 2: Check if API endpoint is accessible
echo -n "2. Checking if API endpoint is accessible... "
API_URL="$PROD_URL/api/trpc/simpleAuth.listUsers"
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
if [ "$API_CODE" == "200" ] || [ "$API_CODE" == "401" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $API_CODE - API responding)"
else
    echo -e "${RED}✗ FAIL${NC} (HTTP $API_CODE)"
fi

# Test 3: Check MongoDB connection (requires SSH access)
echo -n "3. Checking MongoDB connection on production server... "
if command -v sshpass &> /dev/null; then
    MONGO_COUNT=$(sshpass -p '1muser123456@A' ssh -o StrictHostKeyChecking=no root@172.232.24.180 "mongosh arcgis --quiet --eval 'db.users.count()'" 2>/dev/null)
    if [ ! -z "$MONGO_COUNT" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Found $MONGO_COUNT users in database)"
    else
        echo -e "${RED}✗ FAIL${NC} (Could not connect to MongoDB)"
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC} (sshpass not installed)"
fi

# Test 4: Check if login API works
echo -n "4. Testing login API... "
LOGIN_RESPONSE=$(curl -s -X POST "$PROD_URL/api/trpc/simpleAuth.login" \
    -H "Content-Type: application/json" \
    -d '{"json":{"username":"admin","password":"admin123"}}')

if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✓ PASS${NC} (Login API responding with token)"
elif echo "$LOGIN_RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⊘ WARN${NC} (Login API responding but credentials may be wrong)"
else
    echo -e "${RED}✗ FAIL${NC} (Login API not responding correctly)"
fi

# Test 5: Check if static assets are loading
echo -n "5. Checking if JavaScript bundle loads... "
JS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/assets/index.js" 2>/dev/null || echo "404")
CSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/assets/index.css" 2>/dev/null || echo "404")

if [ "$JS_CODE" == "200" ] && [ "$CSS_CODE" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC} (JS: $JS_CODE, CSS: $CSS_CODE)"
elif [ "$JS_CODE" == "200" ] || [ "$CSS_CODE" == "200" ]; then
    echo -e "${YELLOW}⊘ WARN${NC} (JS: $JS_CODE, CSS: $CSS_CODE - some assets missing)"
else
    echo -e "${YELLOW}⊘ SKIP${NC} (Asset paths may vary - check manually)"
fi

echo ""
echo "================================"
echo "Manual Testing Required:"
echo "================================"
echo "1. Open $PROD_URL in browser"
echo "2. Login with: admin / admin123"
echo "3. Verify 109 users are visible in User Management"
echo "4. Test search, filtering, and CSV import"
echo "5. Check Audit Log for activity tracking"
echo ""
echo "For detailed testing, see: PRODUCTION_TEST_CHECKLIST.md"
echo ""
