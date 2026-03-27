"use server";

import bcrypt     from "bcryptjs";
import { prisma } from "../../lib/db";

export interface ChangePasswordResult {
  success?: boolean;
  error?:   string;
}

export async function changePasswordAction(
  userId:          string,
  currentPassword: string,
  newPassword:     string
): Promise<ChangePasswordResult> {
  if (!userId) return { error: "Not authenticated." };

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return { error: "User not found." };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordHash: hash },
  });

  return { success: true };
}
