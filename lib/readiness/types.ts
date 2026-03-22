// lib/readiness/types.ts
// Typed models for account readiness validation and go-live dashboard.
// Client-safe — no server imports.

// ── Readiness states ──────────────────────────────────────────────────────────

export type ReadinessState =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "ready_for_go_live"
  | "live";

// ── Categories ────────────────────────────────────────────────────────────────

export type ReadinessCategory =
  | "workspace_setup"
  | "meta_connection"
  | "shopify_connection"
  | "sync_health"
  | "timezone_configuration"
  | "goals_configuration"
  | "governance_defaults"
  | "client_setup";

export const READINESS_CATEGORIES: Array<{
  id: ReadinessCategory;
  label: string;
  required: boolean;
}> = [
  { id: "workspace_setup",         label: "Workspace Setup",        required: true },
  { id: "meta_connection",         label: "Meta Ads Connection",    required: true },
  { id: "shopify_connection",      label: "Shopify Connection",     required: true },
  { id: "sync_health",             label: "Data Sync Health",       required: true },
  { id: "timezone_configuration",  label: "Timezone",               required: true },
  { id: "goals_configuration",     label: "Performance Goals",      required: false },
  { id: "governance_defaults",     label: "Governance & Safety",    required: false },
  { id: "client_setup",            label: "Client Accounts",        required: true },
];

// ── AccountReadinessCheck ─────────────────────────────────────────────────────

export type AccountReadinessCheck = {
  id: string;
  category: ReadinessCategory;
  label: string;
  description: string;
  status: "pass" | "fail" | "warning" | "skipped";
  required: boolean;
  actionLabel?: string;
  actionHref?: string;
};

// ── AccountReadinessBlocker ───────────────────────────────────────────────────

export type AccountReadinessBlocker = {
  id: string;
  category: ReadinessCategory;
  message: string;
  severity: "critical" | "warning";
  actionLabel: string;
  actionHref: string;
};

// ── GoLiveStatus ──────────────────────────────────────────────────────────────

export type GoLiveStatus = {
  state: ReadinessState;
  readyToOperate: boolean;
  requiredPassCount: number;
  requiredTotalCount: number;
  optionalPassCount: number;
  optionalTotalCount: number;
  message: string;
};

// ── GoLiveRecommendation ──────────────────────────────────────────────────────

export type GoLiveRecommendation = {
  priority: "required" | "recommended" | "optional";
  label: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

// ── IntegrationReadinessState ─────────────────────────────────────────────────

export type IntegrationReadinessState = {
  metaConnected: boolean;
  metaAccountsSelected: boolean;
  metaSyncHealthy: boolean;
  shopifyConnected: boolean;
  shopifySyncHealthy: boolean;
  shopifyHasOrders: boolean;
};

// ── ConfigurationReadinessState ───────────────────────────────────────────────

export type ConfigurationReadinessState = {
  timezoneConfigured: boolean;
  goalsConfigured: boolean;
  governanceConfigured: boolean;
  clientsExist: boolean;
  onboardingComplete: boolean;
};

// ── AccountReadinessSummary ───────────────────────────────────────────────────

export type AccountReadinessSummary = {
  checks: AccountReadinessCheck[];
  blockers: AccountReadinessBlocker[];
  goLiveStatus: GoLiveStatus;
  recommendations: GoLiveRecommendation[];
  integrationState: IntegrationReadinessState;
  configurationState: ConfigurationReadinessState;
};
