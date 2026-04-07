# Mottainai Admin Dashboard — Developer Guide

## WARNING: How to Deploy

ALWAYS use the deploy script. NEVER run pnpm build directly.

  bash /var/www/mottainai-dashboard/deploy.sh

### Why this matters

Running pnpm build directly will produce a broken build where:
- The browser tab shows %VITE_APP_TITLE% instead of "Mottainai Admin Dashboard"
- Analytics placeholders remain unresolved in the HTML

The deploy.sh script:
1. Confirms you are in the correct project directory (DEPLOY_IDENTITY check)
2. Injects the correct VITE_APP_TITLE, VITE_APP_LOGO, and analytics env vars
3. Verifies the built index.html title before restarting PM2
4. Confirms the cherry_picker role is present in the server bundle
5. Restarts PM2 only after all checks pass

## Project Identity
- Domain: admin.kowope.xyz
- PM2 process: mottainai-dashboard (id=6)
- Port: 3005
- Nginx root: /var/www/mottainai-dashboard/dist/public

## ArcGIS Layer
The dashboard uses the Nigeria_Building_Footprints layer:
- Item ID: 00456d3fb66c4868987aaf71d7f1c3be
- Service URL: https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Nigeria_Building_Footprints/FeatureServer/0
- Spatial Reference: WGS84 (EPSG:4326)
Do NOT revert to the old New_Footprints_gdb_b1422 layer.
