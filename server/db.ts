import { connectToMongoDB } from './mongodb';
import { Company, ICompany } from './models/Company';
import { User, IUser } from './models/User';
import { ENV } from './_core/env';

/**
 * Initialize database connection
 * Call this at server startup
 */
export async function initializeDatabase() {
  try {
    await connectToMongoDB();
    console.log('[Database] MongoDB initialized successfully');
  } catch (error) {
    console.error('[Database] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Company Management Functions
 */

export async function getAllCompanies(): Promise<ICompany[]> {
  try {
    await connectToMongoDB();
    return await Company.find({ active: true }).sort({ companyName: 1 });
  } catch (error) {
    console.error('[Database] Failed to get companies:', error);
    return [];
  }
}

export async function getCompanyById(id: string): Promise<ICompany | null> {
  try {
    await connectToMongoDB();
    return await Company.findById(id);
  } catch (error) {
    console.error('[Database] Failed to get company by ID:', error);
    return null;
  }
}

export async function getCompanyByPin(pin: string): Promise<ICompany | null> {
  try {
    await connectToMongoDB();
    return await Company.findOne({ pin, active: true });
  } catch (error) {
    console.error('[Database] Failed to get company by PIN:', error);
    return null;
  }
}

export async function getCompanyByCompanyId(companyId: string): Promise<ICompany | null> {
  try {
    await connectToMongoDB();
    return await Company.findOne({ companyId, active: true });
  } catch (error) {
    console.error('[Database] Failed to get company by companyId:', error);
    return null;
  }
}

export async function createCompany(data: {
  companyId: string;
  companyName: string;
  pin: string;
  operationalLots: Array<{
    lotCode: string;
    lotName: string;
    paytWebhook: string;
    monthlyWebhook: string;
  }>;
}): Promise<ICompany> {
  try {
    await connectToMongoDB();
    const company = new Company({
      ...data,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return await company.save();
  } catch (error) {
    console.error('[Database] Failed to create company:', error);
    throw error;
  }
}

export async function updateCompany(
  id: string,
  data: Partial<{
    companyId: string;
    companyName: string;
    pin: string;
    operationalLots: Array<{
      lotCode: string;
      lotName: string;
      paytWebhook: string;
      monthlyWebhook: string;
    }>;
    active: boolean;
  }>
): Promise<ICompany | null> {
  try {
    await connectToMongoDB();
    return await Company.findByIdAndUpdate(
      id,
      { ...data, updatedAt: new Date() },
      { new: true }
    );
  } catch (error) {
    console.error('[Database] Failed to update company:', error);
    throw error;
  }
}

export async function deleteCompany(id: string): Promise<boolean> {
  try {
    await connectToMongoDB();
    // Soft delete - set active to false
    const result = await Company.findByIdAndUpdate(
      id,
      { active: false, updatedAt: new Date() },
      { new: true }
    );
    return result !== null;
  } catch (error) {
    console.error('[Database] Failed to delete company:', error);
    return false;
  }
}

export async function hardDeleteCompany(id: string): Promise<boolean> {
  try {
    await connectToMongoDB();
    const result = await Company.findByIdAndDelete(id);
    return result !== null;
  } catch (error) {
    console.error('[Database] Failed to hard delete company:', error);
    return false;
  }
}

/**
 * User Management Functions
 * For Manus OAuth authentication
 */

export interface InsertUser {
  openId?: string | null; // Optional for password-based users
  username?: string;
  name?: string | null;
  email?: string | null;
  password?: string | null;
  companyId?: string | null; // Assigned company for regular users
  loginMethod?: 'password' | 'oauth' | null;
  role?: 'superadmin' | 'admin' | 'user';
  active?: boolean;
  lastSignedIn?: Date;
}

export async function getUserByOpenId(openId: string): Promise<IUser | null> {
  try {
    await connectToMongoDB();
    return await User.findOne({ openId }).exec();
  } catch (error) {
    console.error('[Database] Failed to get user by openId:', error);
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<IUser | null> {
  try {
    await connectToMongoDB();
    return await User.findOne({ username: username.toLowerCase() }).exec();
  } catch (error) {
    console.error('[Database] Failed to get user by username:', error);
    return null;
  }
}

export async function getUserById(id: string): Promise<IUser | null> {
  try {
    await connectToMongoDB();
    return await User.findById(id).exec();
  } catch (error) {
    console.error('[Database] Failed to get user by ID:', error);
    return null;
  }
}

export async function getAllUsers(): Promise<IUser[]> {
  try {
    await connectToMongoDB();
    return await User.find().select('-password').sort({ createdAt: -1 }).exec();
  } catch (error) {
    console.error('[Database] Failed to get all users:', error);
    return [];
  }
}

export async function createUser(userData: InsertUser): Promise<IUser> {
  if (!userData.username) {
    throw new Error('Username is required');
  }
  if (!userData.password) {
    throw new Error('Password is required');
  }

  try {
    await connectToMongoDB();

    // Check if username already exists
    const existing = await User.findOne({ username: userData.username.toLowerCase() });
    if (existing) {
      throw new Error('Username already exists');
    }

    const user = new User({
      username: userData.username.toLowerCase(),
      password: userData.password, // Will be hashed by pre-save hook
      email: userData.email || null,
      name: userData.name || null,
      role: userData.role || 'admin',
      active: userData.active !== undefined ? userData.active : true,
      loginMethod: 'password',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date()
    });

    await user.save();
    return user;
  } catch (error: any) {
    console.error('[Database] Failed to create user:', error);
    throw error;
  }
}

export async function updateUser(id: string, userData: Partial<InsertUser>): Promise<IUser | null> {
  try {
    await connectToMongoDB();

    const updateData: any = {
      updatedAt: new Date()
    };

    if (userData.name !== undefined) updateData.name = userData.name;
    if (userData.email !== undefined) updateData.email = userData.email;
    if (userData.role !== undefined) updateData.role = userData.role;
    if (userData.active !== undefined) updateData.active = userData.active;

    // If password is being updated, hash it
    if (userData.password) {
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(userData.password, salt);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).select('-password').exec();

    return user;
  } catch (error) {
    console.error('[Database] Failed to update user:', error);
    throw error;
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await connectToMongoDB();
    const result = await User.findByIdAndDelete(id).exec();
    return !!result;
  } catch (error) {
    console.error('[Database] Failed to delete user:', error);
    return false;
  }
}

export async function upsertUser(userData: InsertUser): Promise<void> {
  if (!userData.openId) {
    throw new Error('User openId is required for upsert');
  }

  try {
    await connectToMongoDB();

    const updateData: Partial<IUser> = {
      updatedAt: new Date()
    };

    if (userData.name !== undefined) updateData.name = userData.name;
    if (userData.email !== undefined) updateData.email = userData.email;
    if (userData.loginMethod !== undefined) {
      updateData.loginMethod = userData.loginMethod as 'password' | 'oauth' | null;
    }
    if (userData.lastSignedIn !== undefined) updateData.lastSignedIn = userData.lastSignedIn;
    
    // Set role to admin if this is the owner
    if (userData.role !== undefined) {
      updateData.role = userData.role;
    } else if (userData.openId === ENV.ownerOpenId) {
      updateData.role = 'admin';
    }

    await User.findOneAndUpdate(
      { openId: userData.openId },
      { $set: updateData, $setOnInsert: { openId: userData.openId, createdAt: new Date() } },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('[Database] Failed to upsert user:', error);
    throw error;
  }
}

/**
 * Analytics and Statistics Functions
 * These will be implemented later when we have pickup/customer data
 */

export async function getCompanyCount(): Promise<number> {
  try {
    await connectToMongoDB();
    return await Company.countDocuments({ active: true });
  } catch (error) {
    console.error('[Database] Failed to get company count:', error);
    return 0;
  }
}

export async function getCompanyStatistics() {
  try {
    await connectToMongoDB();
    const totalCompanies = await Company.countDocuments({ active: true });
    const inactiveCompanies = await Company.countDocuments({ active: false });
    
    // Count total operational lots across all companies
    const companies = await Company.find({ active: true });
    const totalLots = companies.reduce((sum, company) => sum + company.operationalLots.length, 0);

    return {
      totalCompanies,
      inactiveCompanies,
      totalLots,
      averageLotsPerCompany: totalCompanies > 0 ? (totalLots / totalCompanies).toFixed(2) : 0
    };
  } catch (error) {
    console.error('[Database] Failed to get company statistics:', error);
    return {
      totalCompanies: 0,
      inactiveCompanies: 0,
      totalLots: 0,
      averageLotsPerCompany: 0
    };
  }
}
