import { logger } from "./logger";

export interface FraudAnalysisInput {
  amount: number;
  userId: number;
  location: string;
  deviceId?: string;
  merchantCategory?: string;
  merchantId?: string;
  ipAddress?: string;
  cardBin?: string;
  userTransactionCount: number;
  userAvgAmount: number;
  userUniqueLocations: number;
  userUniqueDevices: number;
  userFlaggedCount: number;
  // Velocity: transactions in last 1h / 10m
  velocityLastHour?: number;
  velocityLast10Min?: number;
  // Blocklist hits
  blocklistHit?: boolean;
  allowlistHit?: boolean;
}

export interface FraudAnalysisResult {
  fraudScore: number;
  anomalyScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "approved" | "flagged" | "blocked";
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
}

export function analyzeFraud(input: FraudAnalysisInput): FraudAnalysisResult {
  let fraudScore = 0;
  let anomalyScore = 0;
  const reasons: string[] = [];

  // ── Blocklist / allowlist override ────────────────────────────────────────
  if (input.allowlistHit) {
    return {
      fraudScore: 0.01,
      anomalyScore: 0.01,
      riskLevel: "low",
      status: "approved",
      reason: "Entity is on the allowlist",
      severity: "low",
    };
  }
  if (input.blocklistHit) {
    return {
      fraudScore: 1,
      anomalyScore: 1,
      riskLevel: "critical",
      status: "blocked",
      reason: "Entity matched the blocklist",
      severity: "critical",
    };
  }

  // ── Velocity checks ───────────────────────────────────────────────────────
  if (input.velocityLast10Min !== undefined && input.velocityLast10Min >= 5) {
    fraudScore += 0.45;
    anomalyScore += 0.4;
    reasons.push(`High velocity: ${input.velocityLast10Min} transactions in last 10 minutes`);
  } else if (input.velocityLast10Min !== undefined && input.velocityLast10Min >= 3) {
    fraudScore += 0.25;
    anomalyScore += 0.2;
    reasons.push(`Elevated velocity: ${input.velocityLast10Min} transactions in 10 minutes`);
  }

  if (input.velocityLastHour !== undefined && input.velocityLastHour >= 15) {
    fraudScore += 0.3;
    anomalyScore += 0.25;
    reasons.push(`Very high hourly velocity: ${input.velocityLastHour} transactions`);
  } else if (input.velocityLastHour !== undefined && input.velocityLastHour >= 8) {
    fraudScore += 0.15;
    anomalyScore += 0.12;
    reasons.push(`High hourly velocity: ${input.velocityLastHour} transactions`);
  }

  // ── Amount-based scoring ──────────────────────────────────────────────────
  if (input.amount > 10000) {
    fraudScore += 0.3;
    anomalyScore += 0.35;
    reasons.push("Large transaction amount");
  } else if (input.amount > 5000) {
    fraudScore += 0.15;
    anomalyScore += 0.2;
  } else if (input.amount > 2000) {
    fraudScore += 0.05;
    anomalyScore += 0.08;
  }

  // ── Amount deviation from user average ───────────────────────────────────
  if (input.userAvgAmount > 0) {
    const amountRatio = input.amount / input.userAvgAmount;
    if (amountRatio > 10) {
      fraudScore += 0.35;
      anomalyScore += 0.4;
      reasons.push("Amount far exceeds user average");
    } else if (amountRatio > 5) {
      fraudScore += 0.2;
      anomalyScore += 0.25;
      reasons.push("Amount significantly exceeds user average");
    } else if (amountRatio > 3) {
      fraudScore += 0.1;
      anomalyScore += 0.12;
    }
  }

  // ── High-risk merchant categories ─────────────────────────────────────────
  const highRiskCategories = ["gambling", "crypto", "wire_transfer", "money_order"];
  const mediumRiskCategories = ["electronics", "jewelry", "gift_cards"];
  if (input.merchantCategory && highRiskCategories.includes(input.merchantCategory.toLowerCase())) {
    fraudScore += 0.25;
    anomalyScore += 0.2;
    reasons.push("High-risk merchant category");
  } else if (input.merchantCategory && mediumRiskCategories.includes(input.merchantCategory.toLowerCase())) {
    fraudScore += 0.1;
    anomalyScore += 0.08;
  }

  // ── User history scoring ──────────────────────────────────────────────────
  if (input.userFlaggedCount > 5) {
    fraudScore += 0.3;
    reasons.push("User has multiple previous fraud flags");
  } else if (input.userFlaggedCount > 2) {
    fraudScore += 0.15;
    reasons.push("User has previous fraud flags");
  } else if (input.userFlaggedCount > 0) {
    fraudScore += 0.07;
  }

  // ── Location diversity ───────────────────────────────────────────────────
  if (input.userTransactionCount > 5 && input.userUniqueLocations > 0) {
    const locationScore = Math.min(input.userUniqueLocations / (input.userTransactionCount || 1), 1);
    if (locationScore > 0.7) {
      anomalyScore += 0.25;
      reasons.push("Unusually high location diversity");
    } else if (locationScore > 0.5) {
      anomalyScore += 0.12;
    }
  }

  // ── Device diversity ─────────────────────────────────────────────────────
  if (input.userTransactionCount > 3 && input.userUniqueDevices > 3) {
    anomalyScore += 0.15;
    reasons.push("Multiple devices detected");
  }

  // ── New user with high amount ─────────────────────────────────────────────
  if (input.userTransactionCount < 3 && input.amount > 1000) {
    fraudScore += 0.2;
    anomalyScore += 0.15;
    reasons.push("New user with high-value transaction");
  }

  // Clamp scores
  fraudScore = Math.min(fraudScore + Math.random() * 0.05, 1);
  anomalyScore = Math.min(anomalyScore + Math.random() * 0.05, 1);

  const combinedScore = (fraudScore * 0.6) + (anomalyScore * 0.4);

  let riskLevel: "low" | "medium" | "high" | "critical";
  let status: "approved" | "flagged" | "blocked";
  let severity: "low" | "medium" | "high" | "critical";

  if (combinedScore >= 0.75) {
    riskLevel = "critical";
    status = "blocked";
    severity = "critical";
  } else if (combinedScore >= 0.55) {
    riskLevel = "high";
    status = "flagged";
    severity = "high";
  } else if (combinedScore >= 0.35) {
    riskLevel = "medium";
    status = "flagged";
    severity = "medium";
  } else {
    riskLevel = "low";
    status = "approved";
    severity = "low";
  }

  const reason = reasons.length > 0
    ? reasons.join("; ")
    : "Transaction within normal parameters";

  logger.debug({ fraudScore, anomalyScore, riskLevel }, "Fraud analysis complete");

  return { fraudScore, anomalyScore, riskLevel, status, reason, severity };
}
