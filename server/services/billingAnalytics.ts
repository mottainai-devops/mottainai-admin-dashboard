import { getMongoDb } from '../mongodb';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Ward code → primary company name mapping, loaded from active_lots.json.
 * buildingId format: "NNNNN WARDCODE LOTNNN"
 * The middle token is the ward code (e.g. OYSISW12, LASIKA06).
 */
function getWardCompanyMap(): Record<string, string> {
  try {
    const lotsPath = path.join(process.cwd(), 'shared', 'active_lots.json');
    const raw = fs.readFileSync(lotsPath, 'utf8');
    const lots: Array<{ ward_code?: string; Business_Name?: string }> = JSON.parse(raw);
    const map: Record<string, string> = {};
    for (const lot of lots) {
      if (lot.ward_code && lot.Business_Name && !map[lot.ward_code]) {
        map[lot.ward_code] = lot.Business_Name;
      }
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Get overall billing statistics.
 *
 * FIX (Apr 12 2026 — rev 2): The previous fix incorrectly switched to
 * 'formsubmissions' (22,327 records, ₦57,163,000).  The authoritative
 * billing source is 'monthlybilldatas' (48,862 records, ₦244,510,000).
 * This function now queries 'monthlybilldatas' directly.
 *
 * isMonthly field: true = Monthly subscription, false = PAYT.
 */
export async function getOverallStats(startDate?: Date, endDate?: Date) {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');
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
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        totalTransactions: { $sum: 1 },
        paytRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', false] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        monthlyRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0] },
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
 * FIX (Apr 12 2026 — rev 2): Queries 'monthlybilldatas'.
 * Company identity is derived from the ward code (middle token of buildingId,
 * e.g. "30157 OYSISW12 076" → "OYSISW12"), then mapped to a human-readable
 * company name via active_lots.json.
 */
export async function getCompanyBreakdown() {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');
  const wardMap = getWardCompanyMap();

  const pipeline = [
    { $match: { buildingId: { $exists: true, $ne: null } } },
    {
      $addFields: {
        wardCode: { $arrayElemAt: [{ $split: ['$buildingId', ' '] }, 1] },
      },
    },
    {
      $group: {
        _id: '$wardCode',
        companyId: { $first: '$wardCode' },
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        paytRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$isMonthly', false] },
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
        totalRevenue: 1,
        paytRevenue: 1,
        monthlyRevenue: 1,
        transactionCount: 1,
      },
    },
  ];

  const rows = await collection.aggregate(pipeline).toArray();
  // Attach human-readable company name from ward map
  return rows.map(row => ({
    ...row,
    companyName: (row.companyId && wardMap[row.companyId as string]) || row.companyId || 'Unknown',
  }));
}

/**
 * Get lot-wise revenue breakdown.
 *
 * FIX (Apr 12 2026 — rev 2): Queries 'monthlybilldatas'.
 * Lot number is the last token of buildingId
 * (e.g. "30157 OYSISW12 076" → lot "076").
 */
export async function getLotBreakdown() {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');
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
              { $eq: ['$isMonthly', false] },
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
 * Queries 'monthlybilldatas' directly.
 */
export async function getMonthlyTrends() {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');
  const pipeline = [
    {
      $group: {
        _id: {
          year: { $year: { $toDate: '$createdAt' } },
          month: { $month: { $toDate: '$createdAt' } },
        },
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        paytRevenue: {
          $sum: {
            $cond: [{ $eq: ['$isMonthly', false] }, { $ifNull: ['$amount', 0] }, 0],
          },
        },
        monthlyRevenue: {
          $sum: {
            $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0],
          },
        },
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
