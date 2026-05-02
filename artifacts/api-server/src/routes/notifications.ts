import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// List notifications for current user
router.get("/notifications", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(notifications);
});

// Count unread for current user
router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
  res.json({ count: rows.length });
});

// Mark one as read
router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }
  const [n] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.userId)))
    .returning();
  if (!n) { res.status(404).json({ error: "not_found" }); return; }
  res.json(n);
});

// Mark all read
router.post("/notifications/read-all", requireAuth, async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, req.user!.userId), eq(notificationsTable.isRead, false)));
  res.json({ ok: true });
});

// Delete a notification
router.delete("/notifications/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }
  await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.userId)));
  res.status(204).send();
});

export default router;
