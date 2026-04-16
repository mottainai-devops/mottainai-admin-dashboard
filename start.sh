#!/bin/bash
# Startup script for mottainai-admin-dashboard
# This file is committed to the repo and deployed with every build.
# It is used by PM2 (process id 11) to start the server.
cd /var/www/mottainai-dashboard
exec node dist/index.js
