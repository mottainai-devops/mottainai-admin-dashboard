# Quick Start Guide - Deploy to admin.kowope.xyz

Follow these steps to deploy the Mottainai Admin Dashboard to production and connect it to your 109 existing users.

## Step 1: Publish the Dashboard (2 minutes)

1. In the Manus UI (top-right corner), click the **Publish** button
2. Wait for the deployment to complete (usually 1-2 minutes)
3. You'll see a success message when deployment is done

## Step 2: Update MongoDB Connection (1 minute)

1. Click the **Settings** icon (gear icon) in the Manus UI
2. Navigate to **Secrets** in the left sidebar
3. Find the `MONGODB_URI` variable
4. Click **Edit**
5. Change the value to: `mongodb://127.0.0.1:27017/arcgis`
6. Click **Save**
7. Wait 30 seconds for the server to reconnect

## Step 3: Test the Deployment (5 minutes)

1. Open https://admin.kowope.xyz in your browser
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. Click "User Management"
4. **Verify**: You should see all **109 users** from your database
5. Test search by typing a name in the search box
6. Test filtering by selecting a role or company

## Step 4: Change Admin Password (1 minute)

**IMPORTANT**: Change the default password for security!

1. Go to User Management
2. Find the "admin" user
3. Click the edit button
4. Change the password to a secure one
5. Save changes
6. Logout and login with the new password

## Step 5: Verify All Features (10 minutes)

Use the comprehensive checklist: `PRODUCTION_TEST_CHECKLIST.md`

Quick verification:
- [ ] All 109 users visible
- [ ] Search works
- [ ] Filtering works
- [ ] Can create new user
- [ ] Can edit user
- [ ] Can delete user
- [ ] Bulk CSV import works
- [ ] Audit log shows activity
- [ ] Password reset works

## Troubleshooting

### "Loading users..." forever
- **Cause**: MongoDB not connected
- **Fix**: Verify MONGODB_URI is `mongodb://127.0.0.1:27017/arcgis` in Settings → Secrets

### No users showing
- **Cause**: Wrong database name
- **Fix**: Ensure database name is `arcgis` in MONGODB_URI

### Login takes 10-15 seconds
- **Cause**: Manus proxy latency (normal in preview)
- **Fix**: This will be faster in production deployment

### "Invalid credentials" error
- **Cause**: Wrong username/password
- **Fix**: Use `admin` / `admin123` (default credentials)

## Next Steps

After successful deployment:

1. **Add more admins**: Create additional admin accounts for your team
2. **Import users**: Use bulk CSV import to add multiple users at once
3. **Monitor activity**: Check Audit Log regularly for security
4. **Set up backups**: Configure automated MongoDB backups
5. **Enable HTTPS**: Ensure admin.kowope.xyz uses HTTPS

## Support Files

- **Detailed deployment guide**: `PRODUCTION_DEPLOYMENT.md`
- **Testing checklist**: `PRODUCTION_TEST_CHECKLIST.md`
- **MongoDB setup**: `MONGODB_SETUP.md`
- **Verification script**: `scripts/verify-production.sh`

## Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review `PRODUCTION_DEPLOYMENT.md` for detailed instructions
3. Run the verification script: `./scripts/verify-production.sh`
4. Check MongoDB status: `ssh root@172.232.24.180 "sudo systemctl status mongod"`

## Summary

✅ **You're done!** Your admin dashboard is now live at https://admin.kowope.xyz with all 109 users accessible.

**Total time**: ~20 minutes
