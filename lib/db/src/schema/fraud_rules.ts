import { pgTable, serial, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type RuleCondition = {
  field: "amount" | "merchantCategory" | "location" | "fraudScore" | "riskLevel";
  operator: "gt" | "lt" | "gte" | "lte" | "equals" | "not_equals" | "contains" | "in";
  value: number | string | string[];
};

export const fraudRulesTable = pgTable("fraud_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  conditions: jsonb("conditions").notNull().$type<RuleCondition[]>(),
  conditionLogic: varchar("condition_logic", { length: 10 }).default("AND").notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  priority: integer("priority").default(100).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FraudRule = typeof fraudRulesTable.$inferSelect;
export type InsertFraudRule = typeof fraudRulesTable.$inferInsert;
