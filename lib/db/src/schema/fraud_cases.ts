import { pgTable, serial, integer, text, timestamp, real, pgEnum, index, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { fraudAlertsTable } from "./fraud_alerts";

export const caseStatusEnum = pgEnum("case_status", ["open", "under_review", "resolved", "dismissed"]);
export const casePriorityEnum = pgEnum("case_priority", ["low", "medium", "high", "critical"]);

export const fraudCasesTable = pgTable("fraud_cases", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: caseStatusEnum("status").notNull().default("open"),
  priority: casePriorityEnum("priority").notNull().default("medium"),
  alertId: integer("alert_id").references(() => fraudAlertsTable.id),
  transactionRef: varchar("transaction_ref", { length: 100 }),
  merchantName: varchar("merchant_name", { length: 255 }),
  amount: real("amount"),
  location: varchar("location", { length: 255 }),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_cases_status").on(table.status),
  index("idx_cases_priority").on(table.priority),
  index("idx_cases_assigned_to").on(table.assignedTo),
  index("idx_cases_created_at").on(table.createdAt),
]);

export const caseNotesTable = pgTable("case_notes", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => fraudCasesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_case_notes_case_id").on(table.caseId),
]);

export type FraudCase = typeof fraudCasesTable.$inferSelect;
export type InsertFraudCase = typeof fraudCasesTable.$inferInsert;
export type CaseNote = typeof caseNotesTable.$inferSelect;
export type InsertCaseNote = typeof caseNotesTable.$inferInsert;
