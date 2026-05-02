import { pgTable, serial, integer, numeric, varchar, text, timestamp, pgEnum, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "approved", "flagged", "blocked"]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high", "critical"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  merchantName: varchar("merchant_name", { length: 255 }).notNull(),
  merchantCategory: varchar("merchant_category", { length: 100 }),
  location: varchar("location", { length: 255 }).notNull(),
  deviceId: varchar("device_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  status: transactionStatusEnum("status").notNull().default("pending"),
  riskLevel: riskLevelEnum("risk_level").notNull().default("low"),
  fraudScore: real("fraud_score").notNull().default(0),
  anomalyScore: real("anomaly_score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_transactions_user_id").on(table.userId),
  index("idx_transactions_status").on(table.status),
  index("idx_transactions_risk_level").on(table.riskLevel),
  index("idx_transactions_created_at").on(table.createdAt),
]);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true, status: true, riskLevel: true, fraudScore: true, anomalyScore: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
