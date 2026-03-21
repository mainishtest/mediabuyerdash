// lib/onboarding-types.ts
// Shared types for the onboarding flow. Safe to import from client components.

export const ONBOARDING_STEPS = [
  { id: "workspace_details",  label: "Workspace",    description: "Name and timezone" },
  { id: "business_profile",   label: "Business",     description: "Brand and details" },
  { id: "integrations",       label: "Integrations", description: "Ad accounts & Shopify" },
  { id: "review",             label: "Review",       description: "Confirm setup" },
] as const;

export type OnboardingStepId = typeof ONBOARDING_STEPS[number]["id"];

export type OnboardingProgress = {
  currentStep: OnboardingStepId;
  workspaceDetailsDone: boolean;
  businessProfileDone: boolean;
  integrationsDone: boolean;
  reviewDone: boolean;
  completedAt: string | null;
};

export type SetupChecklist = {
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

export type WorkspaceProfile = {
  id: string;
  name: string;
  brandName: string | null;
  industry: string | null;
  timezone: string;
  website: string | null;
  monthlyAdSpend: string | null;
};

export type IntegrationStatus = {
  metaConnected: boolean;
  metaAccountCount: number;
  shopifyConnected: boolean;
  shopifyDomain: string | null;
  clientCount: number;
};
