// types/clientSetup.ts
// Type contracts for the first live client setup path.
// Pure types — no logic, no imports from lib.

// ── Step identifiers ──────────────────────────────────────────────────────────

export type ClientSetupStepId =
  | "create_client"
  | "connect_meta"
  | "connect_shopify"
  | "map_integrations"
  | "run_first_sync"
  | "dashboard_ready";

// ── Step status ───────────────────────────────────────────────────────────────

/** Visual and logical state of one setup step. */
export type ClientSetupStepStatus =
  | "complete"  // all completion criteria met
  | "current"   // the active next step (first incomplete with all prior done)
  | "pending";  // not yet reachable

// ── Step ─────────────────────────────────────────────────────────────────────

export interface ClientSetupStep {
  id:                ClientSetupStepId;
  label:             string;
  description:       string;
  status:            ClientSetupStepStatus;
  ctaLabel:          string;
  ctaHref:           string;   // link to the relevant page/section
  completionDetail?: string;   // shown when complete, e.g. "myshop.myshopify.com"
}

// ── Next action ───────────────────────────────────────────────────────────────

/** The single most important action surfaced to the user. */
export interface ClientSetupAction {
  label:    string;  // e.g. "Connect Meta to continue"
  ctaLabel: string;  // e.g. "Connect Meta"
  ctaHref:  string;
  stepId:   ClientSetupStepId | null;
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface ClientSetupSummary {
  clientId:       string;
  clientName:     string;
  steps:          ClientSetupStep[];
  completedCount: number;
  totalCount:     number;
  currentStepId:  ClientSetupStepId | null;
  nextAction:     ClientSetupAction;
  readinessLabel: string;  // "3/6 complete" | "Ready for sync" | "Live"
  isLive:         boolean;
  lastSyncAt:     string | null;
}
