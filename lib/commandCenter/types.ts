// ─── Command Center — Typed Models ───────────────────────────────────────────
//
// All types used across the Command Center aggregation layer and UI.
// No business logic lives here — keep this file pure type definitions.

// ── Priority ──────────────────────────────────────────────────────────────────

export type CommandCenterPriority = "critical" | "high" | "medium" | "low";

// ── Filter state (URL-driven) ─────────────────────────────────────────────────

export type CommandCenterFilterState = {
  clientId?: string;
  dateFrom: string;
  dateTo: string;
  priority?: CommandCenterPriority;
};

// ── Top-level KPI summary ─────────────────────────────────────────────────────

export type CommandCenterSummary = {
  generatedAt: string;
  dateRange: { from: string; to: string };
  totalSpend: number;
  totalRevenue: number;
  overallRoas: number | null;
  overallCpa: number | null;
  totalOrders: number;
  activeClientsCount: number;
  activeExperimentsCount: number;
  pendingApprovalsCount: number;
  highPriorityCreativeIssues: number;
  pacingRisksCount: number;
  unresolvedAlertsCount: number;
};

// ── Priority card (unified queue item) ───────────────────────────────────────

export type CommandCenterCardType =
  | "alert"
  | "approval"
  | "experiment"
  | "creative"
  | "pacing"
  | "blocker";

export type CommandCenterPriorityCard = {
  id: string;
  type: CommandCenterCardType;
  priority: CommandCenterPriority;
  title: string;
  subtitle: string;
  href: string;
  clientName?: string;
};

// ── Alert item ────────────────────────────────────────────────────────────────

export type CommandCenterAlertItem = {
  id: string;
  alertType: string;
  severity: "low" | "medium" | "high";
  title: string;
  body: string;
  clientId: string;
  clientName: string;
  entityName: string;
  isAcknowledged: boolean;
  detectedAt: string;
  href: string;
};

// ── Approval item ─────────────────────────────────────────────────────────────

export type CommandCenterApprovalItem = {
  id: string;
  actionType: string;
  title: string;
  rationale: string;
  clientId: string;
  clientName: string;
  entityName: string;
  priority: CommandCenterPriority;
  proposedAt: string;
  href: string;
};

// ── Experiment item ───────────────────────────────────────────────────────────

export type CommandCenterExperimentItem = {
  id: string;
  name: string;
  status: string;
  outcome: string | null;
  winningVariant: string | null;
  recommendedAction: string | null;
  clientId: string;
  daysRunning: number;
  hasResult: boolean;
  href: string;
};

// ── Creative / publish-prep item ──────────────────────────────────────────────

export type CommandCenterCreativeDirection =
  | "ready_to_publish"
  | "awaiting_review"
  | "in_progress";

export type CommandCenterCreativeItem = {
  id: string;
  title: string;
  variantType: string;
  briefIntent: string;
  direction: CommandCenterCreativeDirection;
  clientId: string;
  clientName: string;
  campaignName: string | null;
  status: string;
  href: string;
};

// ── Pacing item ───────────────────────────────────────────────────────────────

export type CommandCenterPacingStatus = "under_pacing" | "over_pacing" | "on_pacing";

export type CommandCenterPacingItem = {
  id: string;
  clientId: string;
  clientName: string;
  monthlyBudget: number;
  currency: string;
  spendSoFar: number;
  expectedSpend: number;
  pacingPct: number;
  status: CommandCenterPacingStatus;
  href: string;
};

// ── Full payload (server → client) ────────────────────────────────────────────

// ── Outcome highlight item ───────────────────────────────────────────────────

export type CommandCenterOutcomeHighlightType =
  | "winner"
  | "loser"
  | "scale_opportunity"
  | "refresh_needed"
  | "retest_needed"
  | "monitoring";

export type CommandCenterOutcomeItem = {
  id:              string;
  type:            CommandCenterOutcomeHighlightType;
  title:           string;
  subtitle:        string;
  routeType:       string;
  readinessState:  string;
  nextActionLabel: string;
  linkedWorkflow:  string | null;
  isBlocker:       boolean;
  href:            string;
  clientAccountId: string;
};

export type CommandCenterOutcomeSummary = {
  winnersCount:       number;
  losersCount:        number;
  scaleReadyCount:    number;
  refreshNeededCount: number;
  retestNeededCount:  number;
  monitoringCount:    number;
  pendingActionCount: number;
};

export type CommandCenterPayload = {
  summary: CommandCenterSummary;
  priorities: CommandCenterPriorityCard[];
  approvals: CommandCenterApprovalItem[];
  experiments: CommandCenterExperimentItem[];
  creativeItems: CommandCenterCreativeItem[];
  pacingItems: CommandCenterPacingItem[];
  alertItems: CommandCenterAlertItem[];
  outcomeItems: CommandCenterOutcomeItem[];
  outcomeSummary: CommandCenterOutcomeSummary;
  clients: { id: string; name: string }[];
};
