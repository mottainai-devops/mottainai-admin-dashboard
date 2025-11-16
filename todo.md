# Mottainai Admin Dashboard - TODO

## Phase 1: Database Schema & Backend API
- [ ] Create database schema for analytics data
- [ ] Add tables for pickups, customers, payments, companies
- [ ] Create tRPC procedures for analytics queries
- [ ] Add real-time metrics endpoints
- [ ] Implement role-based access control (superadmin/admin)

## Phase 2: Dashboard Layout & Navigation
- [ ] Create DashboardLayout with persistent sidebar
- [ ] Implement role-based navigation (superadmin vs admin)
- [ ] Add header with user profile and logout
- [ ] Create navigation sections: Overview, Customer Management, Operations, Intelligence, Financial

## Phase 3: Analytics & Visualizations
- [ ] Overview dashboard with key metrics cards
- [ ] Revenue analytics charts (PAYT vs Monthly)
- [ ] Customer distribution charts (Residential vs Commercial)
- [ ] Company performance metrics
- [ ] Monthly billing summaries
- [ ] Payment status tracking

## Phase 4: Customer Management
- [ ] Customer list with filters
- [ ] Customer details view
- [ ] Customer type management
- [ ] Address management
- [ ] Customer search functionality

## Phase 5: Operations Management
- [ ] Pickup tracking dashboard
- [ ] Real-time pickup status
- [ ] Company-wise pickup statistics
- [ ] Pickup history and logs

## Phase 6: Financial Analytics
- [ ] Revenue breakdown by company
- [ ] Payment status overview
- [ ] Monthly billing reports
- [ ] Outstanding payments tracking
- [ ] Revenue trends and forecasts

## Phase 7: Integration with Existing System
- [ ] Connect to production MongoDB database
- [ ] Integrate with existing API endpoints
- [ ] Test data synchronization
- [ ] Deploy to production server

## Phase 8: Documentation
- [ ] Admin operations manual
- [ ] User operations manual
- [ ] System architecture documentation
- [ ] API documentation


## Phase 9: Automated Testing Suite (New)
- [x] Create API test suite for company endpoints
- [x] Test ArcGIS integration from backend
- [x] Validate webhook routing logic
- [x] Create health check endpoints
- [x] Add automated test runner script
- [x] Test database operations

## Phase 10: Real-time Monitoring Dashboard (New)
- [x] Build analytics dashboard page
- [x] Show submission counts per company
- [x] Display sync success rates
- [x] Monitor webhook delivery status
- [x] Add real-time error tracking
- [x] Create performance metrics display
- [x] Add system health indicators

## Phase 11: Quality Assurance Tools (New)
- [x] Build submission review interface
- [x] Create data validation dashboard
- [x] Add admin troubleshooting tools
- [x] Implement webhook testing tool
- [x] Create system health monitor
- [x] Add data integrity checks


## URGENT: Fix Missing Pages
- [x] Create Company Management page (/companies route)
- [x] Add company list with CRUD operations
- [x] Remove authentication requirements from all pages
- [x] Test all routes work without login


## Phase 12: Production Deployment
- [x] Create deployment configuration guide
- [x] Document publish process
- [x] Configure custom domain settings
- [x] Set up SSL/HTTPS
- [x] Create backup and rollback procedures

## Phase 13: Email Notification System
- [ ] Add email notification API integration
- [ ] Create alert threshold configuration
- [ ] Implement sync failure notifications (< 95% success rate)
- [ ] Add critical error email alerts
- [ ] Create notification settings page
- [ ] Test email delivery

## Phase 14: Role-Based Access Control
- [ ] Add user roles table to database
- [ ] Create admin/viewer role types
- [ ] Implement role-based route protection
- [ ] Add role check to company CRUD operations
- [ ] Create user management interface
- [ ] Add role assignment UI


## Phase 15: Server Deployment (kowope.xyz)
- [x] Build production files
- [x] Connect to server via SSH (172.232.24.180)
- [x] Check server environment (Node.js, Nginx, PM2)
- [x] Deploy frontend files to /var/www/mottainai-dashboard/public
- [x] Deploy tRPC backend to port 4000 with PM2
- [x] Configure Nginx for upwork.kowope.xyz with SSL
- [x] Set up API proxy (/api/trpc → localhost:4000)
- [x] Test dashboard - ALL 13 COMPANIES LOADING SUCCESSFULLY
- [x] Live URL: https://upwork.kowope.xyz


## Phase 16: Implement HTTP Basic Authentication (Nginx)
- [ ] Configure Nginx HTTP Basic Auth
- [ ] Create htpasswd file with admin credentials
- [ ] Remove React authentication components
- [ ] Rebuild and redeploy
- [ ] Test browser login prompt
- [ ] Verify dashboard access after login


## Phase 17: Dual-Path Routing
- [x] Check what was originally at upwork.kowope.xyz
- [x] Configure /dashboard for admin dashboard (password protected)
- [x] Configure /fieldops for original field operations app
- [x] Update Nginx configuration
- [x] Test both paths
- [x] Deploy to production


## Phase 18: Remove React Authentication Code
- [x] Remove ProtectedRoute component usage from App.tsx
- [x] Remove auth.checkAuth query calls
- [x] Remove Login page import
- [x] Simplify routing to direct access
- [x] Rebuild production files
- [x] Deploy to server
- [x] Test dashboard - HTTP Basic Auth working


## Phase 19: Fix Base Path for Subdirectory Deployment
- [x] Configure Vite base path to '/dashboard/'
- [x] Update Nginx alias configuration
- [x] Rebuild production files
- [x] Deploy to server
- [x] Test /dashboard - HTTP Basic Auth protecting correctly
- [ ] Test /fieldops still works


## Phase 20: Fix Nginx Configuration for Base Path
- [ ] Update Nginx to properly serve React app with /dashboard/ base
- [ ] Fix try_files directive for SPA routing
- [ ] Ensure field ops app still proxies correctly
- [ ] Reload Nginx
- [ ] Test /dashboard loads
- [ ] Test /fieldops loads


## Phase 21: Fix Login Credentials
- [x] Check field ops backend on port 3000 - Running correctly
- [x] Verify original login system is intact - Working
- [x] Test field ops login with existing credentials - Available at /fieldops
- [x] Debug dashboard HTTP Basic Auth - Fixed redirect issue
- [x] Test dashboard access with admin/Mottainai2025! - Working with trailing slash
- [x] Verify both apps working independently


## Phase 22: Fix tRPC API Path for Subdirectory
- [ ] Update tRPC client configuration to use /dashboard/api/trpc
- [ ] Rebuild production files
- [ ] Deploy to server
- [ ] Test dashboard loads and connects to API
- [ ] Test field ops still works
- [ ] Verify all dashboard modules functional


## Phase 23: Convert Dashboard to MongoDB
- [x] Install Mongoose and MongoDB dependencies
- [x] Remove Drizzle ORM and MySQL dependencies
- [x] Create Mongoose schema for companies matching production structure
- [x] Add PIN field to company schema for authentication
- [x] Update db.ts to use MongoDB connection
- [x] Convert all database queries from Drizzle to Mongoose
- [x] Update tRPC procedures to use MongoDB
- [x] Add PIN field to create company form
- [x] Add PIN field to edit company form
- [x] Deploy to production server
- [x] Verify companies load with PINs in dashboard (13 companies with PIN='0000')


## Phase 24: Fix Production Dashboard - Companies Not Displaying
- [x] Check PM2 logs for backend errors - MongoDB connected successfully
- [x] Verify MongoDB connection in production - Working correctly
- [x] Check browser console for frontend errors - Console not capturing output
- [x] Test API endpoint directly on production server - API returning 13 companies correctly
- [x] Fix CORS or authentication issues if present - Updated nginx to allow /api/* without auth
- [x] Verify tRPC client configuration - FOUND BUG: URL was /dashboard/api/trpc instead of /api/trpc
- [x] Test companies page loads correctly - FIXED AND WORKING! All 13 companies displaying


## Phase 25: User Management System Implementation
- [x] Update User model schema with password and role fields
- [x] Add bcrypt for password hashing
- [x] Create authentication middleware (auth router with login/logout/me)
- [x] Build login/logout API endpoints
- [x] Implement session-based authentication (cookie-based)
- [x] Create login page UI (already existed)
- [x] Build user management page (list, create, edit, delete)
- [x] Add useAuth hook for authentication state
- [x] Create initialization script for first superadmin user
- [x] Add role-based route protection to frontend (ProtectedRoute wraps all pages)
- [x] Implement permission checks (superadmin vs admin) in backend (authMiddleware with adminProcedure/superAdminProcedure)
- [ ] Test locally with MongoDB
- [ ] Deploy to production
- [ ] Run init-admin script to create first user
- [ ] Remove nginx HTTP Basic Auth
- [ ] Test authentication flow
- [ ] Create admin user guide
