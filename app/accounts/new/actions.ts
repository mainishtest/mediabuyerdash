"use server";

// app/accounts/new/actions.ts
// Server actions for the onboarding readiness flow.

import { getServerSession }      from "next-auth";
import { authOptions }           from "../../../lib/auth";
import { prisma }                from "../../../lib/db";
import { fetchOnboardingAccount } from "../../../lib/onboarding/data";
import type { OnboardingAccount } from "../../../types/onboarding";

// ── Create a new account ────────────────────────────────────────────────────

export type CreateAccountInput = {
  name:      string;
  brandName: string;
  timezone:  string;
  currency:  string;
  notes:     string;
};

export async function createAccountAction(
  input: CreateAccountInput,
): Promise<{ clientId: string }> {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) throw new Error("Not authenticated");

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("Account name is required.");

  const client = await prisma.clientAccount.create({
    data: {
      workspaceId,
      name:      trimmedName,
      brandName: input.brandName.trim() || null,
      timezone:  input.timezone || "America/New_York",
      currency:  input.currency || "USD",
      notes:     input.notes.trim() || null,
      status:    "active",
    },
  });

  return { clientId: client.id };
}

// ── Refresh readiness for a specific account ────────────────────────────────

export async function refreshReadinessAction(
  clientId: string,
): Promise<OnboardingAccount | null> {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) throw new Error("Not authenticated");

  return fetchOnboardingAccount(clientId, workspaceId);
}
