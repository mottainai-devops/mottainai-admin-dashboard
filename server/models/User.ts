import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Document Interface
 * Supports both OAuth (openId) and password-based authentication
 */
export interface IUser extends Document {
  _id: string;
  fullName: string; // Full name (matches production schema)
  username?: string; // Optional username for login
  email: string | null;
  phone?: string; // Phone number
  password: string | null; // Hashed password (bcrypt)
  role: 'admin' | 'user' | 'cherry_picker';
  companyId?: string | null; // Assigned company for regular users
  monthlyBilling?: boolean; // Monthly billing flag
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * User Schema
 * Supports password-based authentication with role-based access control
 */
const userSchema = new Schema<IUser>({
  fullName: { type: String, required: true, trim: true },
  username: { type: String, sparse: true, lowercase: true, trim: true }, // Optional
  email: { type: String, default: null, lowercase: true, trim: true },
  phone: { type: String, default: null, trim: true },
  password: { type: String, default: null }, // Hashed with bcrypt
  role: { 
    type: String, 
    enum: ['admin', 'user', 'cherry_picker'], 
    default: 'user', 
    required: true 
  },
  companyId: { type: String, default: null },
  monthlyBilling: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create indexes for faster lookups
userSchema.index({ username: 1 }, { sparse: true });
userSchema.index({ email: 1 });

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
