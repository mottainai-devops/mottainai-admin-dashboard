/**
 * MongoDB Connection Testing Utility
 * 
 * This utility helps test and verify MongoDB connection
 * Run with: node --loader ts-node/esm server/testMongoConnection.ts
 */

import { connectToMongoDB, disconnectFromMongoDB } from './mongodb';
import mongoose from 'mongoose';

async function testConnection() {
  console.log('=== MongoDB Connection Test ===\n');
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arcgis';
  console.log('Testing connection to:', mongoUri.replace(/\/\/.*@/, '//<credentials>@'));
  console.log('');

  try {
    // Test connection
    console.log('Attempting to connect...');
    await connectToMongoDB();
    console.log('✅ Connection successful!\n');

    // Test database operations
    console.log('Testing database operations...');
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database instance is undefined');
    }
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections:`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    console.log('');

    // Count users
    if (collections.some(c => c.name === 'users')) {
      const usersCount = await db.collection('users').countDocuments();
      console.log(`✅ Users collection has ${usersCount} documents\n`);

      if (usersCount > 0) {
        // Get sample user (without password)
        const sampleUser = await db.collection('users').findOne(
          {},
          { projection: { password: 0 } }
        );
        console.log('Sample user document:');
        console.log(JSON.stringify(sampleUser, null, 2));
        console.log('');
      }
    } else {
      console.log('⚠️  Users collection not found\n');
    }

    // Disconnect
    await disconnectFromMongoDB();
    console.log('✅ Disconnected successfully');
    console.log('\n=== Test Complete ===');
    process.exit(0);

  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error(error);
    console.log('\n=== Test Failed ===');
    process.exit(1);
  }
}

testConnection();
