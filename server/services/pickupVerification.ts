/**
 * Pickup Verification Service
 * Identifies formsubmissions that are unsynced (not yet in monthlybilldatas),
 * provides statistics, allows re-sync and deletion.
 */

import { getMongoDb } from '../mongodb';
import { ObjectId } from 'mongodb';

export interface UnsyncedPickup {
  _id: string;
  buildingId?: string;
  arcgisBuildingId?: string;
  companyId?: string;
  companyName?: string;
  customerName?: string;
  address?: string;
  submittedAt?: Date | string;
  isMonthly?: boolean;
  amount?: number;
  syncedToArcGIS?: boolean;
}

export interface SyncStatistics {
  totalFormSubmissions: number;
  totalMonthlybilldatas: number;
  unsynced: number;
  syncPercentage: number;
  lastSyncedAt?: Date | string;
}

/**
 * Get all form submissions that have no corresponding monthlybilldata record.
 */
export async function getUnsyncedPickups(): Promise<UnsyncedPickup[]> {
  const db = await getMongoDb();

  // Get all submission IDs that are already in monthlybilldatas
  const synced = await db
    .collection('monthlybilldatas')
    .distinct('formSubmissionId');

  const syncedSet = new Set(synced.map(String));

  // Find submissions not in that set
  const all = await db
    .collection('formsubmissions')
    .find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  return all
    .filter(doc => !syncedSet.has(String(doc._id)))
    .map(doc => ({
      _id: String(doc._id),
      buildingId: doc.buildingId,
      arcgisBuildingId: doc.arcgisBuildingId,
      companyId: doc.companyId,
      companyName: doc.companyName,
      customerName: doc.customerName,
      address: doc.address,
      submittedAt: doc.createdAt ?? doc.submittedAt,
      isMonthly: doc.isMonthly,
      amount: doc.amount,
      syncedToArcGIS: doc.syncedToArcGIS,
    }));
}

/**
 * Get overall sync statistics.
 */
export async function getSyncStatistics(): Promise<SyncStatistics> {
  const db = await getMongoDb();

  const [totalFormSubmissions, totalMonthlybilldatas, lastSyncDoc] = await Promise.all([
    db.collection('formsubmissions').countDocuments(),
    db.collection('monthlybilldatas').countDocuments(),
    db
      .collection('monthlybilldatas')
      .findOne({}, { sort: { createdAt: -1 }, projection: { createdAt: 1 } }),
  ]);

  const unsynced = Math.max(0, totalFormSubmissions - totalMonthlybilldatas);
  const syncPercentage =
    totalFormSubmissions > 0
      ? Math.round((totalMonthlybilldatas / totalFormSubmissions) * 100)
      : 100;

  return {
    totalFormSubmissions,
    totalMonthlybilldatas,
    unsynced,
    syncPercentage,
    lastSyncedAt: lastSyncDoc?.createdAt,
  };
}

/**
 * Re-sync a specific form submission by creating a monthlybilldata record from it.
 */
export async function resyncPickup(submissionId: string): Promise<{ success: boolean; message: string }> {
  const db = await getMongoDb();

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(submissionId);
  } catch {
    return { success: false, message: `Invalid submission ID: ${submissionId}` };
  }

  const submission = await db.collection('formsubmissions').findOne({ _id: objectId });
  if (!submission) {
    return { success: false, message: `Submission not found: ${submissionId}` };
  }

  // Check if already synced
  const existing = await db
    .collection('monthlybilldatas')
    .findOne({ formSubmissionId: submissionId });
  if (existing) {
    return { success: true, message: 'Already synced — no action needed.' };
  }

  // Create a monthlybilldata record from the submission
  await db.collection('monthlybilldatas').insertOne({
    formSubmissionId: submissionId,
    buildingId: submission.buildingId ?? submission.arcgisBuildingId,
    companyId: submission.companyId,
    companyName: submission.companyName,
    customerName: submission.customerName,
    address: submission.address,
    isMonthly: submission.isMonthly ?? false,
    amount: submission.amount ?? 0,
    createdAt: new Date(),
    syncedAt: new Date(),
    resyncedManually: true,
  });

  return { success: true, message: `Submission ${submissionId} re-synced successfully.` };
}

/**
 * Delete a form submission (for test/erroneous records).
 */
export async function deleteSubmission(submissionId: string): Promise<{ success: boolean; message: string }> {
  const db = await getMongoDb();

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(submissionId);
  } catch {
    return { success: false, message: `Invalid submission ID: ${submissionId}` };
  }

  const result = await db.collection('formsubmissions').deleteOne({ _id: objectId });
  if (result.deletedCount === 0) {
    return { success: false, message: `Submission not found: ${submissionId}` };
  }

  return { success: true, message: `Submission ${submissionId} deleted.` };
}
