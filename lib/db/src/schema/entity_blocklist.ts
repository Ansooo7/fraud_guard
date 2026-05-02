import { pgTable, serial, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const entityBlocklistTable = pgTable("entity_blocklist", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 30 }).notNull(), // merchant_id | bin | ip | email | device_id
  entityValue: varchar("entity_value", { length: 255 }).notNull(),
  action: varchar("action", { length: 10 }).notNull().default("block"), // block | allow
  reason: text("reason"),
  createdBy: varchar("created_by", { length: 255 }),
  active: boolean("active").notNull().default(true),
  hitCount: serial("hit_count"),
  lastHitAt: timestamp("last_hit_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_blocklist_type_value").on(table.entityType, table.entityValue),
  index("idx_blocklist_active").on(table.active),
]);

export type EntityBlocklist = typeof entityBlocklistTable.$inferSelect;
