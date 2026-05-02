import { Router } from "express";
import { db, fraudRulesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const ConditionSchema = z.object({
  field: z.enum(["amount", "merchantCategory", "location", "fraudScore", "riskLevel"]),
  operator: z.enum(["gt", "lt", "gte", "lte", "equals", "not_equals", "contains", "in"]),
  value: z.union([z.number(), z.string(), z.array(z.string())]),
});

const CreateRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  conditions: z.array(ConditionSchema).min(1),
  conditionLogic: z.enum(["AND", "OR"]).default("AND"),
  action: z.enum(["approve", "flag", "block"]),
  priority: z.number().int().min(1).max(1000).default(100),
  enabled: z.boolean().default(true),
});

const UpdateRuleSchema = CreateRuleSchema.partial();

// List all rules
router.get("/rules", requireAuth, async (req, res) => {
  const rules = await db
    .select()
    .from(fraudRulesTable)
    .orderBy(asc(fraudRulesTable.priority));
  res.json(rules);
});

// Create rule
router.post("/rules", requireAuth, async (req, res) => {
  const parsed = CreateRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const [rule] = await db
    .insert(fraudRulesTable)
    .values({ ...parsed.data, createdBy: req.user!.userId })
    .returning();
  res.status(201).json(rule);
});

// Update rule
router.patch("/rules/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const parsed = UpdateRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const [rule] = await db
    .update(fraudRulesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(fraudRulesTable.id, id))
    .returning();
  if (!rule) { res.status(404).json({ error: "not_found" }); return; }
  res.json(rule);
});

// Toggle enabled
router.post("/rules/:id/toggle", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const [existing] = await db.select().from(fraudRulesTable).where(eq(fraudRulesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "not_found" }); return; }

  const [rule] = await db
    .update(fraudRulesTable)
    .set({ enabled: !existing.enabled, updatedAt: new Date() })
    .where(eq(fraudRulesTable.id, id))
    .returning();
  res.json(rule);
});

// Delete rule
router.delete("/rules/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const [deleted] = await db
    .delete(fraudRulesTable)
    .where(eq(fraudRulesTable.id, id))
    .returning();
  if (!deleted) { res.status(404).json({ error: "not_found" }); return; }
  res.status(204).send();
});

export default router;
