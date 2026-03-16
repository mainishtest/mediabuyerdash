"use server";

// app/register/actions.ts
// Server action for user registration.
// Creates the user record, a default workspace, and the owner membership.
// Session issuance happens client-side via signIn() after this returns success.

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export type RegisterResult =
  | { success: true }
  | { success: false; error: string };

export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<RegisterResult> {
  const normalizedEmail = email.toLowerCase().trim();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  // Check for existing account.
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return {
      success: false,
      error: "An account with this email already exists. Sign in instead.",
    };
  }

  const hash = await bcrypt.hash(password, 12);
  const trimmedName = name?.trim() || null;

  const user = await prisma.user.create({
    data: { email: normalizedEmail, passwordHash: hash, name: trimmedName },
  });

  // Create a default workspace and make the user its owner.
  const workspaceName = trimmedName ? `${trimmedName}'s Workspace` : "My Workspace";
  const workspace = await prisma.workspace.create({
    data: { name: workspaceName },
  });

  await prisma.workspaceMembership.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "owner" },
  });

  return { success: true };
}
