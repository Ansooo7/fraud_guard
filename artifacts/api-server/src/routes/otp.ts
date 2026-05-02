import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, usersTable, loginOtpsTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { signToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

const RequestSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(10),
});

function generateOtp(): string {
  // 6-digit numeric code
  return String(crypto.randomInt(100000, 999999));
}

// POST /auth/otp/request — generate & "send" a code
router.post("/auth/otp/request", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "A valid email is required" });
    return;
  }

  const { email, name } = parsed.data;
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Invalidate any previous unused OTPs for this email
  await db
    .update(loginOtpsTable)
    .set({ usedAt: new Date() })
    .where(and(eq(loginOtpsTable.email, email), isNull(loginOtpsTable.usedAt)));

  await db.insert(loginOtpsTable).values({ email, code, expiresAt });

  // Log so developer can see the code in the console
  logger.info({ email, code }, "🔐  [DEMO OTP] Verification code for " + email);

  // In demo mode, return the code directly in the response so the UI can show it
  res.json({
    message: `A 6-digit verification code has been sent to ${email}.`,
    devCode: code, // Remove this field when wiring up a real email provider
  });
});

// POST /auth/otp/verify — verify code, auto-create user if needed, return JWT
router.post("/auth/otp/verify", async (req, res) => {
  const parsed = VerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Email and 6-digit code are required" });
    return;
  }

  const { email, code } = parsed.data;
  const now = new Date();

  const [record] = await db
    .select()
    .from(loginOtpsTable)
    .where(
      and(
        eq(loginOtpsTable.email, email),
        eq(loginOtpsTable.code, code),
        isNull(loginOtpsTable.usedAt),
        gt(loginOtpsTable.expiresAt, now),
      )
    )
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "invalid_code", message: "The code is incorrect or has expired. Please request a new one." });
    return;
  }

  // Mark code used
  await db.update(loginOtpsTable).set({ usedAt: now }).where(eq(loginOtpsTable.id, record.id));

  // Find or auto-create user
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  if (!user) {
    const name = email.split("@")[0] ?? email;
    const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);
    const [created] = await db
      .insert(usersTable)
      .values({ email, name, passwordHash, role: "user", emailVerified: true, emailVerifiedAt: now })
      .returning();
    user = created!;
  } else if (!user.emailVerified) {
    // Mark pre-existing unverified user as verified via OTP
    await db.update(usersTable).set({ emailVerified: true, emailVerifiedAt: now }).where(eq(usersTable.id, user.id));
    user = { ...user, emailVerified: true, emailVerifiedAt: now };
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt.toISOString() },
  });
});

export default router;
