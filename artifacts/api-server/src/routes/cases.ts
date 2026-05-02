import { Router } from "express";
import { db, fraudCasesTable, caseNotesTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const CreateCaseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  alertId: z.number().int().optional(),
  transactionRef: z.string().optional(),
  merchantName: z.string().optional(),
  amount: z.number().optional(),
  location: z.string().optional(),
  assignedTo: z.number().int().optional(),
});

const UpdateCaseSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(["open", "under_review", "resolved", "dismissed"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTo: z.number().int().nullable().optional(),
});

const AddNoteSchema = z.object({
  content: z.string().min(1),
});

// List cases with optional filters
router.get("/cases", requireAuth, async (req, res) => {
  const { status, priority, assignedTo } = req.query;

  const conditions = [];
  if (status) conditions.push(eq(fraudCasesTable.status, status as any));
  if (priority) conditions.push(eq(fraudCasesTable.priority, priority as any));
  if (assignedTo) conditions.push(eq(fraudCasesTable.assignedTo, parseInt(assignedTo as string)));

  const cases = await db
    .select({
      id: fraudCasesTable.id,
      title: fraudCasesTable.title,
      description: fraudCasesTable.description,
      status: fraudCasesTable.status,
      priority: fraudCasesTable.priority,
      alertId: fraudCasesTable.alertId,
      transactionRef: fraudCasesTable.transactionRef,
      merchantName: fraudCasesTable.merchantName,
      amount: fraudCasesTable.amount,
      location: fraudCasesTable.location,
      assignedTo: fraudCasesTable.assignedTo,
      assigneeName: usersTable.name,
      createdBy: fraudCasesTable.createdBy,
      createdAt: fraudCasesTable.createdAt,
      updatedAt: fraudCasesTable.updatedAt,
      resolvedAt: fraudCasesTable.resolvedAt,
      noteCount: sql<number>`(SELECT COUNT(*) FROM case_notes WHERE case_id = ${fraudCasesTable.id})`.as("note_count"),
    })
    .from(fraudCasesTable)
    .leftJoin(usersTable, eq(fraudCasesTable.assignedTo, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(fraudCasesTable.createdAt));

  res.json(cases);
});

// Create case
router.post("/cases", requireAuth, async (req, res) => {
  const parsed = CreateCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }
  const [created] = await db
    .insert(fraudCasesTable)
    .values({ ...parsed.data, createdBy: req.user!.userId })
    .returning();
  res.status(201).json(created);
});

// Get single case
router.get("/cases/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const [found] = await db
    .select({
      id: fraudCasesTable.id,
      title: fraudCasesTable.title,
      description: fraudCasesTable.description,
      status: fraudCasesTable.status,
      priority: fraudCasesTable.priority,
      alertId: fraudCasesTable.alertId,
      transactionRef: fraudCasesTable.transactionRef,
      merchantName: fraudCasesTable.merchantName,
      amount: fraudCasesTable.amount,
      location: fraudCasesTable.location,
      assignedTo: fraudCasesTable.assignedTo,
      assigneeName: usersTable.name,
      createdBy: fraudCasesTable.createdBy,
      createdAt: fraudCasesTable.createdAt,
      updatedAt: fraudCasesTable.updatedAt,
      resolvedAt: fraudCasesTable.resolvedAt,
    })
    .from(fraudCasesTable)
    .leftJoin(usersTable, eq(fraudCasesTable.assignedTo, usersTable.id))
    .where(eq(fraudCasesTable.id, id))
    .limit(1);

  if (!found) { res.status(404).json({ error: "not_found" }); return; }
  res.json(found);
});

// Update case
router.patch("/cases/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const parsed = UpdateCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.status === "resolved" || parsed.data.status === "dismissed") {
    updates.resolvedAt = new Date();
  }

  const [updated] = await db
    .update(fraudCasesTable)
    .set(updates as any)
    .where(eq(fraudCasesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "not_found" }); return; }
  res.json(updated);
});

// Delete case
router.delete("/cases/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const [deleted] = await db
    .delete(fraudCasesTable)
    .where(eq(fraudCasesTable.id, id))
    .returning();

  if (!deleted) { res.status(404).json({ error: "not_found" }); return; }
  res.status(204).send();
});

// List notes for a case
router.get("/cases/:id/notes", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const notes = await db
    .select({
      id: caseNotesTable.id,
      caseId: caseNotesTable.caseId,
      content: caseNotesTable.content,
      createdBy: caseNotesTable.createdBy,
      authorName: usersTable.name,
      createdAt: caseNotesTable.createdAt,
    })
    .from(caseNotesTable)
    .leftJoin(usersTable, eq(caseNotesTable.createdBy, usersTable.id))
    .where(eq(caseNotesTable.caseId, id))
    .orderBy(caseNotesTable.createdAt);

  res.json(notes);
});

// Add note to case
router.post("/cases/:id/notes", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const parsed = AddNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  // Auto-bump updatedAt on parent case
  await db.update(fraudCasesTable).set({ updatedAt: new Date() }).where(eq(fraudCasesTable.id, id));

  const [note] = await db
    .insert(caseNotesTable)
    .values({ caseId: id, content: parsed.data.content, createdBy: req.user!.userId })
    .returning();

  res.status(201).json(note);
});

export default router;
