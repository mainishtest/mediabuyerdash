// lib/onboarding.ts
// Server-side utility functions for the self-serve onboarding flow.
// Types are in onboarding-types.ts (safe for client imports).

import { prisma } from "./db";

// Re-export types and constants for server-side consumers
export { ONBOARDING_STEPS, VISIBLE_ONBOARDING_STEPS } from "./onboarding-types";
export type {
  OnboardingStepId,
  OnboardingProgress,
  OnboardingSession,
  OnboardingStep,
  OnboardingBlocker,
  OnboardingCompletionState,
  PostSignupRedirectState,
  AccountSetupChecklist,
  ChecklistItem,
  WorkspaceAccount,
  WorkspaceProfile,
  BusinessProfile,
  IntegrationSetupState,
  IntegrationStatus,
  AccountDefaults,
  SetupChecklist,
} from "./onboarding-types";

import type {
  OnboardingStepId,
  OnboardingProgress,
  OnboardingSession,
  OnboardingBlocker,
  OnboardingCompletionState,
  PostSignupRedirectState,
  AccountSetupChecklist,
  ChecklistItem,
  WorkspaceAccount,
  IntegrationSetupState,
} from "./onboarding-types";

// ── Workspace creation ────────────────────────────────────────────────────────

/** Create a workspace for a user. Idempotent — returns existing if found. */
export async function createWorkspaceForUser(
  userId: string,
  workspaceName: string,
): Promise<{ workspaceId: string; alreadyExisted: boolean }> {
  // Check for existing membership
  const existing = await prisma.workspaceMembership.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });

  if (existing) {
    return { workspaceId: existing.workspaceId, alreadyExisted: true };
  }

  const workspace = await prisma.workspace.create({
    data: { name: workspaceName },
  });

  await prisma.workspaceMembership.create({
    data: { userId, workspaceId: workspace.id, role: "owner" },
  });

  return { workspaceId: workspace.id, alreadyExisted: false };
}

// ── Onboarding session ────────────────────────────────────────────────────────

const STALE_THRESHOLD_DAYS = 7;

/** Initialize or resume an onboarding session. Idempotent. */
export async function initializeOnboardingSession(workspaceId: string): Promise<OnboardingProgress> {
  const state = await prisma.onboardingState.upsert({
    where: { workspaceId },
    create: { workspaceId, lastActiveAt: new Date() },
    update: { lastActiveAt: new Date() },
  });

  let draftFormData: Record<string, string> | null = null;
  if (state.draftFormData) {
    try {
      draftFormData = JSON.parse(state.draftFormData);
    } catch {
      draftFormData = null;
    }
  }

  return {
    currentStep: state.currentStep as OnboardingStepId,
    createWorkspaceDone: state.createWorkspaceDone,
    businessDetailsDone: state.businessDetailsDone,
    accountDefaultsDone: state.accountDefaultsDone,
    connectMetaPlaceholderDone: state.connectMetaPlaceholderDone,
    connectShopifyPlaceholderDone: state.connectShopifyPlaceholderDone,
    reviewSetupDone: state.reviewSetupDone,
    completedAt: state.completedAt?.toISOString() ?? null,
    lastActiveAt: state.lastActiveAt.toISOString(),
    draftFormData,
  };
}

/** Update onboarding progress for a given step. */
export async function updateOnboardingProgress(
  workspaceId: string,
  step: OnboardingStepId,
  nextStep?: OnboardingStepId,
): Promise<OnboardingProgress> {
  const doneField = stepToDoneField(step);
  const data: Record<string, unknown> = {
    [doneField]: true,
    lastActiveAt: new Date(),
    draftFormData: null, // Clear draft on step completion
  };
  if (nextStep) data.currentStep = nextStep;

  const state = await prisma.onboardingState.update({
    where: { workspaceId },
    data,
  });

  return mapStateToProgress(state);
}

/** Save partial form data for later resume. */
export async function saveDraftFormData(
  workspaceId: string,
  formData: Record<string, string>,
): Promise<void> {
  await prisma.onboardingState.update({
    where: { workspaceId },
    data: {
      draftFormData: JSON.stringify(formData),
      lastActiveAt: new Date(),
    },
  });
}

/** Mark onboarding as complete. */
export async function completeOnboarding(workspaceId: string): Promise<void> {
  await prisma.onboardingState.update({
    where: { workspaceId },
    data: {
      currentStep: "onboarding_complete",
      reviewSetupDone: true,
      completedAt: new Date(),
      lastActiveAt: new Date(),
      draftFormData: null,
    },
  });
}

// ── Workspace profile ─────────────────────────────────────────────────────────

export async function getWorkspaceAccount(workspaceId: string): Promise<WorkspaceAccount> {
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
      createdAt: true,
    },
  });
  return {
    ...ws,
    createdAt: ws.createdAt.toISOString(),
  };
}

// ── Integration status ────────────────────────────────────────────────────────

export async function getIntegrationSetupState(workspaceId: string): Promise<IntegrationSetupState> {
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
    meta: {
      connected: metaAccounts > 0,
      accountCount: metaAccounts,
      placeholder: true, // Full OAuth flow exists but is a placeholder in onboarding
    },
    shopify: {
      connected: !!shopifyConn,
      shopDomain: shopifyConn?.shopDomain ?? null,
      placeholder: true,
    },
    clientCount,
  };
}

// ── Setup checklist ───────────────────────────────────────────────────────────

export async function buildAccountSetupChecklist(workspaceId: string): Promise<AccountSetupChecklist> {
  const [ws, integrations] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, brandName: true, timezone: true },
    }),
    getIntegrationSetupState(workspaceId),
  ]);

  const items: ChecklistItem[] = [
    {
      id: "workspace",
      label: "Workspace created",
      description: "Your workspace is set up",
      done: true,
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
      done: integrations.meta.connected,
      actionLabel: "Connect Meta",
      actionHref: "/integrations/meta",
    },
    {
      id: "shopify_connected",
      label: "Shopify connected",
      description: "Connect your Shopify store for CRM revenue",
      done: integrations.shopify.connected,
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

// ── Completion state ──────────────────────────────────────────────────────────

export async function computeOnboardingCompletionState(
  workspaceId: string,
): Promise<OnboardingCompletionState> {
  const [state, checklist] = await Promise.all([
    prisma.onboardingState.findUnique({ where: { workspaceId } }),
    buildAccountSetupChecklist(workspaceId),
  ]);

  const isComplete = !!state?.completedAt;

  // Count completed onboarding steps (excluding terminal "onboarding_complete")
  const stepFields = [
    state?.createWorkspaceDone,
    state?.businessDetailsDone,
    state?.accountDefaultsDone,
    state?.connectMetaPlaceholderDone,
    state?.connectShopifyPlaceholderDone,
    state?.reviewSetupDone,
  ];
  const stepsCompleted = stepFields.filter(Boolean).length;

  const pendingItems = checklist.items
    .filter((i) => !i.done)
    .map((i) => i.label);

  const nextAction = isComplete
    ? { label: "Go to Dashboard", href: "/home" }
    : { label: "Continue Setup", href: "/onboarding" };

  return {
    isComplete,
    completedAt: state?.completedAt?.toISOString() ?? null,
    stepsCompleted,
    stepsTotal: 6,
    pendingItems,
    nextAction,
  };
}

// ── Next steps summary ────────────────────────────────────────────────────────

export async function summarizeOnboardingNextSteps(
  workspaceId: string,
): Promise<{ steps: Array<{ label: string; href: string; priority: "required" | "recommended" | "optional" }> }> {
  const [completion, integrations] = await Promise.all([
    computeOnboardingCompletionState(workspaceId),
    getIntegrationSetupState(workspaceId),
  ]);

  const steps: Array<{ label: string; href: string; priority: "required" | "recommended" | "optional" }> = [];

  if (!completion.isComplete) {
    steps.push({
      label: "Complete onboarding setup",
      href: "/onboarding",
      priority: "required",
    });
  }

  if (integrations.clientCount === 0) {
    steps.push({
      label: "Create your first client",
      href: "/clients",
      priority: "required",
    });
  }

  if (!integrations.meta.connected) {
    steps.push({
      label: "Connect Meta Ads",
      href: "/integrations/meta",
      priority: "recommended",
    });
  }

  if (!integrations.shopify.connected) {
    steps.push({
      label: "Connect Shopify",
      href: "/integrations/shopify",
      priority: "recommended",
    });
  }

  return { steps };
}

// ── Blockers ──────────────────────────────────────────────────────────────────

export async function getOnboardingBlockers(
  workspaceId: string,
): Promise<OnboardingBlocker[]> {
  const blockers: OnboardingBlocker[] = [];

  // Check for stale session
  const state = await prisma.onboardingState.findUnique({
    where: { workspaceId },
    select: { lastActiveAt: true, completedAt: true },
  });

  if (state && !state.completedAt) {
    const daysSinceActive = (Date.now() - state.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActive > STALE_THRESHOLD_DAYS) {
      blockers.push({
        id: "stale_session",
        type: "stale_session",
        message: `Your setup has been inactive for ${Math.floor(daysSinceActive)} days. Pick up where you left off.`,
        actionLabel: "Resume Setup",
        actionHref: "/onboarding",
      });
    }
  }

  // Check for workspace existence
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });

  if (!workspace) {
    blockers.push({
      id: "workspace_error",
      type: "workspace_error",
      message: "Your workspace could not be found. Please contact support.",
    });
  }

  // Billing/trial placeholder — will be implemented with Stripe
  // For now, no billing blocker since trial is not yet charged.

  return blockers;
}

// ── Post-signup redirect ──────────────────────────────────────────────────────

export async function computePostSignupRedirect(
  workspaceId: string,
): Promise<PostSignupRedirectState> {
  const state = await prisma.onboardingState.findUnique({
    where: { workspaceId },
    select: { currentStep: true, completedAt: true },
  });

  if (!state) {
    return {
      shouldOnboard: true,
      onboardingStep: "create_workspace",
      redirectTo: "/onboarding",
      reason: "new_user",
    };
  }

  if (state.completedAt) {
    return {
      shouldOnboard: false,
      onboardingStep: null,
      redirectTo: "/home",
      reason: "complete",
    };
  }

  return {
    shouldOnboard: true,
    onboardingStep: state.currentStep as OnboardingStepId,
    redirectTo: "/onboarding",
    reason: "incomplete_onboarding",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepToDoneField(step: OnboardingStepId): string {
  const map: Record<string, string> = {
    create_workspace: "createWorkspaceDone",
    business_details: "businessDetailsDone",
    account_defaults: "accountDefaultsDone",
    connect_meta_placeholder: "connectMetaPlaceholderDone",
    connect_shopify_placeholder: "connectShopifyPlaceholderDone",
    review_setup: "reviewSetupDone",
    onboarding_complete: "reviewSetupDone",
  };
  return map[step] ?? "reviewSetupDone";
}

function mapStateToProgress(state: {
  currentStep: string;
  createWorkspaceDone: boolean;
  businessDetailsDone: boolean;
  accountDefaultsDone: boolean;
  connectMetaPlaceholderDone: boolean;
  connectShopifyPlaceholderDone: boolean;
  reviewSetupDone: boolean;
  completedAt: Date | null;
  lastActiveAt: Date;
  draftFormData: string | null;
}): OnboardingProgress {
  let draftFormData: Record<string, string> | null = null;
  if (state.draftFormData) {
    try { draftFormData = JSON.parse(state.draftFormData); } catch { draftFormData = null; }
  }

  return {
    currentStep: state.currentStep as OnboardingStepId,
    createWorkspaceDone: state.createWorkspaceDone,
    businessDetailsDone: state.businessDetailsDone,
    accountDefaultsDone: state.accountDefaultsDone,
    connectMetaPlaceholderDone: state.connectMetaPlaceholderDone,
    connectShopifyPlaceholderDone: state.connectShopifyPlaceholderDone,
    reviewSetupDone: state.reviewSetupDone,
    completedAt: state.completedAt?.toISOString() ?? null,
    lastActiveAt: state.lastActiveAt.toISOString(),
    draftFormData,
  };
}
