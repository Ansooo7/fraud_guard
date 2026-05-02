import { pgTable, serial, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const loginOtpsTable = pgTable("login_otps", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_login_otps_email").on(table.email),
  index("idx_login_otps_code").on(table.code),
]);

export type LoginOtp = typeof loginOtpsTable.$inferSelect;
