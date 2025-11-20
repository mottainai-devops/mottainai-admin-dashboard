# Mottainai Admin Dashboard

Backend API for the Mottainai waste management system with role-based lot filtering, MongoDB integration, and mobile app authentication.

## 🚀 Features

- **Role-Based Lot Filtering**: Users see only their assigned company's lots; admins and cherry pickers see all lots
- **MongoDB Integration**: User management with role-based access control
- **Mobile Auth API**: REST endpoints for mobile app authentication with JWT tokens
- **tRPC API**: Type-safe API endpoints for web dashboard
- **Lot Management**: Dynamic operational lot configuration with webhook support

## 📋 Prerequisites

- Node.js 18+ and pnpm
- MongoDB database
- Production server with PM2 (for deployment)

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/mottainaisurvey/mottainai-admin-dashboard.git
cd mottainai-admin-dashboard

# Install dependencies
pnpm install

# Set up environment variables (see Configuration section)
cp .env.example .env

# Build the project
pnpm build

# Start development server
pnpm dev
```

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
# MongoDB
MONGODB_URI=mongodb://username:password@host:port/database

# JWT Authentication
JWT_SECRET=your-secret-key-here

# Server
PORT=3000
NODE_ENV=production

# Manus OAuth (if using)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im
VITE_APP_ID=your-app-id
```

## 🏗️ Project Structure

```
server/
  ├── routers/
  │   ├── lots.ts           # Lot filtering with role-based access
  │   ├── mobileAuth.ts     # Mobile app authentication
  │   └── simpleAuthRouter.ts
  ├── mongodb.ts            # MongoDB connection and queries
  ├── db.ts                 # Database helpers
  └── _core/                # Framework core (OAuth, tRPC, etc.)

drizzle/
  └── schema.ts             # Database schema definitions

client/
  └── src/                  # Web dashboard frontend (React)
```

## 🔐 Authentication & Authorization

### User Roles

- **admin**: Full access to all lots and companies
- **cherry_picker**: Access to all lots across companies
- **user**: Access only to their assigned company's lots

### Mobile App Authentication

Mobile apps authenticate via `/api/mobile/users/login`:

```bash
POST /api/mobile/users/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "base64-encoded-password"
}
```

Response includes JWT token and user details with role and company assignment.

### Web Dashboard Authentication

Uses Manus OAuth for SSO authentication.

## 📡 API Endpoints

### Mobile API

- `POST /api/mobile/users/login` - Authenticate mobile user
- `GET /api/mobile/users/me` - Get current user (requires JWT)

### tRPC API

- `lots.list` - Get lots filtered by user role and company
- `auth.me` - Get current authenticated user
- `auth.logout` - Logout current user

## 🚀 Deployment

### Production Deployment

```bash
# Build the project
pnpm build

# Deploy to production server
scp -r dist/ server/ package.json root@your-server:/path/to/app/

# On production server
cd /path/to/app
pnpm install --prod
pm2 start dist/index.js --name mottainai-dashboard
pm2 save
```

### Environment Setup

Ensure all environment variables are set on the production server:

```bash
export MONGODB_URI="mongodb://..."
export JWT_SECRET="..."
pm2 restart mottainai-dashboard
```

## 🗄️ Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  email: String,
  password: String (bcrypt hashed),
  name: String,
  role: "admin" | "cherry_picker" | "user",
  companyId: ObjectId (reference to companies),
  createdAt: Date,
  updatedAt: Date
}
```

### Companies Collection

```javascript
{
  _id: ObjectId,
  company_id: String,
  company_name: String,
  is_active: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### Lots Collection

```javascript
{
  _id: ObjectId,
  lotCode: String,
  lotName: String,
  companyId: String,
  companyName: String,
  paytWebhook: String,
  monthlyWebhook: String,
  isActive: Boolean
}
```

## 🧪 Testing

```bash
# Run tests
pnpm test

# Test API endpoints
curl http://localhost:3000/api/trpc/lots.list?input=%7B%220%22%3A%7B%22json%22%3A%7B%22userId%22%3A%22USER_ID%22%7D%7D%7D
```

## 📝 Development

### Adding New Lot

Update `activeLots.json` or use the admin dashboard to add lots dynamically.

### Adding New User Role

1. Update `drizzle/schema.ts` to add new role enum value
2. Update `server/routers/lots.ts` to handle new role logic
3. Run `pnpm db:push` to update database schema

## 🐛 Troubleshooting

### "No lots available" error

- Check user's `companyId` is set correctly in database
- Verify lots have matching `companyId` field
- Check user role is set (defaults to "user")

### Authentication fails

- Verify JWT_SECRET is set and matches across environments
- Check MongoDB connection string is correct
- Ensure password is base64-encoded for mobile API

## 📄 License

Proprietary - Mottainai Project

## 🤝 Contributing

Contact the project maintainers for contribution guidelines.

## 📞 Support

For issues or questions, contact the development team.

---

**Current Version**: 2.9.5  
**Last Updated**: November 2025  
**Production URL**: https://admin.kowope.xyz
