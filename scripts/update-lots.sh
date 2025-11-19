#!/bin/bash

###############################################################################
# Automated Lot Update Script
# 
# This script automates the process of updating lot data on the production server.
# It uploads a new Excel file and restarts the backend to load the new data.
#
# Usage:
#   ./update-lots.sh <path-to-excel-file>
#
# Example:
#   ./update-lots.sh ~/Downloads/Lot_Layer_V4-2.xlsx
#
###############################################################################

set -e  # Exit on error

# Configuration
PROD_SERVER="172.232.24.180"
PROD_USER="root"
PROD_PASSWORD="1muser123456@A"
PROD_PATH="/var/www/mottainai-dashboard/upload"
PM2_PROCESS="mottainai-dashboard"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if file argument is provided
if [ $# -eq 0 ]; then
    print_error "No Excel file provided"
    echo "Usage: $0 <path-to-excel-file>"
    echo "Example: $0 ~/Downloads/Lot_Layer_V4-2.xlsx"
    exit 1
fi

EXCEL_FILE="$1"

# Check if file exists
if [ ! -f "$EXCEL_FILE" ]; then
    print_error "File not found: $EXCEL_FILE"
    exit 1
fi

# Check if file is an Excel file
if [[ ! "$EXCEL_FILE" =~ \.(xlsx|xls)$ ]]; then
    print_warning "File does not have .xlsx or .xls extension. Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled"
        exit 0
    fi
fi

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    print_error "sshpass is not installed. Installing..."
    sudo apt-get update && sudo apt-get install -y sshpass
fi

print_info "Starting lot data update process..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Backup existing file
print_info "Step 1/4: Backing up existing lot data..."
sshpass -p "$PROD_PASSWORD" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_SERVER" \
    "cd $PROD_PATH && [ -f Lot_Layer_V4-1.xlsx ] && cp Lot_Layer_V4-1.xlsx Lot_Layer_V4-1.xlsx.backup-\$(date +%Y%m%d-%H%M%S) || echo 'No existing file to backup'"

# Step 2: Upload new file
print_info "Step 2/4: Uploading new lot data file..."
sshpass -p "$PROD_PASSWORD" scp -o StrictHostKeyChecking=no "$EXCEL_FILE" \
    "$PROD_USER@$PROD_SERVER:$PROD_PATH/Lot_Layer_V4-1.xlsx"

if [ $? -eq 0 ]; then
    print_info "✓ File uploaded successfully"
else
    print_error "Failed to upload file"
    exit 1
fi

# Step 3: Verify file
print_info "Step 3/4: Verifying uploaded file..."
FILE_SIZE=$(sshpass -p "$PROD_PASSWORD" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_SERVER" \
    "stat -f%z $PROD_PATH/Lot_Layer_V4-1.xlsx 2>/dev/null || stat -c%s $PROD_PATH/Lot_Layer_V4-1.xlsx")

if [ -n "$FILE_SIZE" ] && [ "$FILE_SIZE" -gt 0 ]; then
    print_info "✓ File verified (Size: $FILE_SIZE bytes)"
else
    print_error "File verification failed"
    exit 1
fi

# Step 4: Restart backend
print_info "Step 4/4: Restarting backend to load new data..."
sshpass -p "$PROD_PASSWORD" ssh -o StrictHostKeyChecking=no "$PROD_USER@$PROD_SERVER" \
    "pm2 restart $PM2_PROCESS"

if [ $? -eq 0 ]; then
    print_info "✓ Backend restarted successfully"
else
    print_error "Failed to restart backend"
    exit 1
fi

# Wait for backend to start
print_info "Waiting for backend to initialize..."
sleep 3

# Step 5: Test API endpoint
print_info "Testing API endpoint..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://admin.kowope.xyz/api/trpc/lots.list")

if [ "$RESPONSE" = "200" ]; then
    print_info "✓ API endpoint responding correctly"
    
    # Get lot count
    LOT_COUNT=$(curl -s "https://admin.kowope.xyz/api/trpc/lots.list" | \
        python3 -c "import json, sys; data=json.load(sys.stdin); print(len(data['result']['data']['json']))" 2>/dev/null || echo "unknown")
    
    if [ "$LOT_COUNT" != "unknown" ]; then
        print_info "✓ API returning $LOT_COUNT lots"
    fi
else
    print_warning "API endpoint returned status code: $RESPONSE"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_info "✅ Lot data update completed successfully!"
echo ""
print_info "Next steps:"
echo "  1. Test the API: curl https://admin.kowope.xyz/api/trpc/lots.list"
echo "  2. Mobile app will automatically fetch new data on next launch"
echo "  3. Check PM2 logs if needed: pm2 logs $PM2_PROCESS"
echo ""
print_info "Backup location: $PROD_PATH/Lot_Layer_V4-1.xlsx.backup-*"
