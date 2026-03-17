"use server";

import crypto       from "crypto";
import { prisma }   from "../../lib/db";
import { sendEmail } from "../../lib/email";

export interface RequestResetResult {
  success: boolean;
  /** Populated in dev when SMTP is not configured — show the link in the UI. */
  devUrl?: string;
  error?:  string;
}

export async function requestPasswordResetAction(
  email: string
): Promise<RequestResetResult> {
  const normalised = email.trim().toLowerCase();

  if (!normalised || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, email: true, passwordHash: true },
  });

  // Always respond with success so we don't reveal whether the email exists.
  if (!user || !user.passwordHash) {
    return { success: true };
  }

  // Invalidate any existing unused tokens for this user.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  // Create a fresh token — 64 hex chars, expires in 1 hour.
  const token     = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const baseUrl  = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const result = await sendEmail({
    to:      user.email,
    subject: "Reset your password — Media Buying OS",
    text:    resetUrl,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111;margin-bottom:8px">Reset your password</h2>
        <p style="color:#555;margin-bottom:24px">
          Click the link below to set a new password. The link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#059669;color:#fff;text-decoration:none;
                  border-radius:8px;padding:12px 24px;font-weight:600;font-size:14px">
          Reset password
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (!result.sent && result.devUrl) {
    return { success: true, devUrl: result.devUrl };
  }

  return { success: true };
}
