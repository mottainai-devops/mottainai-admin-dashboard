import { getMongoDb } from '../mongodb';

/**
 * Revenue quality tier logic for monthlybilldatas:
 *
 * CONFIRMED PAID  — status = "true" OR true (string/boolean inconsistency in schema)
 *                   AND transcationId is a real Paystack ID (not "000", not null/empty)
 *
 * INVOICED        — transcationId is a real Paystack ID (not "000")
 *                   AND status = "false" OR false (not yet marked paid)
 *
 * PENDING         — transcationId = "000" (placeholder — not yet invoiced through Paystack)
 *
 * NOTE: status is stored as both string "true"/"false" and boolean true/false
 * due to a schema inconsistency in the MonthlyBillData model. Both variants
 * must be matched in all queries.
 */

/** Returns true if a transcationId value is a real Paystack ID (not placeholder) */
const REAL_TXN_CONDITION = {
  $and: [
    { transcationId: { $exists: true } },
    { transcationId: { $ne: null } },
    { transcationId: { $ne: '' } },
    { transcationId: { $ne: '000' } },
  ],
};

/** Matches records where status is confirmed paid (string "true" OR boolean true) */
const STATUS_PAID_CONDITION = {
  $or: [{ status: 'true' }, { status: true }],
};

/** Matches records where status is unpaid (string "false" OR boolean false) */
const STATUS_UNPAID_CONDITION = {
  $or: [{ status: 'false' }, { status: false }],
};

/**
 * Get overall billing statistics with revenue quality tiers.
 *
 * Three tiers:
 *   confirmedRevenue  — paid + real Paystack transaction ID
 *   invoicedRevenue   — real Paystack ID but not yet marked paid
 *   pendingRevenue    — placeholder "000" ID, not yet invoiced
 *   totalRevenue      — sum of all three tiers
 */
export async function getOverallStats(startDate?: Date, endDate?: Date) {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');

  const dateMatch: Record<string, unknown> = {};
  if (startDate || endDate) {
    dateMatch.createdAt = {};
    if (startDate) (dateMatch.createdAt as Record<string, unknown>).$gte = startDate;
    if (endDate) (dateMatch.createdAt as Record<string, unknown>).$lte = endDate;
  }

  const pipeline = [
    ...(Object.keys(dateMatch).length > 0 ? [{ $match: dateMatch }] : []),
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        totalTransactions: { $sum: 1 },

        // PAYT vs Monthly breakdown
        paytRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', false] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        monthlyRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0] },
        },

        // Revenue quality tiers
        // Tier 1: Confirmed paid — status=true AND real Paystack ID
        confirmedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'true'] }, { $eq: ['$status', true] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        confirmedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'true'] }, { $eq: ['$status', true] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              1,
              0,
            ],
          },
        },

        // Tier 2: Invoiced — real Paystack ID but status still false
        invoicedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'false'] }, { $eq: ['$status', false] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        invoicedCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'false'] }, { $eq: ['$status', false] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              1,
              0,
            ],
          },
        },

        // Tier 3: Pending — placeholder "000" ID, not yet invoiced
        pendingRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$transcationId', '000'] },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        pendingCount: {
          $sum: {
            $cond: [{ $eq: ['$transcationId', '000'] }, 1, 0],
          },
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
    confirmedRevenue: 0,
    confirmedCount: 0,
    invoicedRevenue: 0,
    invoicedCount: 0,
    pendingRevenue: 0,
    pendingCount: 0,
  };
}

/**
 * Get company-wise revenue breakdown using splitCode as the authoritative
 * company identifier.
 *
 * Strategy:
 * 1. Group monthlybilldatas by splitCode
 * 2. Join each splitCode to a company via the companies collection
 * 3. Fall back to lot-number matching for records with no SPL_ code
 *    (Urban Spirit lot 006, Sarobol lot 242, legacy PAYT-* records)
 *
 * Each company row includes revenue quality tiers:
 *   confirmedRevenue, invoicedRevenue, pendingRevenue
 */
export async function getCompanyBreakdown() {
  const db = await getMongoDb();

  // Load company → splitCodes mapping from companies collection
  const companiesCol = db.collection('companies');
  const companiesList = await companiesCol
    .find(
      { splitCodes: { $exists: true, $ne: [] } },
      { projection: { companyName: 1, splitCodes: 1, lotCodes: 1 } }
    )
    .toArray();

  // Build splitCode → companyName lookup
  const splitCodeToCompany: Record<string, string> = {};
  const lotCodeToCompany: Record<string, string> = {};

  for (const company of companiesList) {
    const name = company.companyName as string;
    for (const code of (company.splitCodes as string[]) || []) {
      splitCodeToCompany[code] = name;
    }
    for (const lot of (company.lotCodes as string[]) || []) {
      lotCodeToCompany[lot] = name;
    }
  }

  // Also add companies with no splitCodes but with lotCodes (Urban Spirit, Sarobol)
  const allCompanies = await companiesCol
    .find(
      { companyName: { $exists: true }, lotCodes: { $exists: true, $ne: [] } },
      { projection: { companyName: 1, lotCodes: 1 } }
    )
    .toArray();
  for (const company of allCompanies) {
    const name = company.companyName as string;
    for (const lot of (company.lotCodes as string[]) || []) {
      if (!lotCodeToCompany[lot]) lotCodeToCompany[lot] = name;
    }
  }

  // Aggregate monthlybilldatas by splitCode with revenue tiers
  const collection = db.collection('monthlybilldatas');
  const pipeline = [
    { $match: { buildingId: { $exists: true, $ne: null } } },
    {
      $addFields: {
        lotNum: {
          $arrayElemAt: [
            { $split: ['$buildingId', ' '] },
            { $subtract: [{ $size: { $split: ['$buildingId', ' '] } }, 1] },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$splitCode',
        splitCode: { $first: '$splitCode' },
        // Sample a lotNum to use for fallback company lookup
        sampleLotNum: { $first: '$lotNum' },
        totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
        paytRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', false] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        monthlyRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        transactionCount: { $sum: 1 },
        // Revenue quality tiers
        confirmedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'true'] }, { $eq: ['$status', true] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        invoicedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'false'] }, { $eq: ['$status', false] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        pendingRevenue: {
          $sum: {
            $cond: [{ $eq: ['$transcationId', '000'] }, { $ifNull: ['$amount', 0] }, 0],
          },
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ];

  const rows = await collection.aggregate(pipeline).toArray();

  // Map splitCode → company name, merge rows for same company
  const companyMap: Record<string, {
    companyId: string;
    companyName: string;
    totalRevenue: number;
    paytRevenue: number;
    monthlyRevenue: number;
    transactionCount: number;
    confirmedRevenue: number;
    invoicedRevenue: number;
    pendingRevenue: number;
  }> = {};

  for (const row of rows) {
    const splitCode = row.splitCode as string | null;
    const lotNum = row.sampleLotNum as string | null;

    // Resolve company name: splitCode first, then lot number fallback
    let companyName = 'Unknown';
    if (splitCode && splitCodeToCompany[splitCode]) {
      companyName = splitCodeToCompany[splitCode];
    } else if (lotNum && lotCodeToCompany[lotNum]) {
      companyName = lotCodeToCompany[lotNum];
    } else if (splitCode === 'PAYT-RESIDENTIAL' || splitCode === 'PAYT-COMMERCIAL') {
      companyName = 'Unattributed (Legacy)';
    }

    if (!companyMap[companyName]) {
      companyMap[companyName] = {
        companyId: companyName,
        companyName,
        totalRevenue: 0,
        paytRevenue: 0,
        monthlyRevenue: 0,
        transactionCount: 0,
        confirmedRevenue: 0,
        invoicedRevenue: 0,
        pendingRevenue: 0,
      };
    }

    companyMap[companyName].totalRevenue += row.totalRevenue as number;
    companyMap[companyName].paytRevenue += row.paytRevenue as number;
    companyMap[companyName].monthlyRevenue += row.monthlyRevenue as number;
    companyMap[companyName].transactionCount += row.transactionCount as number;
    companyMap[companyName].confirmedRevenue += row.confirmedRevenue as number;
    companyMap[companyName].invoicedRevenue += row.invoicedRevenue as number;
    companyMap[companyName].pendingRevenue += row.pendingRevenue as number;
  }

  return Object.values(companyMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Get lot-wise revenue breakdown with revenue quality tiers.
 */
export async function getLotBreakdown() {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');
  const pipeline = [
    { $match: { buildingId: { $exists: true, $ne: null } } },
    {
      $addFields: {
        lotId: {
          $let: {
            vars: { parts: { $split: ['$buildingId', ' '] } },
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
          $sum: { $cond: [{ $eq: ['$isMonthly', false] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        monthlyRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        transactionCount: { $sum: 1 },
        confirmedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'true'] }, { $eq: ['$status', true] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        invoicedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'false'] }, { $eq: ['$status', false] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        pendingRevenue: {
          $sum: {
            $cond: [{ $eq: ['$transcationId', '000'] }, { $ifNull: ['$amount', 0] }, 0],
          },
        },
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
        confirmedRevenue: 1,
        invoicedRevenue: 1,
        pendingRevenue: 1,
      },
    },
  ];
  return await collection.aggregate(pipeline).toArray();
}

/**
 * Get monthly revenue trends with revenue quality tiers.
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
          $sum: { $cond: [{ $eq: ['$isMonthly', false] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        monthlyRevenue: {
          $sum: { $cond: [{ $eq: ['$isMonthly', true] }, { $ifNull: ['$amount', 0] }, 0] },
        },
        confirmedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'true'] }, { $eq: ['$status', true] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        invoicedRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $or: [{ $eq: ['$status', 'false'] }, { $eq: ['$status', false] }] },
                  { $ne: ['$transcationId', '000'] },
                  { $ne: ['$transcationId', null] },
                  { $ne: ['$transcationId', ''] },
                ],
              },
              { $ifNull: ['$amount', 0] },
              0,
            ],
          },
        },
        pendingRevenue: {
          $sum: {
            $cond: [{ $eq: ['$transcationId', '000'] }, { $ifNull: ['$amount', 0] }, 0],
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
