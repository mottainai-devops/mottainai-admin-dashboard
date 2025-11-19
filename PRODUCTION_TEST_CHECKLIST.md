# Production Testing Checklist for admin.kowope.xyz

This checklist helps you verify all features are working correctly after deploying to production.

## Pre-Deployment Checklist

- [ ] Click **Publish** button in Manus UI
- [ ] Wait for deployment to complete
- [ ] Go to **Settings → Secrets** in Management UI
- [ ] Update `MONGODB_URI` to: `mongodb://127.0.0.1:27017/arcgis`
- [ ] Wait 30 seconds for server to reconnect to MongoDB

## 1. Authentication & Login Testing

### Login Page
- [ ] Navigate to https://admin.kowope.xyz
- [ ] Verify login page loads correctly
- [ ] Test login with credentials: `admin` / `admin123`
- [ ] Verify "Logging in..." button shows (may take 10-15 seconds due to proxy)
- [ ] Verify successful redirect to dashboard home page
- [ ] Check browser console for any errors

### Password Reset
- [ ] Click "Forgot Password?" link on login page
- [ ] Enter username: `admin`
- [ ] Verify reset token is displayed (or email sent if user has email)
- [ ] Copy the reset token
- [ ] Navigate to reset password page
- [ ] Enter token and new password
- [ ] Verify password reset successful
- [ ] Login with new password
- [ ] **IMPORTANT**: Change password back to `admin123` for testing, or update test credentials

## 2. User Management Testing

### View Users
- [ ] Click "User Management" from dashboard
- [ ] Verify page loads (may take 10-15 seconds)
- [ ] **CRITICAL**: Verify all **109 users** are displayed
- [ ] Check user details show: fullName, email, role, company
- [ ] Verify pagination works if more than 20 users

### Search & Filter
- [ ] Test search by name (e.g., "Admin")
- [ ] Test search by email (e.g., "@gmail.com")
- [ ] Test filter by role: Select "Admin" - verify only admin users show
- [ ] Test filter by role: Select "User" - verify only regular users show
- [ ] Test filter by company: Select a company - verify only users from that company show
- [ ] Clear all filters - verify all 109 users return

### Create User
- [ ] Click "Add User" button
- [ ] Fill in form:
  - Username: `testuser`
  - Password: `Test123456`
  - Full Name: `Test User`
  - Email: `test@example.com`
  - Role: `user`
  - Company: Select any company
- [ ] Click "Create User"
- [ ] Verify success toast appears
- [ ] Verify new user appears in list (total: 110 users)
- [ ] Verify password is hashed (check audit log or database)

### Edit User
- [ ] Click edit button on test user
- [ ] Change full name to: `Test User Updated`
- [ ] Change role to: `admin`
- [ ] Click "Save Changes"
- [ ] Verify success toast appears
- [ ] Verify changes reflected in user list

### Delete User
- [ ] Click delete button on test user
- [ ] Verify confirmation dialog appears
- [ ] Click "Delete"
- [ ] Verify success toast appears
- [ ] Verify user removed from list (total: 109 users again)

### Bulk CSV Import
- [ ] Click "Bulk Import" button
- [ ] Click "Download Template" - verify CSV file downloads
- [ ] Open template in Excel/text editor
- [ ] Add test users:
   ```
   username,password,fullName,email,role,companyId
   bulktest1,Pass123,Bulk Test 1,bulk1@test.com,user,
   bulktest2,Pass456,Bulk Test 2,bulk2@test.com,admin,
   ```
- [ ] Save as CSV file
- [ ] Upload CSV file in bulk import dialog
- [ ] Click "Import Users"
- [ ] Verify success message shows "Successfully imported 2 users"
- [ ] Verify 2 new users appear in list (total: 111 users)
- [ ] Delete the 2 test users to clean up

## 3. Audit Log Testing

### View Audit Logs
- [ ] Click "Audit Log" from dashboard
- [ ] Verify audit log page loads
- [ ] Verify recent actions are logged:
  - Login attempts (success/failure)
  - User creation
  - User updates
  - User deletion
  - Password resets
  - Bulk imports

### Export Audit Logs
- [ ] Click "Export CSV" button
- [ ] Verify CSV file downloads
- [ ] Open CSV file - verify data is correct
- [ ] Click "Export JSON" button
- [ ] Verify JSON file downloads
- [ ] Open JSON file - verify data is correct

### Refresh Audit Logs
- [ ] Click "Refresh" button
- [ ] Verify new entries appear (if any recent activity)

## 4. Dashboard Navigation

### Home Page
- [ ] Verify dashboard home page loads
- [ ] Check all navigation cards are visible
- [ ] Click each card to verify navigation works

### Sidebar Navigation
- [ ] Verify sidebar is visible
- [ ] Test all navigation links:
  - [ ] Home
  - [ ] User Management
  - [ ] Audit Log
- [ ] Verify active page is highlighted in sidebar

## 5. Security Testing

### Session Management
- [ ] Login successfully
- [ ] Open browser DevTools → Application → Cookies
- [ ] Verify session cookie is set
- [ ] Close browser completely
- [ ] Reopen browser and navigate to admin.kowope.xyz
- [ ] Verify you're still logged in (session persists)

### Logout
- [ ] Click user profile in header
- [ ] Click "Logout"
- [ ] Verify redirect to login page
- [ ] Try to access /users directly
- [ ] Verify redirect back to login page

### Password Security
- [ ] Create a test user with password: `test123`
- [ ] SSH into production server: `ssh root@172.232.24.180`
- [ ] Check MongoDB: `mongosh arcgis --eval "db.users.findOne({username: 'testuser'})"`
- [ ] Verify password field shows bcrypt hash (starts with `$2b$`)
- [ ] Delete test user

### Role-Based Access
- [ ] Create a regular user (role: `user`)
- [ ] Login as that user
- [ ] Try to access user management
- [ ] Verify admin-only features are restricted (if implemented)
- [ ] Logout and login as admin again

## 6. Performance Testing

### Page Load Times
- [ ] Measure login page load time: _____ seconds
- [ ] Measure dashboard home load time: _____ seconds
- [ ] Measure users page load time (109 users): _____ seconds
- [ ] Measure audit log page load time: _____ seconds
- [ ] Note: 10-15 seconds for API calls is normal due to Manus proxy

### Search Performance
- [ ] Search for a user by name - measure time: _____ seconds
- [ ] Filter by role - measure time: _____ seconds
- [ ] Filter by company - measure time: _____ seconds

## 7. Mobile Responsiveness

### Mobile View
- [ ] Open admin.kowope.xyz on mobile device (or use browser DevTools mobile view)
- [ ] Verify login page is mobile-friendly
- [ ] Verify dashboard is responsive
- [ ] Verify users page is readable on mobile
- [ ] Verify forms are usable on mobile

## 8. Error Handling

### Network Errors
- [ ] Disconnect internet
- [ ] Try to login
- [ ] Verify appropriate error message shows
- [ ] Reconnect internet

### Invalid Credentials
- [ ] Try to login with wrong password
- [ ] Verify error message: "Invalid credentials"
- [ ] Verify login button re-enables

### Duplicate Username
- [ ] Try to create user with existing username
- [ ] Verify error message shows
- [ ] Verify user is not created

## 9. Data Integrity

### User Count Verification
- [ ] SSH into production server
- [ ] Run: `mongosh arcgis --eval "db.users.count()"`
- [ ] Verify count matches dashboard display
- [ ] Expected: 109 users (or more if you've added test users)

### Company Associations
- [ ] Pick a random user with a company assigned
- [ ] Verify company name displays correctly
- [ ] Edit user and change company
- [ ] Verify change persists after refresh

## 10. Browser Compatibility

Test on multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browsers

## Post-Testing Actions

After completing all tests:

- [ ] Delete all test users created during testing
- [ ] Change admin password from `admin123` to a secure production password
- [ ] Document any issues found
- [ ] Create backup of MongoDB database
- [ ] Set up monitoring/alerting for production

## Known Issues

1. **Slow API responses (10-15 seconds)**: This is due to Manus browser proxy latency in the preview environment. Production deployment will be much faster.

2. **MongoDB connection errors in logs**: If you see MongoDB connection errors, verify MONGODB_URI is set correctly in Settings → Secrets.

## Support

If you encounter any issues:
1. Check browser console for errors
2. Check MongoDB connection status
3. Verify MONGODB_URI is correct
4. Review server logs on production server
5. Refer to PRODUCTION_DEPLOYMENT.md for troubleshooting

## Test Results Summary

Date tested: _______________
Tester name: _______________
Total tests passed: _____ / _____
Critical issues found: _____
Minor issues found: _____

Notes:
_________________________________
_________________________________
_________________________________
