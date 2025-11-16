import mongoose, { Schema, Document } from 'mongoose';

/**
 * User Document Interface
 * Matches the original Drizzle schema for authentication
 */
export interface IUser extends Document {
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

/**
 * User Schema
 * For Manus OAuth authentication
 */
const userSchema = new Schema<IUser>({
  openId: { type: String, required: true, unique: true },
  name: { type: String, default: null },
  email: { type: String, default: null },
  loginMethod: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastSignedIn: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create index on openId for faster authentication lookups
userSchema.index({ openId: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
