#!/bin/bash
# Startup script for mottainai-admin-dashboard
# This file is committed to the repo and deployed with every build.
# It is used by PM2 (process id 11) to start the server.
cd /var/www/mottainai-dashboard
# Load .env file if it exists (for server-side env vars like GOOGLE_MAPS_API_KEY)
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
exec node dist/index.js
