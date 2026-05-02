import { pgTable, serial, integer, text, timestamp, boolean, real, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { transactionsTable } from "./transactions";

export const alertSeverityEnum = pgEnum("alert_severity", ["low", "medium", "high", "critical"]);

export const fraudAlertsTable = pgTable("fraud_alerts", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().references(() => transactionsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  severity: alertSeverityEnum("severity").notNull(),
  reason: text("reason").notNull(),
  fraudScore: real("fraud_score").notNull(),
  anomalyScore: real("anomaly_score").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => usersTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_alerts_transaction_id").on(table.transactionId),
  index("idx_alerts_user_id").on(table.userId),
  index("idx_alerts_severity").on(table.severity),
  index("idx_alerts_resolved").on(table.resolved),
  index("idx_alerts_created_at").on(table.createdAt),
]);

export const insertAlertSchema = createInsertSchema(fraudAlertsTable).omit({ id: true, createdAt: true, resolved: true, resolvedAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type FraudAlert = typeof fraudAlertsTable.$inferSelect;
