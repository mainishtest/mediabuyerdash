"use server";

import bcrypt       from "bcryptjs";
import { prisma }   from "../../lib/db";

export interface ResetPasswordResult {
  success?: boolean;
  error?:   string;
}

export async function resetPasswordAction(
  token:       string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!token) {
    return { error: "Invalid or missing reset token." };
  }

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where:   { token },
    include: { user: true },
  });

  if (!record) {
    return { error: "Reset link is invalid or has already been used." };
  }

  if (record.usedAt) {
    return { error: "This reset link has already been used. Request a new one." };
  }

  if (record.expiresAt < new Date()) {
    return { error: "This reset link has expired. Please request a new one." };
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data:  { passwordHash: hash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
