/**
 * migrate-user-company.mjs
 * One-time data migration — Tasks 5 & 6 from GitHub Normalisation Report (April 10, 2026)
 *
 * Task 5: Set company = 'admin' for all admin users where company is null/missing
 * Task 6: Fix users whose companyId is a MongoDB ObjectId hex string instead of a company code string
 *
 * Run on the production server:
 *   cd /var/www/mottainai-dashboard
 *   MONGODB_URI=mongodb://localhost:27017/arcgis node scripts/migrate-user-company.mjs
 *
 * Add DRY_RUN=true to preview without writing:
 *   DRY_RUN=true MONGODB_URI=mongodb://localhost:27017/arcgis node scripts/migrate-user-company.mjs
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/arcgis';
const DRY_RUN = process.env.DRY_RUN === 'true';

const client = new MongoClient(MONGODB_URI);

async function run() {
  await client.connect();
  const db = client.db();
  const users = db.collection('users');
  const companies = db.collection('companies');

  console.log(`\n=== Mottainai User-Company Migration ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (writing to DB)'}`);
  console.log(`Database: ${MONGODB_URI}\n`);

  // ── Task 5: Set company = 'admin' for admin users with null/missing company ──
  const adminNullCompany = await users.find({
    role: 'admin',
    $or: [{ company: null }, { company: { $exists: false } }],
  }).toArray();

  console.log(`Task 5: Found ${adminNullCompany.length} admin users with null/missing company`);

  if (!DRY_RUN && adminNullCompany.length > 0) {
    const result = await users.updateMany(
      { role: 'admin', $or: [{ company: null }, { company: { $exists: false } }] },
      { $set: { company: 'admin' } }
    );
    console.log(`  → Updated ${result.modifiedCount} records`);
  } else if (DRY_RUN && adminNullCompany.length > 0) {
    console.log(`  → Would update ${adminNullCompany.length} records (dry run)`);
    adminNullCompany.slice(0, 5).forEach(u => console.log(`    - ${u.email || u.username} (id: ${u._id})`));
    if (adminNullCompany.length > 5) console.log(`    ... and ${adminNullCompany.length - 5} more`);
  }

  // ── Task 6: Fix users whose companyId is a MongoDB ObjectId hex string ──
  const objectIdPattern = /^[0-9a-f]{24}$/i;
  const allUsers = await users.find({}).toArray();
  const badCompanyId = allUsers.filter(u => u.companyId && objectIdPattern.test(u.companyId));

  console.log(`\nTask 6: Found ${badCompanyId.length} users with ObjectId-format companyId`);

  let task6Updated = 0;
  let task6Failed = 0;

  for (const user of badCompanyId) {
    try {
      // Look up the company by its _id
      const company = await companies.findOne({ _id: new ObjectId(user.companyId) });
      if (!company) {
        console.log(`  ✗ No company found for ObjectId ${user.companyId} (user: ${user.email || user.username})`);
        task6Failed++;
        continue;
      }

      const correctCode = company.companyCode || company.code || company.name;
      if (!correctCode) {
        console.log(`  ✗ Company ${user.companyId} has no code/name field (user: ${user.email || user.username})`);
        task6Failed++;
        continue;
      }

      if (!DRY_RUN) {
        await users.updateOne(
          { _id: user._id },
          { $set: { companyId: correctCode } }
        );
      }

      console.log(`  ${DRY_RUN ? '→ Would fix' : '✓ Fixed'} ${user.email || user.username}: ObjectId ${user.companyId} → "${correctCode}"`);
      task6Updated++;
    } catch (err) {
      console.log(`  ✗ Error processing user ${user._id}: ${err.message}`);
      task6Failed++;
    }
  }

  console.log(`\nTask 6 summary: ${task6Updated} ${DRY_RUN ? 'would be updated' : 'updated'}, ${task6Failed} failed`);

  console.log('\n=== Migration complete ===\n');
  await client.close();
}

run().catch(err => {
  console.error('Migration failed:', err);
  client.close();
  process.exit(1);
});
