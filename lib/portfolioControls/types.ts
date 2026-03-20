// ─── Portfolio Controls — Typed Models ────────────────────────────────────────
//
// All types for the Portfolio Approval, Automation Status, and Governance
// Control Board. This surface provides centralized visibility and control
// over approvals, automation state, autonomy modes, emergency stops, and
// governance blockers across the portfolio.
//
// This layer does NOT introduce new optimization or execution engines.
// Action buttons surface to existing approval and governance API endpoints.
// Pure type definitions — no business logic.

// ── Priority ──────────────────────────────────────────────────────────────────

export type PortfolioControlPriority = "critical" | "high" | "medium" | "low";

// ── Approval aging buckets ────────────────────────────────────────────────────

export type PortfolioApprovalAgingBucket =
  | "fresh"    // < 4 hours
  | "aging"    // 4–24 hours
  | "overdue"  // 24–48 hours
  | "critical" // > 48 hours

// ── Execution readiness (per account) ────────────────────────────────────────

export type PortfolioExecutionReadiness =
  | "ready"        // auto-exec enabled, policy allows, no stops
  | "restricted"   // policy is restricted — no auto actions
  | "stopped"      // emergency stop is active
  | "disabled"     // auto-exec disabled but policy allows
  | "no_policy";   // no safety policy configured

// ── Navigation links ──────────────────────────────────────────────────────────

export type PortfolioControlLinks = {
  account:        string;
  approvalQueue:  string;
  governance:     string;
  policies:       string;
  auditHistory:   string;
};

// ── Approval board item (one per actionable approval) ────────────────────────

export type PortfolioApprovalBoardItem = {
  id:              string;
  clientId:        string;
  clientName:      string;
  actionType:      string;
  priority:        "low" | "medium" | "high";
  status:          "proposed" | "deferred" | "escalated";
  entityName:      string;
  entityType:      string;
  rationale:       string;
  agingHours:      number;
  agingBucket:     PortfolioApprovalAgingBucket;
  proposedAt:      string;   // ISO
  deferredUntil:   string | null;
  escalationNote:  string | null;
  controlPriority: PortfolioControlPriority;
  links:           PortfolioControlLinks;
};

// ── Approval aging summary ────────────────────────────────────────────────────

export type PortfolioApprovalAging = {
  fresh:    number;  // < 4h
  aging:    number;  // 4–24h
  overdue:  number;  // 24–48h
  critical: number;  // > 48h
  total:    number;
};

// ── Automation state item (one per client) ────────────────────────────────────

export type PortfolioAutomationStateItem = {
  clientId:             string;
  clientName:           string;
  autoExecEnabled:      boolean;
  autonomyMode:         string | null;
  hasEmergencyStop:     boolean;
  isRestricted:         boolean;
  recentExecutionCount: number;    // last 7 days
  pendingApprovalCount: number;
  executionReadiness:   PortfolioExecutionReadiness;
  controlPriority:      PortfolioControlPriority;
  links:                PortfolioControlLinks;
};

// ── Autonomy mode summary (portfolio-wide) ────────────────────────────────────

export type PortfolioAutonomySummary = {
  byMode:           Record<string, number>; // mode → count
  restrictedCount:  number;
  guardedCount:     number;   // guarded_auto_execute
  approvalRequired: number;
  recommendOnly:    number;
  noPolicy:         number;
  total:            number;
};

// ── Governance control item (stop or override) ────────────────────────────────

export type PortfolioGovernanceControlItem = {
  id:              string;
  controlType:     "emergency_stop" | "override";
  overrideType:    string | null;   // pause_scope | require_approval_all | etc.
  scope:           string;          // global | client | ad_account | campaign | action_type
  scopeId:         string;
  scopeLabel:      string;          // human-readable scope identifier
  reason:          string;
  appliedBy:       string | null;
  appliedAt:       string;          // ISO
  expiresAt:       string | null;
  isGlobal:        boolean;
  clientId:        string | null;
  clientName:      string | null;
  controlPriority: PortfolioControlPriority;
  links:           PortfolioControlLinks;
};

// ── Emergency stop summary (portfolio-wide) ───────────────────────────────────

export type PortfolioEmergencyStopSummary = {
  totalActive:       number;
  globalStops:       number;
  clientStops:       number;
  otherStops:        number;
  stoppedClientIds:  string[];
  stoppedClientNames: string[];
};

// ── Governance blocker (per account requiring intervention) ───────────────────

export type PortfolioGovernanceBlocker = {
  clientId:        string;
  clientName:      string;
  blockerTypes:    string[];     // e.g. ["emergency_stop", "overdue_approval"]
  description:     string;
  intervention:    string;       // recommended operator action
  controlPriority: PortfolioControlPriority;
  links:           PortfolioControlLinks;
};

// ── Control board summary (portfolio-wide) ────────────────────────────────────

export type PortfolioControlSummary = {
  generatedAt:              string;
  totalPendingApprovals:    number;
  criticalAgingApprovals:   number;  // > 48h
  overdueApprovals:         number;  // > 24h (includes critical)
  totalActiveStops:         number;
  globalStopsActive:        number;
  totalActiveOverrides:     number;
  accountsWithBlockers:     number;
  accountsReady:            number;  // executionReadiness = ready
  accountsRestricted:       number;  // restricted or stopped
  accountsAutoExecEnabled:  number;
  totalClients:             number;
};

// ── Filter state ──────────────────────────────────────────────────────────────

export type PortfolioControlFilterState = {
  clientId:           string;
  approvalState:      "all" | "proposed" | "deferred" | "escalated";
  agingBucket:        "all" | PortfolioApprovalAgingBucket;
  autonomyMode:       string;  // "" = all
  autoExecState:      "all" | "enabled" | "disabled";
  emergencyStopState: "all" | "stopped" | "not_stopped";
  blockerType:        "all" | "emergency_stop" | "override";
};

// ── Full payload (server → client) ────────────────────────────────────────────

export type PortfolioControlsPayload = {
  summary:              PortfolioControlSummary;
  approvalBoard:        PortfolioApprovalBoardItem[];
  approvalAging:        PortfolioApprovalAging;
  automationState:      PortfolioAutomationStateItem[];
  autonomySummary:      PortfolioAutonomySummary;
  governanceControls:   PortfolioGovernanceControlItem[];
  emergencyStopSummary: PortfolioEmergencyStopSummary;
  governanceBlockers:   PortfolioGovernanceBlocker[];
  clients:              { id: string; name: string }[];
};
