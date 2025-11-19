# Production Deployment Guide

## Current Status

✅ **Code Complete:** Lot integration with 26 active lots is fully implemented  
✅ **Nginx Fixed:** React SPA now loads correctly at https://admin.kowope.xyz  
⚠️ **Authentication Issue:** React dashboard requires Manus OAuth which needs platform environment variables

---

## The Challenge

The new React dashboard (mottainai-admin-dashboard) uses **Manus OAuth** for authentication, which requires these environment variables:

```bash
VITE_APP_ID=<manus_app_id>
JWT_SECRET=<secret_key>
DATABASE_URL=<mongodb_connection_string>
OAUTH_SERVER_URL=https://api.manus.im
OWNER_OPEN_ID=<owner_id>
BUILT_IN_FORGE_API_URL=<manus_api_url>
BUILT_IN_FORGE_API_KEY=<manus_api_key>
```

These are automatically provided in the Manus platform but not available on your custom production server (172.232.24.180).

---

## Solution Options

### Option 1: Deploy via Manus Platform (Recommended)

**Pros:**
- All environment variables automatically configured
- OAuth authentication works out of the box
- Managed hosting and SSL
- Easy updates via checkpoint system

**Steps:**
1. The project is already saved as checkpoint `d3a532b7`
2. In Manus UI, click "Publish" button
3. Manus will deploy to their infrastructure with all env vars
4. You get a `*.manus.space` domain or can bind custom domain

**Cons:**
- Hosted on Manus infrastructure (not your VPS)
- Requires Manus subscription

---

### Option 2: Use Old HTML Dashboard with Lot API

**Pros:**
- Works on your existing server
- Simple username/password auth
- No OAuth dependencies

**Steps:**
1. Keep old HTML dashboard at `https://admin.kowope.xyz/dashboard` (port 8080)
2. Update old dashboard's JavaScript to call new lot API:
   ```javascript
   // Instead of hardcoded lots, fetch from API
   fetch('https://admin.kowope.xyz/api/trpc/lots.list')
     .then(r => r.json())
     .then(data => {
       // Populate lot dropdown
     });
   ```
3. Backend API is already running on port 3000 and accessible

**Cons:**
- Old UI (not the new React dashboard)
- Need to modify old dashboard code

---

### Option 3: Implement Simple Auth for React Dashboard

**Pros:**
- Use new React dashboard
- Works on your server
- Custom authentication

**Steps:**
1. Replace Manus OAuth with simple JWT authentication
2. Create login endpoint that validates username/password against MongoDB
3. Update frontend to use new auth flow
4. Set required environment variables on production server

**Implementation:**
```typescript
// server/routers.ts - Add simple auth
auth: router({
  login: publicProcedure
    .input(z.object({ username: z.string(), password: z.string() }))
    .mutation(async ({ input }) => {
      // Validate against MongoDB users collection
      const user = await db.users.findOne({ username: input.username });
      if (user && await bcrypt.compare(input.password, user.password)) {
        return { token: jwt.sign({ userId: user._id }, JWT_SECRET) };
      }
      throw new Error('Invalid credentials');
    }),
}),
```

**Cons:**
- Requires code changes
- Need to manage JWT secrets
- More complex than Option 1 or 2

---

## Current Server Setup

### What's Running

| Service | Port | Status | Purpose |
|---------|------|--------|---------|
| Old HTML Dashboard | 8080 | ✅ Running | Simple auth, working |
| React Dashboard Backend | 3000 | ✅ Running | tRPC API with lot endpoint |
| Nginx (admin.kowope.xyz) | 443 | ✅ Configured | Serves React frontend, proxies API |

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/admin.kowope.xyz.conf
server {
    listen 443 ssl http2;
    server_name admin.kowope.xyz;
    
    root /var/www/mottainai-dashboard/public;
    
    # API proxy to React backend
    location /api/ {
        proxy_pass http://localhost:3000/;
    }
    
    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### PM2 Processes

```bash
pm2 list
# mottainai-dashboard (id: 1) - React backend on port 3000
# dashboard-server (id: 2) - Old HTML dashboard on port 8080
```

---

## Recommended Path Forward

### Immediate Solution (5 minutes)

**Use old dashboard with new lot API:**

1. Access old dashboard: `https://admin.kowope.xyz/dashboard` (HTTP Basic Auth)
2. Update old dashboard's company management page to fetch lots from:
   ```
   GET https://admin.kowope.xyz/api/trpc/lots.list
   ```
3. This gives you lot integration without auth issues

### Long-term Solution (Recommended)

**Deploy via Manus Platform:**

1. Use the checkpoint I created (`d3a532b7`)
2. Click "Publish" in Manus UI
3. Get fully working React dashboard with OAuth
4. Bind your custom domain if needed

---

## Testing the Lot API

The lot API is working and accessible:

```bash
# Test from command line
curl https://admin.kowope.xyz/api/trpc/lots.list

# Should return JSON with 26 lots:
{
  "result": {
    "data": [
      {
        "OBJECTID": 1,
        "Lot_ID": 1,
        "ward_name": "Agbado/Oke-Odo",
        "lga_name": "Alimosho",
        "Business_Name": "Urban Spirit",
        ...
      },
      ...
    ]
  }
}
```

---

## Environment Variables Needed (If Going with Option 3)

Create `/var/www/mottainai-dashboard/.env`:

```bash
# Database
DATABASE_URL=mongodb://172.232.24.180:27017/mottainai

# JWT for sessions
JWT_SECRET=your-secret-key-here-change-this

# App config (can be dummy values for standalone)
VITE_APP_ID=standalone
OWNER_OPEN_ID=admin
OAUTH_SERVER_URL=http://localhost:3000/auth/mock

# Optional: Manus APIs (not needed for basic functionality)
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

Then restart PM2:
```bash
cd /var/www/mottainai-dashboard
pm2 restart mottainai-dashboard --update-env
```

---

## Summary

**What Works:**
- ✅ Lot integration code (26 lots from Excel)
- ✅ tRPC API endpoint serving lot data
- ✅ LotSelector React component
- ✅ Companies page integration
- ✅ Nginx configuration for React SPA
- ✅ Backend running on production server

**What's Blocked:**
- ⚠️ React dashboard login (needs OAuth env vars)

**Next Step:**
Choose one of the three options above based on your needs. I recommend **Option 1 (Manus Platform)** for simplicity, or **Option 2 (Old Dashboard + API)** if you want to stay on your VPS.

---

## Questions?

- **Can I test the lot selector locally?** Yes, but you'll need to connect to your production MongoDB
- **Can I use both dashboards?** Yes, old dashboard at `/dashboard`, new at `/` (once auth is fixed)
- **Will mobile app work?** Yes, mobile app can call the lot API at `/api/trpc/lots.list`
