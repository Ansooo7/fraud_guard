import { pgTable, serial, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const riskProfilesTable = pgTable("risk_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  riskScore: real("risk_score").notNull().default(0),
  transactionCount: integer("transaction_count").notNull().default(0),
  flaggedCount: integer("flagged_count").notNull().default(0),
  blockedCount: integer("blocked_count").notNull().default(0),
  avgTransactionAmount: real("avg_transaction_amount").notNull().default(0),
  maxTransactionAmount: real("max_transaction_amount").notNull().default(0),
  uniqueLocations: integer("unique_locations").notNull().default(0),
  uniqueDevices: integer("unique_devices").notNull().default(0),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_risk_profiles_user_id").on(table.userId),
  index("idx_risk_profiles_risk_score").on(table.riskScore),
]);

export const insertRiskProfileSchema = createInsertSchema(riskProfilesTable).omit({ id: true, updatedAt: true });
export type InsertRiskProfile = z.infer<typeof insertRiskProfileSchema>;
export type RiskProfile = typeof riskProfilesTable.$inferSelect;
