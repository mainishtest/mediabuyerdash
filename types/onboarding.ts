// types/onboarding.ts
// Typed models for new account onboarding, readiness checks, and go-live flow.

// ── Readiness status ──────────────────────────────────────────────────────────

export type OnboardingReadinessStatus =
  | "not_started"       // no setup has begun
  | "in_progress"       // some items complete, work underway
  | "blocked"           // critical blockers present
  | "needs_review"      // all required items done, pending human sign-off
  | "ready_for_go_live" // all checks pass, no blockers
  | "live";             // account is actively operating

// ── Blockers ──────────────────────────────────────────────────────────────────

export interface OnboardingBlocker {
  id:           string;
  label:        string;
  detail?:      string;
  severity:     "critical" | "warning";
  actionLabel?: string;
  actionHref?:  string;
}

// ── Checklist ─────────────────────────────────────────────────────────────────

export type ChecklistItemStatus = "complete" | "incomplete" | "optional" | "warning";

export type ChecklistCategory =
  | "account"
  | "integration"
  | "attribution"
  | "goals"
  | "governance"
  | "sync";

export interface OnboardingChecklistItem {
  id:       string;
  label:    string;
  detail?:  string;
  status:   ChecklistItemStatus;
  required: boolean;
  category: ChecklistCategory;
}

// ── Sub-readiness shapes ──────────────────────────────────────────────────────

export interface MetaIntegrationReadiness {
  connected:        boolean;
  adAccountLinked:  boolean;
  accountCount:     number;
  connectionStatus: string | null;
}

export interface ShopifyIntegrationReadiness {
  connected:        boolean;
  domain:           string | null;
  connectionStatus: string | null;
  synced:           boolean;
  orderCount:       number;
}

export interface IntegrationReadiness {
  meta:    MetaIntegrationReadiness;
  shopify: ShopifyIntegrationReadiness;
}

export type SyncStatusLabel = "healthy" | "stale" | "failed" | "never";

export interface SyncHealthStatus {
  lastMetaSyncAt:     Date | null;
  lastShopifySyncAt:  Date | null;
  metaSyncStatus:     SyncStatusLabel;
  shopifySyncStatus:  SyncStatusLabel;
  recentErrors:       string[];
}

export interface AttributionReadiness {
  windowDays:          number;   // always 7 per product rules
  timezone:            string | null;
  timezoneConfigured:  boolean;
  windowConfigured:    boolean;  // always true — fixed at 7 days
}

export interface GoalSetupReadiness {
  hasGoals:     boolean;
  roasTarget:   number | null;
  cpaTarget:    number | null;
  maxDailySpend: number | null;
}

export interface GovernanceReadiness {
  hasAutoExecution:    boolean;
  autoExecutionEnabled: boolean;
}

// ── Go-live summary ───────────────────────────────────────────────────────────

export interface GoLiveSummary {
  clientId:            string;
  clientName:          string;
  timezone:            string;
  status:              OnboardingReadinessStatus;
  blockers:            OnboardingBlocker[];
  checklist:           OnboardingChecklistItem[];
  integration:         IntegrationReadiness;
  syncHealth:          SyncHealthStatus;
  attribution:         AttributionReadiness;
  goalSetup:           GoalSetupReadiness;
  governance:          GovernanceReadiness;
  completedCount:      number;
  totalRequiredCount:  number;
  readyForGoLive:      boolean;
}
