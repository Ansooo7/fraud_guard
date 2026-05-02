import { logger } from "./logger";

export type MagicLinkEmailOptions = {
  toEmail: string;
  toName: string;
  verifyUrl: string;
};

/**
 * Sends a verification magic-link email.
 *
 * Currently logs the link to the console so the system is fully functional
 * in development. Replace the body of this function with a real email provider
 * (Resend, SendGrid, Nodemailer, etc.) when you have credentials.
 *
 * Example with Resend:
 *   const resend = new Resend(process.env.RESEND_API_KEY);
 *   await resend.emails.send({ from: "FraudGuard <no-reply@yourdomain.com>",
 *     to: toEmail, subject, html });
 */
export async function sendVerificationEmail({ toEmail, toName, verifyUrl }: MagicLinkEmailOptions): Promise<void> {
  // ─── REPLACE THIS BLOCK WITH YOUR EMAIL PROVIDER ────────────────────────────
  logger.info(
    { to: toEmail, verifyUrl },
    "📧  [EMAIL STUB] Verification email — copy the link below to verify the account:"
  );
  logger.info(`\n\n  ✅  VERIFY URL: ${verifyUrl}\n`);
  // ────────────────────────────────────────────────────────────────────────────
}
