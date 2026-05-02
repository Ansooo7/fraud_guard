import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { analyzeFraud } from "../lib/fraud-engine";
import { z } from "zod";

const router = Router();

const TransactionInput = z.object({
  amount: z.number().positive(),
  merchantName: z.string().min(1),
  merchantCategory: z.string().optional(),
  location: z.string().min(1),
  deviceId: z.string().optional(),
});

const BatchBody = z.object({
  transactions: z.array(TransactionInput).min(1).max(500),
});

const HIGH_RISK_CATEGORIES = new Set(["gambling", "crypto", "wire_transfer", "money_order"]);
const MED_RISK_CATEGORIES = new Set(["electronics", "jewelry", "gift_cards"]);

router.post("/fraud/batch", requireAuth, async (req, res) => {
  const parsed = BatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid request body" });
    return;
  }

  const { transactions } = parsed.data;
  const userId = req.user!.userId;

  const [stats] = await db
    .select({
      transactionCount: sql<number>`count(*)::int`,
      avgAmount: sql<number>`coalesce(avg(amount::numeric), 0)`,
      uniqueLocations: sql<number>`count(distinct location)::int`,
      uniqueDevices: sql<number>`count(distinct device_id)::int`,
      flaggedCount: sql<number>`count(*) filter (where status in ('flagged','blocked'))::int`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  const results = transactions.map((tx, index) => {
    const result = analyzeFraud({
      amount: tx.amount,
      userId,
      location: tx.location,
      deviceId: tx.deviceId,
      merchantCategory: tx.merchantCategory,
      userTransactionCount: stats?.transactionCount ?? 0,
      userAvgAmount: stats?.avgAmount ?? 0,
      userUniqueLocations: stats?.uniqueLocations ?? 0,
      userUniqueDevices: stats?.uniqueDevices ?? 0,
      userFlaggedCount: stats?.flaggedCount ?? 0,
    });

    const signals: string[] = [];
    if (result.reason !== "Transaction within normal parameters") {
      signals.push(...result.reason.split("; "));
    }
    if (tx.merchantCategory && HIGH_RISK_CATEGORIES.has(tx.merchantCategory.toLowerCase())) {
      signals.push("High-risk merchant category");
    } else if (tx.merchantCategory && MED_RISK_CATEGORIES.has(tx.merchantCategory.toLowerCase())) {
      signals.push("Medium-risk merchant category");
    }
    if (tx.amount > 10000) signals.push("Large transaction amount (>$10,000)");
    else if (tx.amount > 5000) signals.push("High transaction amount (>$5,000)");

    return {
      index,
      merchantName: tx.merchantName,
      merchantCategory: tx.merchantCategory ?? "",
      amount: tx.amount,
      location: tx.location,
      fraudScore: result.fraudScore,
      anomalyScore: result.anomalyScore,
      riskLevel: result.riskLevel,
      status: result.status,
      severity: result.severity,
      reason: result.reason,
      signals: [...new Set(signals.length ? signals : ["No risk signals detected"])],
    };
  });

  res.json({
    total: results.length,
    approved: results.filter((r) => r.status === "approved").length,
    flagged: results.filter((r) => r.status === "flagged").length,
    blocked: results.filter((r) => r.status === "blocked").length,
    results,
  });
});

export default router;
