"use server";

// app/onboarding/actions.ts
// Server actions for the 7-step onboarding wizard.

import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { updateOnboardingProgress, completeOnboarding, saveDraftFormData } from "../../lib/onboarding";
import type { AccountDefaults } from "../../lib/onboarding-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireWorkspaceId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId;
  if (!workspaceId) throw new Error("Not authenticated");
  return workspaceId;
}

// ── Step 1: Create workspace (workspace name + timezone) ──────────────────────

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

  await updateOnboardingProgress(workspaceId, "create_workspace", "business_details");
}

// ── Step 2: Business details ──────────────────────────────────────────────────

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

  await updateOnboardingProgress(workspaceId, "business_details", "account_defaults");
}

// ── Step 3: Account defaults ──────────────────────────────────────────────────

export async function saveAccountDefaultsAction(input: AccountDefaults): Promise<void> {
  const workspaceId = await requireWorkspaceId();

  // Store defaults on workspace. Currency and reporting window are workspace-level preferences.
  // For now we store timezone (already set) and update it if changed.
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      timezone: input.defaultTimezone,
    },
  });

  await updateOnboardingProgress(workspaceId, "account_defaults", "connect_meta_placeholder");
}

// ── Step 4: Connect Meta placeholder ──────────────────────────────────────────

export async function markConnectMetaDoneAction(): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  await updateOnboardingProgress(workspaceId, "connect_meta_placeholder", "connect_shopify_placeholder");
}

// ── Step 5: Connect Shopify placeholder ───────────────────────────────────────

export async function markConnectShopifyDoneAction(): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  await updateOnboardingProgress(workspaceId, "connect_shopify_placeholder", "review_setup");
}

// ── Step 6: Complete onboarding ───────────────────────────────────────────────

export async function completeOnboardingAction(): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  await completeOnboarding(workspaceId);
}

// ── Draft form persistence ────────────────────────────────────────────────────

export async function saveDraftAction(formData: Record<string, string>): Promise<void> {
  const workspaceId = await requireWorkspaceId();
  await saveDraftFormData(workspaceId, formData);
}

// ── Legacy: Create first client (preserved for backward compatibility) ────────

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
