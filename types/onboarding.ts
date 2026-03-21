// types/onboarding.ts
// Type contracts for the account onboarding, readiness checks, and go-live flow.
// Pure types — no logic, no imports from lib.

// ── Readiness states ────────────────────────────────────────────────────────

export type OnboardingReadinessState =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "ready_for_go_live"
  | "live";

// ── Blocker ─────────────────────────────────────────────────────────────────

export interface OnboardingBlocker {
  category:    string;       // e.g. "integration", "goals", "governance"
  message:     string;       // human-readable description
  severity:    "required" | "optional";
  actionLabel: string | null; // CTA text, e.g. "Connect Meta"
  actionHref:  string | null; // link to resolve
}

// ── Checklist item ──────────────────────────────────────────────────────────

export type ChecklistItemStatus = "complete" | "incomplete" | "blocked" | "optional";

export interface OnboardingChecklistItem {
  id:          string;
  label:       string;
  description: string;
  status:      ChecklistItemStatus;
  category:    string;
  actionLabel: string | null;
  actionHref:  string | null;
}

// ── Integration readiness ───────────────────────────────────────────────────

export interface IntegrationReadiness {
  metaConnected:    boolean;
  metaMapped:       boolean;
  shopifyConnected: boolean;
  shopifyMapped:    boolean;
  readyForSync:     boolean;
  blockers:         OnboardingBlocker[];
}

// ── Sync health status ──────────────────────────────────────────────────────

export interface SyncHealthStatus {
  hasEverSynced:      boolean;
  lastSyncSuccessful: boolean;
  lastSyncAt:         string | null;
  dataFlowing:        boolean;
  shopifyOrderCount:  number;
  blockers:           OnboardingBlocker[];
}

// ── Attribution readiness ───────────────────────────────────────────────────

export interface AttributionReadiness {
  timezoneConfigured:  boolean;
  timezone:            string | null;
  attributionWindow:   string;       // always "7 days"
  crmIsSourceOfTruth:  boolean;      // always true per product rules
  blockers:            OnboardingBlocker[];
}

// ── Goal setup readiness ────────────────────────────────────────────────────

export interface GoalSetupReadiness {
  hasClientGoals:    boolean;
  hasTargetRoas:     boolean;
  hasTargetCpa:      boolean;
  usingSystemDefaults: boolean;
  blockers:          OnboardingBlocker[];
}

// ── Governance readiness ────────────────────────────────────────────────────

export interface GovernanceReadiness {
  hasGovernanceConfig:  boolean;
  automationPaused:     boolean;
  activeStopCount:      number;
  activeOverrideCount:  number;
  blockers:             OnboardingBlocker[];
}

// ── Go-live summary ─────────────────────────────────────────────────────────

export interface GoLiveSummary {
  readinessState:     OnboardingReadinessState;
  readinessLabel:     string;
  completedChecks:    number;
  totalChecks:        number;
  requiredBlockers:   OnboardingBlocker[];
  optionalBlockers:   OnboardingBlocker[];
  canGoLive:          boolean;
  recommendedActions: OnboardingChecklistItem[];
}

// ── Onboarding account ──────────────────────────────────────────────────────

export interface OnboardingAccount {
  clientId:      string;
  clientName:    string;
  brandName:     string | null;
  timezone:      string;
  currency:      string;
  status:        string;
  createdAt:     string;

  // Readiness sections
  integration:   IntegrationReadiness;
  syncHealth:    SyncHealthStatus;
  attribution:   AttributionReadiness;
  goalSetup:     GoalSetupReadiness;
  governance:    GovernanceReadiness;

  // Aggregated
  checklist:     OnboardingChecklistItem[];
  goLive:        GoLiveSummary;
}
