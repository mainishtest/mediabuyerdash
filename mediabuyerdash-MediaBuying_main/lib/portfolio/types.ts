// ─── Portfolio Command Center — Typed Models ──────────────────────────────────
//
// All types used by the portfolio aggregation layer and UI.
// No business logic lives here — pure type definitions only.

// ── Priority ──────────────────────────────────────────────────────────────────

export type PortfolioPriority = "critical" | "high" | "medium" | "low";

// ── Health label ──────────────────────────────────────────────────────────────

export type PortfolioHealthLabel =
  | "critical"
  | "at_risk"
  | "needs_attention"
  | "healthy"
  | "strong";

// ── Pacing status ─────────────────────────────────────────────────────────────

export type PortfolioPacingStatus =
  | "over_pacing"
  | "under_pacing"
  | "on_pacing"
  | "no_data";

// ── Autonomy mode (mirrors ActionSafetyPolicy.autonomyMode values) ─────────────

export type PortfolioAutonomyMode =
  | "recommend_only"
  | "prepare_only"
  | "approval_required"
  | "guarded_auto_execute"
  | "restricted";

// ── Risk type ─────────────────────────────────────────────────────────────────

export type PortfolioRiskType =
  | "emergency_stop"
  | "high_alert"
  | "critical_pacing"
  | "approval_overdue"
  | "stale_sync"
  | "goal_miss"
  | "restricted_mode";

// ── Opportunity type ──────────────────────────────────────────────────────────

export type PortfolioOpportunityType =
  | "experiment_winner"
  | "strong_roas"
  | "under_budget"
  | "creative_ready"
  | "goal_ahead";

// ── Filter state (URL-driven for client/date; local for others) ───────────────

export type PortfolioFilterState = {
  clientId:       string;
  dateFrom:       string;
  dateTo:         string;
  riskLevel:      PortfolioPriority | "";
  automationState: PortfolioAutonomyMode | "";
  approvalState:  "has_pending" | "overdue" | "";
};

// ── Portfolio-wide KPI summary ────────────────────────────────────────────────

export type PortfolioSummary = {
  generatedAt: string;
  dateRange:   { from: string; to: string };
  // Financials (CRM source of truth, 7-day attribution)
  totalSpend:    number;
  totalRevenue:  number;
  portfolioRoas: number | null;
  portfolioCpa:  number | null;
  totalOrders:   number;
  // Account health counts
  totalClients:                          number;
  accountsAtRisk:                        number; // critical or at_risk health
  accountsWithUrgentApprovals:           number; // has approval pending > 48 h
  accountsWithHighPriorityOpportunities: number;
  accountsUnderEmergencyStop:            number;
  accountsUnderRestrictedMode:           number;
  // Signal counts
  pendingApprovalsCount:  number;
  unresolvedAlertsCount:  number;
  activeExperimentsCount: number;
};

// ── Health board item (one per client account) ────────────────────────────────

export type PortfolioHealthBoardItem = {
  clientId:   string;
  clientName: string;
  currency:   string;
  // Health score (0–100) and label
  healthScore: number;
  healthLabel: PortfolioHealthLabel;
  priority:    PortfolioPriority;
  // Financials (CRM source of truth)
  spend:   number;
  revenue: number;
  roas:    number | null;
  cpa:     number | null;
  orders:  number;
  // Goals
  roasGoal: number | null;
  cpaGoal:  number | null;
  // Pacing
  pacingStatus: PortfolioPacingStatus;
  pacingPct:    number | null;
  // Signals
  alertCount:             number;
  highAlertCount:         number;
  approvalCount:          number;
  activeExperimentsCount: number;
  // Governance
  autonomyMode:     PortfolioAutonomyMode | null;
  hasEmergencyStop: boolean;
  isRestricted:     boolean;
  // Sync health
  hasStaleSync: boolean;
  lastSyncAt:   string | null;
  // Quick navigation links
  links: {
    client:        string;
    commandCenter: string;
    approvals:     string;
    governance:    string;
    creativeLab:   string;
  };
};

// ── Risk item ─────────────────────────────────────────────────────────────────

export type PortfolioRiskItem = {
  id:          string;
  clientId:    string;
  clientName:  string;
  riskType:    PortfolioRiskType;
  title:       string;
  description: string;
  priority:    PortfolioPriority;
  href:        string;
};

// ── Opportunity item ──────────────────────────────────────────────────────────

export type PortfolioOpportunityItem = {
  id:              string;
  clientId:        string;
  clientName:      string;
  opportunityType: PortfolioOpportunityType;
  title:           string;
  description:     string;
  priority:        PortfolioPriority;
  href:            string;
};

// ── Approval snapshot (per client) ───────────────────────────────────────────

export type PortfolioApprovalSummary = {
  clientId:        string;
  clientName:      string;
  count:           number;
  oldestPendingAt: string; // ISO string
  hasCritical:     boolean; // oldest > 48 h
  href:            string;
};

// ── Automation snapshot (per client) ─────────────────────────────────────────

export type PortfolioAutomationSummary = {
  clientId:             string;
  clientName:           string;
  autonomyMode:         PortfolioAutonomyMode | null;
  hasEmergencyStop:     boolean;
  isRestricted:         boolean;
  autoExecutionEnabled: boolean;
  recentExecutionCount: number; // last 7 days
  href:                 string;
};

// ── Full payload (server → client) ────────────────────────────────────────────

export type PortfolioPayload = {
  summary:             PortfolioSummary;
  healthBoard:         PortfolioHealthBoardItem[];
  risks:               PortfolioRiskItem[];
  opportunities:       PortfolioOpportunityItem[];
  approvalSnapshots:   PortfolioApprovalSummary[];
  automationSnapshots: PortfolioAutomationSummary[];
  clients:             { id: string; name: string }[];
};
