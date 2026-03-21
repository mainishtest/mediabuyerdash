// lib/onboarding.ts
// Server-side utility functions for the self-serve onboarding flow.
// Types are in onboarding-types.ts (safe for client imports).

import { prisma } from "./db";

// Re-export types and constants for server-side consumers
export { ONBOARDING_STEPS } from "./onboarding-types";
export type {
  OnboardingStepId,
  OnboardingProgress,
  SetupChecklist,
  ChecklistItem,
  WorkspaceProfile,
  IntegrationStatus,
} from "./onboarding-types";

import type { OnboardingStepId, OnboardingProgress, ChecklistItem, SetupChecklist, WorkspaceProfile, IntegrationStatus } from "./onboarding-types";

// ── Initialization ────────────────────────────────────────────────────────────

/** Ensure an OnboardingState exists for the workspace, creating if needed. */
export async function initializeOnboardingState(workspaceId: string): Promise<OnboardingProgress> {
  const state = await prisma.onboardingState.upsert({
    where: { workspaceId },
    create: { workspaceId },
    update: {},
  });

  return {
    currentStep: state.currentStep as OnboardingStepId,
    workspaceDetailsDone: state.workspaceDetailsDone,
    businessProfileDone: state.businessProfileDone,
    integrationsDone: state.integrationsDone,
    reviewDone: state.reviewDone,
    completedAt: state.completedAt?.toISOString() ?? null,
  };
}

/** Update onboarding progress for a given step. */
export async function updateOnboardingProgress(
  workspaceId: string,
  step: OnboardingStepId,
  nextStep?: OnboardingStepId,
): Promise<OnboardingProgress> {
  const doneField = stepToDoneField(step);
  const data: Record<string, unknown> = { [doneField]: true };
  if (nextStep) data.currentStep = nextStep;

  const state = await prisma.onboardingState.update({
    where: { workspaceId },
    data,
  });

  return {
    currentStep: state.currentStep as OnboardingStepId,
    workspaceDetailsDone: state.workspaceDetailsDone,
    businessProfileDone: state.businessProfileDone,
    integrationsDone: state.integrationsDone,
    reviewDone: state.reviewDone,
    completedAt: state.completedAt?.toISOString() ?? null,
  };
}

/** Mark onboarding as complete. */
export async function completeOnboarding(workspaceId: string): Promise<void> {
  await prisma.onboardingState.update({
    where: { workspaceId },
    data: {
      currentStep: "complete",
      reviewDone: true,
      completedAt: new Date(),
    },
  });
}

// ── Workspace profile ─────────────────────────────────────────────────────────

export async function getWorkspaceProfile(workspaceId: string): Promise<WorkspaceProfile> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      brandName: true,
      industry: true,
      timezone: true,
      website: true,
      monthlyAdSpend: true,
    },
  });
  return ws;
}

// ── Integration status ────────────────────────────────────────────────────────

export async function getIntegrationStatus(workspaceId: string): Promise<IntegrationStatus> {
  const [metaAccounts, shopifyConn, clientCount] = await Promise.all([
    prisma.metaSelectedAdAccount.count({
      where: { clientAccount: { workspaceId } },
    }),
    prisma.shopifyConnection.findFirst({
      where: { workspaceId },
      select: { shopDomain: true },
    }),
    prisma.clientAccount.count({ where: { workspaceId } }),
  ]);

  return {
    metaConnected: metaAccounts > 0,
    metaAccountCount: metaAccounts,
    shopifyConnected: !!shopifyConn,
    shopifyDomain: shopifyConn?.shopDomain ?? null,
    clientCount,
  };
}

// ── Setup checklist ───────────────────────────────────────────────────────────

export async function buildSetupChecklist(workspaceId: string): Promise<SetupChecklist> {
  const [ws, integrations, onboarding] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, brandName: true, timezone: true },
    }),
    getIntegrationStatus(workspaceId),
    prisma.onboardingState.findUnique({ where: { workspaceId } }),
  ]);

  const items: ChecklistItem[] = [
    {
      id: "workspace",
      label: "Workspace created",
      description: "Your workspace is set up",
      done: true, // Always true if we got here
    },
    {
      id: "business_details",
      label: "Business details added",
      description: "Brand name and timezone configured",
      done: !!(ws?.brandName && ws?.timezone),
    },
    {
      id: "first_client",
      label: "First client created",
      description: "Add a client to manage their accounts",
      done: integrations.clientCount > 0,
      actionLabel: "Add Client",
      actionHref: "/clients",
    },
    {
      id: "meta_connected",
      label: "Meta Ads connected",
      description: "Connect your Meta ad accounts",
      done: integrations.metaConnected,
      actionLabel: "Connect Meta",
      actionHref: "/integrations/meta",
    },
    {
      id: "shopify_connected",
      label: "Shopify connected",
      description: "Connect your Shopify store for CRM revenue",
      done: integrations.shopifyConnected,
      actionLabel: "Connect Shopify",
      actionHref: "/integrations/shopify",
    },
  ];

  const completedCount = items.filter((i) => i.done).length;

  return {
    items,
    completedCount,
    totalCount: items.length,
    isComplete: completedCount === items.length,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepToDoneField(step: OnboardingStepId): string {
  const map: Record<OnboardingStepId, string> = {
    workspace_details: "workspaceDetailsDone",
    business_profile: "businessProfileDone",
    integrations: "integrationsDone",
    review: "reviewDone",
  };
  return map[step];
}
