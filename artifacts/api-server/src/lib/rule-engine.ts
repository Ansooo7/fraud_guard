import type { RuleCondition, FraudRule } from "@workspace/db";

export type RuleEvalContext = {
  amount: number;
  merchantCategory?: string;
  location?: string;
  fraudScore?: number;
  anomalyScore?: number;
  riskLevel?: string;
};

function evaluateCondition(cond: RuleCondition, ctx: RuleEvalContext): boolean {
  const raw = ctx[cond.field as keyof RuleEvalContext];
  const val = cond.value;

  switch (cond.operator) {
    case "gt":  return Number(raw) > Number(val);
    case "lt":  return Number(raw) < Number(val);
    case "gte": return Number(raw) >= Number(val);
    case "lte": return Number(raw) <= Number(val);
    case "equals":
      return String(raw ?? "").toLowerCase() === String(val).toLowerCase();
    case "not_equals":
      return String(raw ?? "").toLowerCase() !== String(val).toLowerCase();
    case "contains":
      return String(raw ?? "").toLowerCase().includes(String(val).toLowerCase());
    case "in":
      return Array.isArray(val) &&
        val.map((v) => String(v).toLowerCase()).includes(String(raw ?? "").toLowerCase());
    default:
      return false;
  }
}

export function applyRules(
  rules: FraudRule[],
  ctx: RuleEvalContext
): { action: "approve" | "flag" | "block"; ruleName: string } | null {
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const conditions = rule.conditions as RuleCondition[];
    const logic = rule.conditionLogic ?? "AND";
    const matches =
      logic === "AND"
        ? conditions.every((c) => evaluateCondition(c, ctx))
        : conditions.some((c) => evaluateCondition(c, ctx));

    if (matches) {
      return { action: rule.action as "approve" | "flag" | "block", ruleName: rule.name };
    }
  }
  return null;
}
