# Production Deployment Guide for admin.kowope.xyz

This guide explains how to deploy the Mottainai Admin Dashboard to your production server and connect it to your existing MongoDB database with 109 users.

## Prerequisites

- Production server: 172.232.24.180
- MongoDB running locally on production server (port 27017)
- Database name: `arcgis`
- 109 existing users in the database

## Deployment Steps

### Step 1: Publish the Dashboard

1. In the Manus UI, click the **Publish** button (top-right)
2. Wait for the deployment to complete
3. The dashboard will be available at your configured domain

### Step 2: Update MongoDB Connection

Since MongoDB is configured to only accept local connections (`bindIp: 127.0.0.1`), the dashboard **must be deployed on the same server** (172.232.24.180) or you need to enable remote access.

**Option A: Deploy on Same Server (Recommended)**

1. After publishing, go to **Settings → Secrets** in the Management UI
2. Update `MONGODB_URI` to: `mongodb://127.0.0.1:27017/arcgis`
3. The dashboard will automatically reconnect and show all 109 users

**Option B: Enable Remote MongoDB Access (Not Recommended without authentication)**

1. SSH into the production server:
   ```bash
   ssh root@172.232.24.180
   ```

2. Edit MongoDB configuration:
   ```bash
   sudo nano /etc/mongod.conf
   ```

3. Change `bindIp` from `127.0.0.1` to `0.0.0.0`:
   ```yaml
   net:
     port: 27017
     bindIp: 0.0.0.0
   ```

4. Restart MongoDB:
   ```bash
   sudo systemctl restart mongod
   ```

5. Update `MONGODB_URI` in Settings → Secrets:
   ```
   mongodb://172.232.24.180:27017/arcgis
   ```

⚠️ **Security Warning**: Opening MongoDB to `0.0.0.0` without authentication is a security risk. Add authentication first:

```bash
# Create admin user in MongoDB
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "your-secure-password",
  roles: ["root"]
})

# Enable authentication in /etc/mongod.conf
security:
  authorization: enabled

# Update MONGODB_URI with credentials
mongodb://admin:your-secure-password@172.232.24.180:27017/arcgis?authSource=admin
```

### Step 3: Verify Deployment

1. Navigate to admin.kowope.xyz
2. Login with credentials: `admin` / `admin123`
3. Go to **User Management**
4. Verify all 109 users are visible
5. Test search and filtering
6. Test creating a new user
7. Check **Audit Log** for activity tracking

## Production Checklist

- [ ] Dashboard published and accessible at admin.kowope.xyz
- [ ] MONGODB_URI updated to connect to production database
- [ ] All 109 existing users visible in User Management
- [ ] Search and filtering working correctly
- [ ] Bulk CSV import tested
- [ ] Audit logging enabled and working
- [ ] Password reset functionality tested
- [ ] Change default admin password from `admin123` to a secure password

## Troubleshooting

### Dashboard shows "Loading users..." forever
- Check MongoDB connection status in browser console
- Verify MONGODB_URI is correct in Settings → Secrets
- Check MongoDB is running: `sudo systemctl status mongod`

### No users showing up
- Verify database name is `arcgis`
- Check collection name is `users`
- Run test query: `mongosh arcgis --eval "db.users.count()"`

### Connection timeout errors
- Verify MongoDB bindIp configuration
- Check firewall rules if using remote connection
- Ensure MongoDB is listening on the correct port

## Next Steps After Deployment

1. **Change Admin Password**: Update the default `admin123` password
2. **Add More Admins**: Create additional admin accounts for team members
3. **Configure Email Notifications**: Set up email service for password resets
4. **Enable HTTPS**: Ensure admin.kowope.xyz uses HTTPS for security
5. **Set up Backups**: Configure automated MongoDB backups
6. **Monitor Audit Logs**: Regularly review audit logs for security

## Support

For issues or questions, refer to:
- MongoDB Setup Guide: `MONGODB_SETUP.md`
- Test MongoDB connection: `pnpm tsx server/testMongoConnection.ts`
