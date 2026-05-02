import { Router } from "express";
import { db, transactionsTable, fraudAlertsTable, fraudCasesTable, usersTable } from "@workspace/db";
import { ilike, or, desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/search", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit ?? 8), 20);

  if (!q || q.length < 2) {
    res.json({ results: [], total: 0 });
    return;
  }

  const pattern = `%${q}%`;

  // Run all queries in parallel
  const [txRows, alertRows, caseRows] = await Promise.all([
    db
      .select({
        id: transactionsTable.id,
        merchantName: transactionsTable.merchantName,
        status: transactionsTable.status,
        riskLevel: transactionsTable.riskLevel,
        amount: transactionsTable.amount,
        createdAt: transactionsTable.createdAt,
        userName: usersTable.name,
      })
      .from(transactionsTable)
      .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
      .where(
        or(
          ilike(transactionsTable.merchantName, pattern),
          ilike(transactionsTable.location, pattern),
          ilike(usersTable.name, pattern),
          ilike(usersTable.email, pattern),
        )
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit),

    db
      .select({
        id: fraudAlertsTable.id,
        reason: fraudAlertsTable.reason,
        severity: fraudAlertsTable.severity,
        resolved: fraudAlertsTable.resolved,
        createdAt: fraudAlertsTable.createdAt,
        userName: usersTable.name,
      })
      .from(fraudAlertsTable)
      .leftJoin(usersTable, eq(fraudAlertsTable.userId, usersTable.id))
      .where(
        or(
          ilike(fraudAlertsTable.reason, pattern),
          ilike(usersTable.name, pattern),
          ilike(usersTable.email, pattern),
        )
      )
      .orderBy(desc(fraudAlertsTable.createdAt))
      .limit(limit),

    db
      .select({
        id: fraudCasesTable.id,
        title: fraudCasesTable.title,
        description: fraudCasesTable.description,
        status: fraudCasesTable.status,
        priority: fraudCasesTable.priority,
        createdAt: fraudCasesTable.createdAt,
      })
      .from(fraudCasesTable)
      .where(
        or(
          ilike(fraudCasesTable.title, pattern),
          ilike(fraudCasesTable.description, pattern),
        )
      )
      .orderBy(desc(fraudCasesTable.createdAt))
      .limit(limit),
  ]);

  const severityBadgeColor: Record<string, string> = {
    critical: "red",
    high: "orange",
    medium: "amber",
    low: "blue",
  };

  const statusBadgeColor: Record<string, string> = {
    blocked: "red",
    flagged: "amber",
    approved: "green",
    open: "blue",
    in_review: "amber",
    resolved: "green",
    closed: "gray",
  };

  const results = [
    ...txRows.map((t) => ({
      type: "transaction" as const,
      id: t.id,
      title: `${t.merchantName} — $${Number(t.amount).toLocaleString()}`,
      subtitle: t.userName ? `User: ${t.userName}` : `Tx #${t.id}`,
      badge: t.status,
      badgeColor: statusBadgeColor[t.status] ?? "gray",
      href: `/transactions`,
      createdAt: t.createdAt.toISOString(),
    })),
    ...alertRows.map((a) => ({
      type: "alert" as const,
      id: a.id,
      title: a.reason.slice(0, 80),
      subtitle: a.userName ? `User: ${a.userName}` : `Alert #${a.id}`,
      badge: a.severity,
      badgeColor: severityBadgeColor[a.severity] ?? "gray",
      href: `/alerts`,
      createdAt: a.createdAt.toISOString(),
    })),
    ...caseRows.map((c) => ({
      type: "case" as const,
      id: c.id,
      title: c.title,
      subtitle: c.description?.slice(0, 60) ?? `Case #${c.id}`,
      badge: c.priority ?? c.status,
      badgeColor: statusBadgeColor[c.status] ?? "gray",
      href: `/cases`,
      createdAt: c.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit * 2);

  res.json({ results, total: results.length });
});

export default router;
