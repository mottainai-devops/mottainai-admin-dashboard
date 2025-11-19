# Quick Nginx Fix Guide for admin.kowope.xyz

## Problem
React SPA not loading - getting 404/500 errors or redirect cycles

## Quick Fix (Copy from working config)

### Step 1: Check the working dashboard configuration
```bash
ssh root@172.232.24.180
cat /etc/nginx/sites-available/upwork.kowope.xyz | grep -A 50 "location /dashboard"
```

### Step 2: Apply this tested configuration

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name admin.kowope.xyz;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.kowope.xyz;

    ssl_certificate /etc/letsencrypt/live/admin.kowope.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.kowope.xyz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/mottainai-dashboard/public;
    index index.html;

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - KEY PART
    location / {
        try_files $uri $uri/index.html $uri.html /index.html;
    }
}
```

### Step 3: Test and reload
```bash
nginx -t
systemctl reload nginx
```

### Step 4: Clear browser cache and test
```bash
curl -I https://admin.kowope.xyz/
# Should return 200 OK with text/html content-type

curl -I https://admin.kowope.xyz/assets/index-v9RsOsH7.js
# Should return 200 OK with application/javascript content-type
```

## Alternative: Use subdirectory like /dashboard

If root path continues to have issues, deploy under `/admin` path:

```nginx
location /admin {
    alias /var/www/mottainai-dashboard/public;
    try_files $uri $uri/ /admin/index.html;
}

location /admin/api/ {
    proxy_pass http://localhost:4000/api/;
}
```

Then update Vite config:
```javascript
// vite.config.ts
export default defineConfig({
  base: '/admin/',
  // ...
})
```

Rebuild and redeploy.

## Verification Steps

1. Visit https://admin.kowope.xyz
2. Should see login page (not 404/500)
3. Open browser console - no MIME type errors
4. Check network tab - index.html returns 200
5. Check network tab - /assets/*.js returns 200 with correct MIME type
6. Login and navigate to Companies page
7. Click "Add Company" - lot selector should appear

## Files to Check

- Nginx config: `/etc/nginx/sites-available/admin.kowope.xyz.conf`
- Frontend files: `/var/www/mottainai-dashboard/public/`
- Backend process: `pm2 list` (should show mottainai-dashboard running)
- Backend logs: `pm2 logs mottainai-dashboard`

## Common Issues

### Issue: Assets return text/html instead of correct MIME type
**Fix:** Ensure `/assets/` location block comes BEFORE the `/` location block

### Issue: API calls return 404
**Fix:** Check PM2 process is running on port 4000: `pm2 list`

### Issue: Redirect cycle
**Fix:** Don't use `try_files $uri /index.html` - use `try_files $uri $uri/ /index.html` or error_page approach

### Issue: CORS errors on API calls
**Fix:** Ensure proxy_pass includes trailing slash: `proxy_pass http://localhost:4000/;`
