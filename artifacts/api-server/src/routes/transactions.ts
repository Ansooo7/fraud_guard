import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, usersTable, fraudAlertsTable, riskProfilesTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { analyzeFraud } from "../lib/fraud-engine";
import { broadcastAlert, broadcastTransaction } from "../lib/websocket";
import { CreateTransactionBody, ListTransactionsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/transactions", requireAuth, async (req, res) => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  const params = parsed.success ? parsed.data : { limit: 50, offset: 0 };
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  const conditions = [];
  if (params.status) conditions.push(eq(transactionsTable.status, params.status as any));
  if (params.riskLevel) conditions.push(eq(transactionsTable.riskLevel, params.riskLevel as any));

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(transactionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
    db.select({
      id: transactionsTable.id,
      userId: transactionsTable.userId,
      amount: transactionsTable.amount,
      currency: transactionsTable.currency,
      merchantName: transactionsTable.merchantName,
      merchantCategory: transactionsTable.merchantCategory,
      location: transactionsTable.location,
      deviceId: transactionsTable.deviceId,
      ipAddress: transactionsTable.ipAddress,
      status: transactionsTable.status,
      riskLevel: transactionsTable.riskLevel,
      fraudScore: transactionsTable.fraudScore,
      anomalyScore: transactionsTable.anomalyScore,
      createdAt: transactionsTable.createdAt,
      userName: usersTable.name,
    })
      .from(transactionsTable)
      .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const transactions = rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    fraudScore: r.fraudScore ?? 0,
    anomalyScore: r.anomalyScore ?? 0,
    createdAt: r.createdAt.toISOString(),
  }));

  res.json({ transactions, total: countResult[0]?.count ?? 0, limit, offset });
});

router.post("/transactions", requireAuth, async (req, res) => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid request body" });
    return;
  }
  const data = parsed.data;

  // Get user risk profile
  const [profile] = await db.select().from(riskProfilesTable).where(eq(riskProfilesTable.userId, data.userId)).limit(1);

  const analysis = analyzeFraud({
    amount: Number(data.amount),
    userId: data.userId,
    location: data.location,
    deviceId: data.deviceId ?? undefined,
    merchantCategory: data.merchantCategory ?? undefined,
    userTransactionCount: profile?.transactionCount ?? 0,
    userAvgAmount: profile?.avgTransactionAmount ?? 0,
    userUniqueLocations: profile?.uniqueLocations ?? 0,
    userUniqueDevices: profile?.uniqueDevices ?? 0,
    userFlaggedCount: profile?.flaggedCount ?? 0,
  });

  const [tx] = await db.insert(transactionsTable).values({
    userId: data.userId,
    amount: String(data.amount),
    currency: data.currency ?? "USD",
    merchantName: data.merchantName,
    merchantCategory: data.merchantCategory ?? null,
    location: data.location,
    deviceId: data.deviceId ?? null,
    ipAddress: data.ipAddress ?? null,
    status: analysis.status,
    riskLevel: analysis.riskLevel,
    fraudScore: analysis.fraudScore,
    anomalyScore: analysis.anomalyScore,
  }).returning();

  // Update risk profile
  const newCount = (profile?.transactionCount ?? 0) + 1;
  const newAvg = ((profile?.avgTransactionAmount ?? 0) * (profile?.transactionCount ?? 0) + Number(data.amount)) / newCount;
  const newMax = Math.max(profile?.maxTransactionAmount ?? 0, Number(data.amount));
  const newFlagged = (profile?.flaggedCount ?? 0) + (analysis.status === "flagged" || analysis.status === "blocked" ? 1 : 0);
  const newBlocked = (profile?.blockedCount ?? 0) + (analysis.status === "blocked" ? 1 : 0);

  await db.insert(riskProfilesTable).values({
    userId: data.userId,
    transactionCount: newCount,
    avgTransactionAmount: newAvg,
    maxTransactionAmount: newMax,
    flaggedCount: newFlagged,
    blockedCount: newBlocked,
    riskScore: analysis.fraudScore,
    uniqueLocations: (profile?.uniqueLocations ?? 0) + 1,
    uniqueDevices: profile ? profile.uniqueDevices : 1,
    lastActivityAt: new Date(),
  }).onConflictDoUpdate({
    target: riskProfilesTable.userId,
    set: {
      transactionCount: newCount,
      avgTransactionAmount: newAvg,
      maxTransactionAmount: newMax,
      flaggedCount: newFlagged,
      blockedCount: newBlocked,
      riskScore: analysis.fraudScore,
      uniqueLocations: (profile?.uniqueLocations ?? 0) + 1,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    },
  });

  let alert = null;
  if (analysis.status === "flagged" || analysis.status === "blocked") {
    const [newAlert] = await db.insert(fraudAlertsTable).values({
      transactionId: tx.id,
      userId: data.userId,
      severity: analysis.severity,
      reason: analysis.reason,
      fraudScore: analysis.fraudScore,
      anomalyScore: analysis.anomalyScore,
    }).returning();
    alert = { ...newAlert, createdAt: newAlert.createdAt.toISOString() };
    broadcastAlert(alert);
  }

  const result = {
    ...tx,
    amount: Number(tx.amount),
    fraudScore: tx.fraudScore ?? 0,
    anomalyScore: tx.anomalyScore ?? 0,
    createdAt: tx.createdAt.toISOString(),
    alert,
  };

  broadcastTransaction(result);
  res.status(201).json(result);
});

router.get("/transactions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id", message: "Invalid transaction ID" }); return; }

  const [row] = await db.select({
    id: transactionsTable.id,
    userId: transactionsTable.userId,
    amount: transactionsTable.amount,
    currency: transactionsTable.currency,
    merchantName: transactionsTable.merchantName,
    merchantCategory: transactionsTable.merchantCategory,
    location: transactionsTable.location,
    deviceId: transactionsTable.deviceId,
    ipAddress: transactionsTable.ipAddress,
    status: transactionsTable.status,
    riskLevel: transactionsTable.riskLevel,
    fraudScore: transactionsTable.fraudScore,
    anomalyScore: transactionsTable.anomalyScore,
    createdAt: transactionsTable.createdAt,
    userName: usersTable.name,
  }).from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(eq(transactionsTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ error: "not_found", message: "Transaction not found" }); return; }

  const [alert] = await db.select().from(fraudAlertsTable).where(eq(fraudAlertsTable.transactionId, id)).limit(1);

  res.json({
    ...row,
    amount: Number(row.amount),
    fraudScore: row.fraudScore ?? 0,
    anomalyScore: row.anomalyScore ?? 0,
    createdAt: row.createdAt.toISOString(),
    alert: alert ? { ...alert, createdAt: alert.createdAt.toISOString(), resolvedAt: alert.resolvedAt?.toISOString() ?? null } : undefined,
  });
});

export default router;
