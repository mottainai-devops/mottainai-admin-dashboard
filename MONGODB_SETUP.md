# MongoDB Connection Setup Guide

This guide explains how to connect your Mottainai Admin Dashboard to a production MongoDB database to restore existing users and enable persistent storage.

## Current Status

The dashboard currently uses:
- **Simple Auth System**: In-memory user storage (users lost on server restart)
- **MongoDB URI**: Points to `172.232.24.180:27017` (currently timing out)

## Connecting to Production MongoDB

### Step 1: Obtain Your MongoDB Connection String

Your MongoDB connection string should look like one of these formats:

```
# MongoDB Atlas (cloud)
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Self-hosted MongoDB
mongodb://username:password@host:port/database

# Local MongoDB (development only)
mongodb://localhost:27017/database
```

### Step 2: Update MONGODB_URI in Dashboard Settings

1. Open the Mottainai Admin Dashboard
2. Click the **Settings** icon in the top-right corner
3. Navigate to **Settings → Secrets**
4. Find the `MONGODB_URI` variable
5. Click **Edit** and paste your connection string
6. Click **Save**

### Step 3: Restart the Application

The dashboard will automatically reconnect to MongoDB on the next request. To force an immediate reconnection:

1. Go to the Management Dashboard
2. Click **Restart Server** button

Or wait for the next deployment/restart.

### Step 4: Verify Connection

#### Option A: Check Server Logs

Look for this message in the server logs:
```
[MongoDB] Connected successfully to: mongodb://<credentials>@...
```

If you see connection errors, verify your connection string is correct.

#### Option B: Run Connection Test Script

```bash
cd /home/ubuntu/mottainai-admin-dashboard
MONGODB_URI="your-connection-string" node --loader ts-node/esm server/testMongoConnection.ts
```

This will test the connection and show:
- ✅ Connection status
- List of collections in the database
- Number of users in the users collection
- Sample user document (without password)

### Step 5: Verify Users Are Loaded

1. Log in to the dashboard
2. Navigate to **User Management**
3. You should now see all users from your MongoDB database

## Switching Between Simple Auth and MongoDB

The dashboard automatically uses MongoDB when `MONGODB_URI` is configured. If MongoDB is unavailable, it falls back to the simple auth system.

### When to Use Simple Auth
- Development and testing
- Quick prototyping
- When MongoDB is not available

### When to Use MongoDB
- Production deployments
- When you need persistent user storage
- When you have existing users to restore
- Multi-instance deployments

## Troubleshooting

### Connection Timeout

**Symptom**: `MongooseServerSelectionError: connection <monitor> to X.X.X.X:27017 closed`

**Solutions**:
1. Verify the MongoDB server is running
2. Check firewall rules allow connections from the dashboard server
3. Verify the IP address and port are correct
4. Check if authentication credentials are valid

### Authentication Failed

**Symptom**: `MongoServerError: Authentication failed`

**Solutions**:
1. Verify username and password are correct
2. Check the user has permissions for the specified database
3. Ensure special characters in password are URL-encoded

### Database Not Found

**Symptom**: Connection succeeds but no users appear

**Solutions**:
1. Verify the database name in the connection string is correct
2. Check the `users` collection exists in the database
3. Run the test script to see what collections are available

## MongoDB User Schema

The dashboard expects users to have this structure:

```typescript
{
  _id: ObjectId,
  openId: string,           // Unique identifier
  username: string,         // Login username
  password: string,         // Bcrypt hashed password
  name: string | null,      // Full name
  email: string | null,     // Email address
  role: "admin" | "user",   // User role
  active: boolean,          // Account status
  companyId: string | null, // Associated company
  createdAt: Date,
  lastSignedIn: Date
}
```

## Security Best Practices

1. **Never commit MongoDB credentials** to version control
2. **Use strong passwords** for MongoDB users
3. **Enable SSL/TLS** for MongoDB connections in production
4. **Restrict network access** to MongoDB server (IP whitelist)
5. **Regularly backup** your MongoDB database
6. **Monitor connection logs** for suspicious activity

## Support

If you encounter issues connecting to MongoDB:

1. Check the server logs for detailed error messages
2. Run the connection test script
3. Verify your MongoDB server is accessible
4. Contact your database administrator for connection details
