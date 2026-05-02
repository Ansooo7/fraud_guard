import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, fraudAlertsTable, riskProfilesTable, usersTable } from "@workspace/db";
import { sql, desc, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/analytics/summary", requireAuth, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [txStats, alertStats, todayTx, todayAlerts] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      flagged: sql<number>`count(*) filter (where status = 'flagged')::int`,
      blocked: sql<number>`count(*) filter (where status = 'blocked')::int`,
      avgFraudScore: sql<number>`coalesce(avg(fraud_score), 0)`,
      totalAmount: sql<number>`coalesce(sum(amount::numeric), 0)`,
    }).from(transactionsTable),
    db.select({
      total: sql<number>`count(*)::int`,
      unresolved: sql<number>`count(*) filter (where resolved = false)::int`,
    }).from(fraudAlertsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(transactionsTable)
      .where(gte(transactionsTable.createdAt, today)),
    db.select({ count: sql<number>`count(*)::int` }).from(fraudAlertsTable)
      .where(gte(fraudAlertsTable.createdAt, today)),
  ]);

  const total = txStats[0]?.total ?? 0;
  const flagged = txStats[0]?.flagged ?? 0;
  const blocked = txStats[0]?.blocked ?? 0;

  res.json({
    totalTransactions: total,
    flaggedTransactions: flagged,
    blockedTransactions: blocked,
    totalAlerts: alertStats[0]?.total ?? 0,
    unresolvedAlerts: alertStats[0]?.unresolved ?? 0,
    averageFraudScore: Number((txStats[0]?.avgFraudScore ?? 0).toFixed(3)),
    fraudRate: total > 0 ? Number(((flagged + blocked) / total).toFixed(3)) : 0,
    totalAmountProcessed: Number(txStats[0]?.totalAmount ?? 0),
    todayTransactions: todayTx[0]?.count ?? 0,
    todayAlerts: todayAlerts[0]?.count ?? 0,
  });
});

router.get("/analytics/fraud-trend", requireAuth, async (req, res) => {
  const rows = await db.execute(sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*)::int as total_transactions,
      COUNT(*) FILTER (WHERE status = 'flagged')::int as flagged_count,
      COUNT(*) FILTER (WHERE status = 'blocked')::int as blocked_count
    FROM transactions
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  const trend = (rows as any[]).map((r) => ({
    date: String(r.date),
    totalTransactions: Number(r.total_transactions),
    flaggedCount: Number(r.flagged_count),
    blockedCount: Number(r.blocked_count),
    fraudRate: r.total_transactions > 0
      ? Number(((r.flagged_count + r.blocked_count) / r.total_transactions).toFixed(3))
      : 0,
  }));

  res.json(trend);
});

router.get("/analytics/risk-distribution", requireAuth, async (req, res) => {
  const rows = await db.select({
    riskLevel: transactionsTable.riskLevel,
    count: sql<number>`count(*)::int`,
  })
    .from(transactionsTable)
    .groupBy(transactionsTable.riskLevel);

  const total = rows.reduce((sum, r) => sum + (r.count ?? 0), 0);
  const distribution = rows.map((r) => ({
    riskLevel: r.riskLevel,
    count: r.count ?? 0,
    percentage: total > 0 ? Number(((r.count ?? 0) / total * 100).toFixed(1)) : 0,
  }));

  res.json(distribution);
});

router.get("/analytics/top-risk-users", requireAuth, async (req, res) => {
  const rows = await db.select({
    userId: riskProfilesTable.userId,
    riskScore: riskProfilesTable.riskScore,
    transactionCount: riskProfilesTable.transactionCount,
    flaggedCount: riskProfilesTable.flaggedCount,
    userName: usersTable.name,
    email: usersTable.email,
  })
    .from(riskProfilesTable)
    .leftJoin(usersTable, sql`${riskProfilesTable.userId} = ${usersTable.id}`)
    .orderBy(desc(riskProfilesTable.riskScore))
    .limit(10);

  res.json(rows.map((r) => ({
    userId: r.userId,
    userName: r.userName ?? "Unknown",
    email: r.email ?? "",
    riskScore: Number((r.riskScore ?? 0).toFixed(3)),
    transactionCount: r.transactionCount ?? 0,
    flaggedCount: r.flaggedCount ?? 0,
  })));
});

export default router;
