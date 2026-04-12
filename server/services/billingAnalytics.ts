import { getMongoDb } from '../mongodb';

/**
 * Get overall billing statistics from formsubmissions.
 * Uses the 'formsubmissions' collection (the actual data source).
 * isMonthly field: true = Monthly subscription, false/absent = PAYT.
 */
export async function getOverallStats(startDate?: Date, endDate?: Date) {
  const db = await getMongoDb();
  const collection = db.collection('formsubmissions');
  const match: Record<string, unknown> = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) (match.createdAt as Record<string, unknown>).$gte = startDate;
    if (endDate) (match.createdAt as Record<string, unknown>).$lte = endDate;
  }
  const pipeline = [
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' },
        totalTransactions: { $sum: 1 },
        paytRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', false] }, '$amount', 0] },
        },
        monthlyRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', true] }, '$amount', 0] },
        },
      },
    },
  ];
  const result = await collection.aggregate(pipeline).toArray();
  return result[0] ?? {
    totalRevenue: 0,
    totalTransactions: 0,
    paytRevenue: 0,
    monthlyRevenue: 0,
  };
}

/**
 * Get company-wise revenue breakdown.
 *
 * FIX (Apr 12 2026): Previous version queried 'monthlybilldatas' and did a $lookup
 * on a 'customers' collection that doesn't exist, causing empty results.
 * Also missing paytRevenue, monthlyRevenue, and transactionCount fields.
 *
 * Now queries 'formsubmissions' directly, groups by companyId/companyName,
 * and computes all fields the frontend expects:
 *   companyId, companyName, totalRevenue, paytRevenue, monthlyRevenue, transactionCount
 */
export async function getCompanyBreakdown() {
  const db = await getMongoDb();
  const collection = db.collection('formsubmissions');
  const pipeline = [
    // Only include records that have a company association
    { $match: { $or: [{ companyId: { $exists: true, $ne: null } }, { companyName: { $exists: true, $ne: null } }] } },
    {
      $group: {
        _id: { $ifNull: ['$companyId', '$companyName'] },
        companyId: { $first: { $ifNull: ['$companyId', '$companyName'] } },
        companyName: { $first: { $ifNull: ['$companyName', '$companyId'] } },
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        paytRevenue: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ['$isMonthly', false] }, { $not: ['$isMonthly'] }] },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        monthlyRevenue: {
          $sum: {
            $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0],
          },
        },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 50 },
    {
      $project: {
        _id: 0,
        companyId: 1,
        companyName: 1,
        totalRevenue: 1,
        paytRevenue: 1,
        monthlyRevenue: 1,
        transactionCount: 1,
      },
    },
  ];
  return await collection.aggregate(pipeline).toArray();
}

/**
 * Get lot-wise revenue breakdown.
 *
 * FIX (Apr 12 2026): Previous version queried 'monthlybilldatas' and returned
 * _id (= buildingId) instead of lotId, causing blank Lot ID column.
 * Also missing paytRevenue, monthlyRevenue, transactionCount fields (causing NaN).
 *
 * Now queries 'formsubmissions', extracts the lot number from the buildingId
 * (format: "NNNNN XXXXXNN NNN" where the last token is the lot number),
 * and computes all fields the frontend expects:
 *   lotId, totalRevenue, paytRevenue, monthlyRevenue, transactionCount
 */
export async function getLotBreakdown() {
  const db = await getMongoDb();
  const collection = db.collection('formsubmissions');
  const pipeline = [
    { $match: { buildingId: { $exists: true, $ne: null } } },
    {
      $addFields: {
        // Extract lot number: buildingId format is "67013 OYSISW12 220" — last space-separated token
        lotId: {
          $let: {
            vars: {
              parts: { $split: ['$buildingId', ' '] },
            },
            in: {
              $arrayElemAt: [
                '$$parts',
                { $subtract: [{ $size: '$$parts' }, 1] },
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: '$lotId',
        lotId: { $first: '$lotId' },
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        paytRevenue: {
          $sum: {
            $cond: [
              { $or: [{ $eq: ['$isMonthly', false] }, { $not: ['$isMonthly'] }] },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        monthlyRevenue: {
          $sum: {
            $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0],
          },
        },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 50 },
    {
      $project: {
        _id: 0,
        lotId: 1,
        totalRevenue: 1,
        paytRevenue: 1,
        monthlyRevenue: 1,
        transactionCount: 1,
      },
    },
  ];
  return await collection.aggregate(pipeline).toArray();
}

/**
 * Get monthly revenue trends.
 * Queries 'formsubmissions' directly.
 */
export async function getMonthlyTrends() {
  const db = await getMongoDb();
  const collection = db.collection('formsubmissions');
  const pipeline = [
    {
      $group: {
        _id: {
          year: { $year: { $toDate: '$createdAt' } },
          month: { $month: { $toDate: '$createdAt' } },
        },
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        recordCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
    { $limit: 24 },
  ];
  return await collection.aggregate(pipeline).toArray();
}

export function generateBillingCSV(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row)
      .map(v => (typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v))
      .join(',')
  );
  return [headers, ...rows].join('\n');
}
