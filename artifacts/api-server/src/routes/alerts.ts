import { Router } from "express";
import { db } from "@workspace/db";
import { fraudAlertsTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { ListAlertsQueryParams, ResolveAlertBody } from "@workspace/api-zod";

const router = Router();

router.get("/alerts", requireAuth, async (req, res) => {
  const parsed = ListAlertsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { limit: 20, offset: 0 };
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  const conditions = [];
  if (params.severity) conditions.push(eq(fraudAlertsTable.severity, params.severity as any));
  if (params.resolved !== undefined) conditions.push(eq(fraudAlertsTable.resolved, params.resolved));

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(fraudAlertsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
    db.select({
      id: fraudAlertsTable.id,
      transactionId: fraudAlertsTable.transactionId,
      userId: fraudAlertsTable.userId,
      severity: fraudAlertsTable.severity,
      reason: fraudAlertsTable.reason,
      fraudScore: fraudAlertsTable.fraudScore,
      anomalyScore: fraudAlertsTable.anomalyScore,
      resolved: fraudAlertsTable.resolved,
      resolvedAt: fraudAlertsTable.resolvedAt,
      resolvedBy: fraudAlertsTable.resolvedBy,
      notes: fraudAlertsTable.notes,
      createdAt: fraudAlertsTable.createdAt,
      userName: usersTable.name,
    })
      .from(fraudAlertsTable)
      .leftJoin(usersTable, eq(fraudAlertsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fraudAlertsTable.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const alerts = rows.map((r) => ({
    ...r,
    fraudScore: r.fraudScore ?? 0,
    anomalyScore: r.anomalyScore ?? 0,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));

  res.json({ alerts, total: countResult[0]?.count ?? 0, limit, offset });
});

router.patch("/alerts/:id/resolve", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id", message: "Invalid alert ID" }); return; }

  const parsed = ResolveAlertBody.safeParse(req.body);
  const notes = parsed.success ? (parsed.data.notes ?? null) : null;

  const [alert] = await db.update(fraudAlertsTable)
    .set({ resolved: true, resolvedAt: new Date(), resolvedBy: req.user!.userId, notes })
    .where(eq(fraudAlertsTable.id, id))
    .returning();

  if (!alert) { res.status(404).json({ error: "not_found", message: "Alert not found" }); return; }

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, alert.userId)).limit(1);

  res.json({
    ...alert,
    fraudScore: alert.fraudScore ?? 0,
    anomalyScore: alert.anomalyScore ?? 0,
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    userName: user?.name ?? null,
  });
});

export default router;
