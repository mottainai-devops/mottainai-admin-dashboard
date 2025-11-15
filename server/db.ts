import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { companies, customers, InsertUser, monthlyBills, pickups, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Analytics Query Helpers

export async function getOverviewMetrics() {
  const db = await getDb();
  if (!db) return null;

  const totalCustomers = await db.select({ count: sql<number>`count(*)` }).from(customers);
  const totalPickups = await db.select({ count: sql<number>`count(*)` }).from(pickups);
  const totalRevenue = await db.select({ sum: sql<number>`sum(amount)` }).from(pickups).where(eq(pickups.paymentStatus, 'paid'));
  const pendingPayments = await db.select({ count: sql<number>`count(*)` }).from(pickups).where(eq(pickups.paymentStatus, 'pending'));

  return {
    totalCustomers: totalCustomers[0]?.count || 0,
    totalPickups: totalPickups[0]?.count || 0,
    totalRevenue: totalRevenue[0]?.sum || 0,
    pendingPayments: pendingPayments[0]?.count || 0,
  };
}

export async function getRevenueByType() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      pickupType: pickups.pickupType,
      customerType: pickups.customerType,
      totalRevenue: sql<number>`sum(${pickups.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(pickups)
    .where(eq(pickups.paymentStatus, 'paid'))
    .groupBy(pickups.pickupType, pickups.customerType);
}

export async function getCompanyPerformance() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      companyId: pickups.companyId,
      companyName: companies.name,
      totalRevenue: sql<number>`sum(${pickups.amount})`,
      pickupCount: sql<number>`count(*)`,
    })
    .from(pickups)
    .leftJoin(companies, eq(pickups.companyId, companies.id))
    .where(eq(pickups.paymentStatus, 'paid'))
    .groupBy(pickups.companyId, companies.name);
}

export async function getRecentPickups(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: pickups.id,
      customerName: customers.name,
      customerEmail: customers.email,
      companyName: companies.name,
      pickupType: pickups.pickupType,
      customerType: pickups.customerType,
      amount: pickups.amount,
      paymentStatus: pickups.paymentStatus,
      pickupDate: pickups.pickupDate,
    })
    .from(pickups)
    .leftJoin(customers, eq(pickups.customerId, customers.id))
    .leftJoin(companies, eq(pickups.companyId, companies.id))
    .orderBy(desc(pickups.pickupDate))
    .limit(limit);
}

export async function getCustomersByType() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      customerType: customers.customerType,
      count: sql<number>`count(*)`,
    })
    .from(customers)
    .where(eq(customers.status, 'active'))
    .groupBy(customers.customerType);
}

export async function getMonthlyBillingSummary(month: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(monthlyBills)
    .where(eq(monthlyBills.billingMonth, month))
    .orderBy(desc(monthlyBills.createdAt));
}

export async function getAllCompanies() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(companies).where(eq(companies.status, 'active'));
}

export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0] || null;
}
