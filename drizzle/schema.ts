import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Analytics and Management Tables

/**
 * Companies table - Waste management companies
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  residentialSplitCode: varchar("residentialSplitCode", { length: 50 }),
  commercialSplitCode: varchar("commercialSplitCode", { length: 50 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Customers table - End customers using waste management services
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  zohoCustomerId: varchar("zohoCustomerId", { length: 100 }),
  email: varchar("email", { length: 320 }).notNull(),
  name: text("name"),
  phone: varchar("phone", { length: 20 }),
  customerType: mysqlEnum("customerType", ["residential", "commercial"]).notNull(),
  address: text("address"),
  companyId: int("companyId"),
  buildingId: varchar("buildingId", { length: 100 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Pickups table - Waste collection records
 */
export const pickups = mysqlTable("pickups", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  companyId: int("companyId").notNull(),
  pickupType: mysqlEnum("pickupType", ["payt", "monthly"]).notNull(),
  customerType: mysqlEnum("customerType", ["residential", "commercial"]).notNull(),
  amount: int("amount").notNull(), // Amount in kobo/cents
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed"]).default("pending").notNull(),
  paystackReference: varchar("paystackReference", { length: 100 }),
  surveyId: varchar("surveyId", { length: 100 }),
  pickupDate: timestamp("pickupDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Monthly bills table - Monthly billing records
 */
export const monthlyBills = mysqlTable("monthlyBills", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  companyId: int("companyId").notNull(),
  buildingId: varchar("buildingId", { length: 100 }),
  billingMonth: varchar("billingMonth", { length: 7 }).notNull(), // Format: YYYY-MM
  totalAmount: int("totalAmount").notNull(), // Amount in kobo/cents
  pickupCount: int("pickupCount").notNull(),
  invoiceId: varchar("invoiceId", { length: 100 }),
  zohoInvoiceId: varchar("zohoInvoiceId", { length: 100 }),
  status: mysqlEnum("status", ["pending", "sent", "paid", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Pickup = typeof pickups.$inferSelect;
export type MonthlyBill = typeof monthlyBills.$inferSelect;