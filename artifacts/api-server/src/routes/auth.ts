import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, emailVerificationTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middlewares/auth";
import { LoginBody } from "@workspace/api-zod";
import { sendVerificationEmail } from "../lib/email";
import { z } from "zod";

const RegisterBody = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(6),
});

const ResendBody = z.object({
  email: z.string().email(),
});

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildVerifyUrl(req: import("express").Request, token: string): string {
  // Derive the public base URL from the incoming request so it works on both
  // localhost dev and the Replit proxy domain.
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  const proto = req.get("x-forwarded-proto") ?? (req.secure ? "https" : "http");
  // Strip any trailing /api path — the frontend lives at the root.
  const base = `${proto}://${host}`.replace(/\/api$/, "");
  return `${base}/verify-email?token=${token}`;
}

async function issueVerificationToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
  await db.insert(emailVerificationTokensTable).values({ userId, token, expiresAt });
  return token;
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid request body" });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    return;
  }
  if (!user.emailVerified) {
    res.status(403).json({ error: "email_not_verified", message: "Please verify your email before signing in.", email: user.email });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() },
  });
});

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid request body" });
    return;
  }
  const { name, email, password } = parsed.data;

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "conflict", message: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash, role: "user", emailVerified: true, emailVerifiedAt: now })
    .returning();
  if (!user) {
    res.status(500).json({ error: "server_error", message: "Failed to create account" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() },
  });
});

router.get("/auth/verify-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: "missing_token", message: "Verification token is required" });
    return;
  }

  const now = new Date();
  const [record] = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(
      and(
        eq(emailVerificationTokensTable.token, token),
        isNull(emailVerificationTokensTable.usedAt),
        gt(emailVerificationTokensTable.expiresAt, now),
      )
    )
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "invalid_token", message: "This verification link is invalid or has expired." });
    return;
  }

  // Mark token used + verify user atomically
  await Promise.all([
    db
      .update(emailVerificationTokensTable)
      .set({ usedAt: now })
      .where(eq(emailVerificationTokensTable.id, record.id)),
    db
      .update(usersTable)
      .set({ emailVerified: true, emailVerifiedAt: now })
      .where(eq(usersTable.id, record.userId)),
  ]);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1);
  if (!user) {
    res.status(500).json({ error: "server_error", message: "User not found after verification" });
    return;
  }

  const jwtToken = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token: jwtToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() },
  });
});

router.post("/auth/resend-verification", async (req, res) => {
  const parsed = ResendBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "A valid email is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);

  // Always return success to avoid leaking whether an email exists
  if (!user || user.emailVerified) {
    res.json({ message: "If this email is registered and unverified, a new link has been sent." });
    return;
  }

  const verifyToken = await issueVerificationToken(user.id);
  const verifyUrl = buildVerifyUrl(req, verifyToken);
  await sendVerificationEmail({ toEmail: user.email, toName: user.name, verifyUrl });

  res.json({ message: "Verification email resent. Please check your inbox." });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() });
});

export default router;
