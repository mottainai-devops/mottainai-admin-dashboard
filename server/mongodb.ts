import mongoose from 'mongoose';

let isConnected = false;

/**
 * Connect to MongoDB database
 * Uses connection string from environment variable
 */
export async function connectToMongoDB(): Promise<void> {
  if (isConnected) {
    console.log('[MongoDB] Already connected');
    return;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arcgis';

  try {
    await mongoose.connect(mongoUri);
    isConnected = true;
    console.log('[MongoDB] Connected successfully to:', mongoUri.replace(/\/\/.*@/, '//<credentials>@'));
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error);
    throw error;
  }
}

/**
 * Get MongoDB connection instance
 * Ensures connection is established before returning
 */
export async function getMongoConnection() {
  if (!isConnected) {
    await connectToMongoDB();
  }
  return mongoose.connection;
}

/**
 * Disconnect from MongoDB
 * Used for cleanup in tests or shutdown
 */
export async function disconnectFromMongoDB(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error('[MongoDB] Disconnect failed:', error);
    throw error;
  }
}

/**
 * Get user by email from MongoDB
 * Used for authentication
 */
export async function getUserByEmail(email: string) {
  try {
    const db = await getMongoConnection();
    const user = await db.collection('users').findOne({ email });
    return user;
  } catch (error) {
    console.error('[MongoDB] Error getting user by email:', error);
    return null;
  }
}

/**
 * Get user by ID from MongoDB
 * Used for token verification
 */
export async function getUserById(userId: string) {
  try {
    const db = await getMongoConnection();
    const ObjectId = mongoose.Types.ObjectId;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    return user;
  } catch (error) {
    console.error('[MongoDB] Error getting user by ID:', error);
    return null;
  }
}
