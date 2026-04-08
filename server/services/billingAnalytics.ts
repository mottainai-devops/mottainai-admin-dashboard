import { getMongoDb } from '../mongodb';

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

export async function getCompanyBreakdown() {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');

  const pipeline = [
    {
      $lookup: {
        from: 'customers',
        localField: 'userId',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmpty: true } },
    {
      $group: {
        _id: '$customer.companyId',
        companyName: { $first: '$customer.companyName' },
        totalRevenue: { $sum: '$amount' },
        recordCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 50 },
  ];

  return await collection.aggregate(pipeline).toArray();
}

export async function getLotBreakdown() {
  const db = await getMongoDb();
  const collection = db.collection('monthlybilldatas');

  const pipeline = [
    {
      $group: {
        _id: '$buildingId',
        totalRevenue: { $sum: '$amount' },
        recordCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 50 },
  ];

  return await collection.aggregate(pipeline).toArray();
}

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
        totalRevenue: { $sum: '$amount' },
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
