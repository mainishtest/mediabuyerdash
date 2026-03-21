"use server";

// app/onboarding/actions.ts
// Server actions for the onboarding wizard steps.

import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { updateOnboardingProgress, completeOnboarding } from "../../lib/onboarding";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireWorkspaceId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) throw new Error("Not authenticated");
  return workspaceId;
}

// ── Step 1: Workspace details ─────────────────────────────────────────────────

export async function saveWorkspaceDetailsAction(input: {
  name: string;
  timezone: string;
}): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  const name = input.name.trim();
  if (!name) throw new Error("Workspace name is required.");

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name, timezone: input.timezone },
  });

  await updateOnboardingProgress(workspaceId, "workspace_details", "business_profile");
}

// ── Step 2: Business profile ──────────────────────────────────────────────────

export async function saveBusinessProfileAction(input: {
  brandName: string;
  industry: string;
  website: string;
  monthlyAdSpend: string;
}): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  const brandName = input.brandName.trim();
  if (!brandName) throw new Error("Brand name is required.");

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      brandName,
      industry:       input.industry || null,
      website:        input.website.trim() || null,
      monthlyAdSpend: input.monthlyAdSpend || null,
    },
  });

  await updateOnboardingProgress(workspaceId, "business_profile", "integrations");
}

// ── Step 3: Integrations (skip-able) ──────────────────────────────────────────

export async function markIntegrationsDoneAction(): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  await updateOnboardingProgress(workspaceId, "integrations", "review");
}

// ── Step 4: Complete onboarding ───────────────────────────────────────────────

export async function completeOnboardingAction(): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  await completeOnboarding(workspaceId);
}

// ── Legacy: Create first client (preserved for compatibility) ─────────────────

export type CreateFirstClientInput = {
  name:      string;
  brandName: string;
  notes:     string;
};

export async function createFirstClientAction(
  input: CreateFirstClientInput
): Promise<{ clientId: string }> {
  const workspaceId = await requireWorkspaceId();

  const client = await prisma.clientAccount.create({
    data: {
      workspaceId,
      name:      input.name.trim(),
      brandName: input.brandName.trim() || null,
      notes:     input.notes.trim()     || null,
      status:    "active",
      currency:  "USD",
      timezone:  "America/New_York",
    },
  });

  return { clientId: client.id };
}
