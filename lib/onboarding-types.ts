// lib/onboarding-types.ts
// Shared types for the onboarding flow. Safe to import from client components.
// All typed models referenced by the spec are defined here.

// ── Step definitions ──────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  { id: "create_workspace",            label: "Workspace",   description: "Name and timezone" },
  { id: "business_details",            label: "Business",    description: "Brand and details" },
  { id: "account_defaults",            label: "Defaults",    description: "Currency and preferences" },
  { id: "connect_meta_placeholder",    label: "Meta Ads",    description: "Connect ad accounts" },
  { id: "connect_shopify_placeholder", label: "Shopify",     description: "Connect revenue data" },
  { id: "review_setup",                label: "Review",      description: "Confirm and launch" },
  { id: "onboarding_complete",         label: "Complete",    description: "Setup finished" },
] as const;

export type OnboardingStepId = typeof ONBOARDING_STEPS[number]["id"];

/** Visible wizard steps (excludes the terminal "onboarding_complete" step). */
export const VISIBLE_ONBOARDING_STEPS = ONBOARDING_STEPS.filter(
  (s) => s.id !== "onboarding_complete"
);

// ── WorkspaceAccount ──────────────────────────────────────────────────────────
// Represents the workspace entity with its business profile fields.

export type WorkspaceAccount = {
  id: string;
  name: string;
  brandName: string | null;
  industry: string | null;
  timezone: string;
  website: string | null;
  monthlyAdSpend: string | null;
  createdAt: string;
};

// ── OnboardingSession ─────────────────────────────────────────────────────────
// Tracks the overall onboarding session for a workspace.

export type OnboardingSession = {
  id: string;
  workspaceId: string;
  currentStep: OnboardingStepId;
  completedAt: string | null;
  lastActiveAt: string;
  createdAt: string;
  isStale: boolean; // true if lastActiveAt is >7 days ago
};

// ── OnboardingStep ────────────────────────────────────────────────────────────
// Metadata about a single step in the onboarding flow.

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  description: string;
  done: boolean;
  active: boolean;
  skippable: boolean;
};

// ── OnboardingProgress ────────────────────────────────────────────────────────
// Full progress state across all steps.

export type OnboardingProgress = {
  currentStep: OnboardingStepId;
  createWorkspaceDone: boolean;
  businessDetailsDone: boolean;
  accountDefaultsDone: boolean;
  connectMetaPlaceholderDone: boolean;
  connectShopifyPlaceholderDone: boolean;
  reviewSetupDone: boolean;
  completedAt: string | null;
  lastActiveAt: string;
  draftFormData: Record<string, string> | null;
};

// ── BusinessProfile ───────────────────────────────────────────────────────────
// Collected during the business_details step.

export type BusinessProfile = {
  brandName: string;
  industry: string;
  website: string;
  monthlyAdSpend: string;
};

// ── IntegrationSetupState ─────────────────────────────────────────────────────
// Status of each integration connection.

export type IntegrationSetupState = {
  meta: {
    connected: boolean;
    accountCount: number;
    placeholder: boolean; // true = not yet fully implemented
  };
  shopify: {
    connected: boolean;
    shopDomain: string | null;
    placeholder: boolean;
  };
  clientCount: number;
};

// ── AccountSetupChecklist ─────────────────────────────────────────────────────
// The post-onboarding checklist shown during review and on dashboard.

export type AccountSetupChecklist = {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
};

export type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  actionLabel?: string;
  actionHref?: string;
};

// ── OnboardingBlocker ─────────────────────────────────────────────────────────
// A condition that blocks onboarding progress.

export type OnboardingBlocker = {
  id: string;
  type: "missing_billing" | "expired_trial" | "workspace_error" | "stale_session";
  message: string;
  actionLabel?: string;
  actionHref?: string;
};

// ── OnboardingCompletionState ─────────────────────────────────────────────────
// Summary of what was completed and what remains.

export type OnboardingCompletionState = {
  isComplete: boolean;
  completedAt: string | null;
  stepsCompleted: number;
  stepsTotal: number;
  pendingItems: string[];
  nextAction: {
    label: string;
    href: string;
  };
};

// ── PostSignupRedirectState ───────────────────────────────────────────────────
// Used to determine where to send a user after signup/login.

export type PostSignupRedirectState = {
  shouldOnboard: boolean;
  onboardingStep: OnboardingStepId | null;
  redirectTo: string; // "/onboarding" or "/home"
  reason: "new_user" | "incomplete_onboarding" | "complete";
};

// ── Account defaults ──────────────────────────────────────────────────────────
// Workspace-level defaults set during onboarding.

export type AccountDefaults = {
  defaultCurrency: string;
  defaultTimezone: string;
  reportingWindow: string; // "7d" | "14d" | "30d"
};

// ── Legacy aliases (backward compatibility) ───────────────────────────────────

/** @deprecated Use WorkspaceAccount */
export type WorkspaceProfile = WorkspaceAccount;

/** @deprecated Use AccountSetupChecklist */
export type SetupChecklist = AccountSetupChecklist;

/** @deprecated Use IntegrationSetupState */
export type IntegrationStatus = {
  metaConnected: boolean;
  metaAccountCount: number;
  shopifyConnected: boolean;
  shopifyDomain: string | null;
  clientCount: number;
};
