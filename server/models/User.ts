import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Document Interface
 * Supports both OAuth (openId) and password-based authentication
 */
export interface IUser extends Document {
  _id: string;
  username: string; // For password-based login
  email: string | null;
  password: string | null; // Hashed password for local auth
  name: string | null;
  role: 'superadmin' | 'admin' | 'user';
  active: boolean; // Can be disabled without deletion
  companyId: string | null; // Assigned company for regular users
  openId: string | null; // For OAuth compatibility (optional)
  loginMethod: 'password' | 'oauth' | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * User Schema
 * Supports password-based authentication with role-based access control
 */
const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, default: null, lowercase: true, trim: true },
  password: { type: String, default: null }, // Hashed with bcrypt
  name: { type: String, default: null },
  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'user'], 
    default: 'admin', 
    required: true 
  },
  active: { type: Boolean, default: true },
  companyId: { type: String, default: null }, // Reference to Company _id
  openId: { type: String, default: null, sparse: true }, // OAuth compatibility
  loginMethod: { type: String, enum: ['password', 'oauth'], default: 'password' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastSignedIn: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create indexes for faster lookups
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ openId: 1 }, { sparse: true }); // Sparse index for optional OAuth

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password for authentication
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
