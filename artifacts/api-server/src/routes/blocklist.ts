import { Router } from "express";
import { db, entityBlocklistTable } from "@workspace/db";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const CreateSchema = z.object({
  entityType: z.enum(["merchant_id", "bin", "ip", "email", "device_id"]),
  entityValue: z.string().min(1).max(255),
  action: z.enum(["block", "allow"]),
  reason: z.string().optional(),
});

const UpdateSchema = z.object({
  active: z.boolean().optional(),
  reason: z.string().optional(),
});

// GET /blocklist
router.get("/blocklist", requireAuth, async (req, res) => {
  const entityType = req.query.entityType as string | undefined;
  const action = req.query.action as string | undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const conditions = [];
  if (entityType) conditions.push(eq(entityBlocklistTable.entityType, entityType));
  if (action) conditions.push(eq(entityBlocklistTable.action, action));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(entityBlocklistTable).where(where),
    db.select().from(entityBlocklistTable).where(where).orderBy(desc(entityBlocklistTable.createdAt)).limit(limit).offset(offset),
  ]);

  const entries = rows.map((r) => ({
    ...r,
    lastHitAt: r.lastHitAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  res.json({ entries, total: countResult[0]?.count ?? 0 });
});

// POST /blocklist
router.post("/blocklist", requireAuth, async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid blocklist entry" });
    return;
  }

  const { entityType, entityValue, action, reason } = parsed.data;
  const createdBy = (req as any).user?.email ?? "unknown";

  const [entry] = await db
    .insert(entityBlocklistTable)
    .values({ entityType, entityValue, action, reason: reason ?? null, createdBy })
    .returning();

  res.status(201).json({
    ...entry!,
    lastHitAt: entry!.lastHitAt?.toISOString() ?? null,
    createdAt: entry!.createdAt.toISOString(),
    updatedAt: entry!.updatedAt.toISOString(),
  });
});

// PATCH /blocklist/:id
router.patch("/blocklist/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id", message: "Invalid ID" }); return; }

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error", message: "Invalid body" }); return; }

  const updates: Partial<typeof entityBlocklistTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.reason !== undefined) updates.reason = parsed.data.reason;

  const [entry] = await db.update(entityBlocklistTable).set(updates).where(eq(entityBlocklistTable.id, id)).returning();
  if (!entry) { res.status(404).json({ error: "not_found", message: "Entry not found" }); return; }

  res.json({
    ...entry,
    lastHitAt: entry.lastHitAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  });
});

// DELETE /blocklist/:id
router.delete("/blocklist/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id", message: "Invalid ID" }); return; }

  await db.delete(entityBlocklistTable).where(eq(entityBlocklistTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
