import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { analyzeFraud } from "../lib/fraud-engine";
import { z } from "zod";

const router = Router();

const FraudCheckBody = z.object({
  amount: z.number().positive(),
  merchantName: z.string().min(1),
  merchantCategory: z.string().optional(),
  location: z.string().min(1),
  deviceId: z.string().optional(),
});

router.post("/fraud/check", requireAuth, async (req, res) => {
  const parsed = FraudCheckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid request body" });
    return;
  }

  const { amount, merchantName, merchantCategory, location, deviceId } = parsed.data;
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

  const signals: string[] = [];

  const result = analyzeFraud({
    amount,
    userId,
    location,
    deviceId,
    merchantCategory,
    userTransactionCount: stats?.transactionCount ?? 0,
    userAvgAmount: stats?.avgAmount ?? 0,
    userUniqueLocations: stats?.uniqueLocations ?? 0,
    userUniqueDevices: stats?.uniqueDevices ?? 0,
    userFlaggedCount: stats?.flaggedCount ?? 0,
  });

  if (result.reason !== "Transaction within normal parameters") {
    signals.push(...result.reason.split("; "));
  }

  const highRisk = ["gambling", "crypto", "wire_transfer", "money_order"];
  const medRisk = ["electronics", "jewelry", "gift_cards"];
  if (merchantCategory && highRisk.includes(merchantCategory.toLowerCase())) {
    if (!signals.includes("High-risk merchant category")) signals.push("High-risk merchant category");
  } else if (merchantCategory && medRisk.includes(merchantCategory.toLowerCase())) {
    signals.push("Medium-risk merchant category");
  }

  if (amount > 10000) signals.push("Large transaction amount (>$10,000)");
  else if (amount > 5000) signals.push("High transaction amount (>$5,000)");

  if (!signals.length) signals.push("No risk signals detected");

  const uniqueSignals = [...new Set(signals)];

  res.json({
    fraudScore: result.fraudScore,
    anomalyScore: result.anomalyScore,
    riskLevel: result.riskLevel,
    status: result.status,
    severity: result.severity,
    reason: result.reason,
    signals: uniqueSignals,
    merchantName,
    amount,
  });
});

export default router;
