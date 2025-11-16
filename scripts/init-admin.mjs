/**
 * Initialize first superadmin user
 * Run this script once after deployment to create the initial admin account
 * 
 * Usage: node scripts/init-admin.mjs
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arcgis';

// User Schema (simplified version)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: String,
  name: String,
  role: { type: String, enum: ['superadmin', 'admin', 'user'], default: 'admin' },
  active: { type: Boolean, default: true },
  loginMethod: { type: String, enum: ['password', 'oauth'], default: 'password' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastSignedIn: { type: Date, default: Date.now },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

async function initAdmin() {
  try {
    console.log('[Init] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Init] Connected to MongoDB');

    // Check if any users exist
    const userCount = await User.countDocuments();
    
    if (userCount > 0) {
      console.log(`[Init] Database already has ${userCount} user(s). Skipping initialization.`);
      console.log('[Init] To reset, delete all users from the database first.');
      process.exit(0);
    }

    // Create default superadmin
    const defaultUsername = 'admin';
    const defaultPassword = 'Mottainai2025!';
    const defaultEmail = 'admin@mottainai.local';

    console.log('[Init] Creating superadmin user...');
    
    const admin = new User({
      username: defaultUsername,
      password: defaultPassword,
      email: defaultEmail,
      name: 'System Administrator',
      role: 'superadmin',
      active: true,
      loginMethod: 'password',
    });

    await admin.save();

    console.log('');
    console.log('✅ Superadmin user created successfully!');
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  Login Credentials');
    console.log('═══════════════════════════════════════');
    console.log(`  Username: ${defaultUsername}`);
    console.log(`  Password: ${defaultPassword}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password immediately after first login!');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('[Init] Error:', error);
    process.exit(1);
  }
}

initAdmin();
