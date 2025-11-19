#!/bin/bash

# Deploy Mottainai Admin Dashboard to Custom Server (172.232.24.180)
# This script uploads the built files and restarts the backend

set -e  # Exit on error

SERVER="172.232.24.180"
USER="root"
PASSWORD="1muser123456@A"
REMOTE_PATH="/var/www/mottainai-dashboard"
LOCAL_DIST="dist"

echo "================================"
echo "Deploying to Custom Server"
echo "================================"
echo ""
echo "Server: $SERVER"
echo "Path: $REMOTE_PATH"
echo ""

# Check if dist folder exists
if [ ! -d "$LOCAL_DIST" ]; then
    echo "❌ Error: dist folder not found. Run 'pnpm run build' first."
    exit 1
fi

echo "Step 1: Creating backup on server..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$SERVER \
    "cd $REMOTE_PATH && \
     mkdir -p backups && \
     BACKUP_NAME=backup-\$(date +%Y%m%d-%H%M%S) && \
     echo Creating backup: \$BACKUP_NAME && \
     cp -r dist backups/\$BACKUP_NAME 2>/dev/null || echo 'No existing dist to backup'"

echo ""
echo "Step 2: Uploading new files..."
# Upload public folder (frontend)
echo "  - Uploading frontend (public)..."
sshpass -p "$PASSWORD" rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    $LOCAL_DIST/public/ $USER@$SERVER:$REMOTE_PATH/public/

# Upload backend index.js
echo "  - Uploading backend (index.js)..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no \
    $LOCAL_DIST/index.js $USER@$SERVER:$REMOTE_PATH/dist/

# Upload package.json and node_modules if needed
echo "  - Uploading package.json..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no \
    package.json $USER@$SERVER:$REMOTE_PATH/

# Upload shared folder (contains active_lots.json)
echo "  - Uploading shared folder..."
sshpass -p "$PASSWORD" rsync -avz \
    -e "ssh -o StrictHostKeyChecking=no" \
    shared/ $USER@$SERVER:$REMOTE_PATH/shared/

# Upload Excel file for lots
echo "  - Uploading lot data..."
sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no \
    data/Lot_Layer_V4-1.xlsx $USER@$SERVER:$REMOTE_PATH/data/ 2>/dev/null || echo "  (Lot data file not found, skipping)"

echo ""
echo "Step 3: Installing dependencies on server..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$SERVER \
    "cd $REMOTE_PATH && pnpm install --prod 2>&1 | tail -5"

echo ""
echo "Step 4: Restarting PM2 process..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$SERVER \
    "pm2 restart mottainai-dashboard 2>&1 || pm2 start dist/index.js --name mottainai-dashboard"

echo ""
echo "Step 5: Checking deployment status..."
sleep 3
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no $USER@$SERVER \
    "pm2 status mottainai-dashboard"

echo ""
echo "================================"
echo "✅ Deployment Complete!"
echo "================================"
echo ""
echo "Testing endpoints..."
echo ""

# Test health endpoint
echo -n "Health check: "
curl -s -o /dev/null -w "HTTP %{http_code}\n" "https://admin.kowope.xyz/api/health"

# Test login endpoint
echo -n "Login API: "
RESPONSE=$(curl -s -X POST "https://admin.kowope.xyz/api/trpc/simpleAuth.login" \
    -H "Content-Type: application/json" \
    -d '{"json":{"username":"admin","password":"admin123"}}')

if echo "$RESPONSE" | grep -q "token"; then
    echo "✅ Working"
else
    echo "❌ Failed"
    echo "Response: $RESPONSE"
fi

# Test listUsers endpoint
echo -n "List Users API: "
TOKEN=$(echo "$RESPONSE" | jq -r '.result.data.json.token' 2>/dev/null)
if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    USERS_RESPONSE=$(curl -s "https://admin.kowope.xyz/api/trpc/simpleAuth.listUsers" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$USERS_RESPONSE" | grep -q "error"; then
        echo "❌ Failed"
        echo "Response: $USERS_RESPONSE"
    else
        USER_COUNT=$(echo "$USERS_RESPONSE" | jq -r '.result.data.json | length' 2>/dev/null || echo "0")
        echo "✅ Working ($USER_COUNT users)"
    fi
else
    echo "⊘ Skipped (no token)"
fi

echo ""
echo "Dashboard URL: https://admin.kowope.xyz"
echo "Login: admin / admin123"
echo ""
