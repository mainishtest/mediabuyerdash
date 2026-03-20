// ─── Portfolio Controls — Automation State Builder ────────────────────────────
//
// Pure functions that transform per-client automation data into typed board items.
// No DB calls — receives pre-fetched data from the aggregator.
// Computes execution readiness and autonomy mode summaries.

import type {
  PortfolioAutomationStateItem,
  PortfolioAutonomySummary,
  PortfolioExecutionReadiness,
  PortfolioControlPriority,
  PortfolioControlLinks,
} from "./types";

// ── Helper: standard links ────────────────────────────────────────────────────

function controlLinks(clientId: string): PortfolioControlLinks {
  return {
    account:       `/clients/${clientId}`,
    approvalQueue: `/automation?clientId=${clientId}`,
    governance:    `/automation/governance`,
    policies:      `/automation/policies`,
    auditHistory:  `/automation/history`,
  };
}

// ── Helper: execution readiness ───────────────────────────────────────────────

function deriveExecutionReadiness(params: {
  autoExecEnabled: boolean;
  autonomyMode:    string | null;
  hasEmergencyStop: boolean;
  isRestricted:    boolean;
}): PortfolioExecutionReadiness {
  if (params.hasEmergencyStop) return "stopped";
  if (params.isRestricted)     return "restricted";
  if (!params.autonomyMode)    return "no_policy";
  if (!params.autoExecEnabled) return "disabled";
  return "ready";
}

// ── Helper: control priority from readiness + pending approvals ───────────────

function deriveAutomationControlPriority(
  readiness:           PortfolioExecutionReadiness,
  hasEmergencyStop:    boolean,
  pendingApprovalCount: number
): PortfolioControlPriority {
  if (hasEmergencyStop)              return "critical";
  if (readiness === "restricted")    return "high";
  if (pendingApprovalCount > 5)      return "high";
  if (pendingApprovalCount > 0)      return "medium";
  if (readiness === "no_policy")     return "medium";
  if (readiness === "disabled")      return "low";
  return "low";
}

// ── Raw data types ────────────────────────────────────────────────────────────

export type RawClientAutoState = {
  clientId:             string;
  clientName:           string;
  autoExecEnabled:      boolean;
  autonomyMode:         string | null;  // from ActionSafetyPolicy
  hasEmergencyStop:     boolean;
  isRestricted:         boolean;
  recentExecutionCount: number;         // from AutoExecutionLog last 7d
  pendingApprovalCount: number;         // from ProposedAutomationAction.status=proposed
};

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildPortfolioAutomationStateBoard(
  clients: RawClientAutoState[]
): PortfolioAutomationStateItem[] {
  return clients.map((c) => {
    const readiness = deriveExecutionReadiness({
      autoExecEnabled:  c.autoExecEnabled,
      autonomyMode:     c.autonomyMode,
      hasEmergencyStop: c.hasEmergencyStop,
      isRestricted:     c.isRestricted,
    });

    const controlPriority = deriveAutomationControlPriority(
      readiness,
      c.hasEmergencyStop,
      c.pendingApprovalCount
    );

    return {
      clientId:             c.clientId,
      clientName:           c.clientName,
      autoExecEnabled:      c.autoExecEnabled,
      autonomyMode:         c.autonomyMode,
      hasEmergencyStop:     c.hasEmergencyStop,
      isRestricted:         c.isRestricted,
      recentExecutionCount: c.recentExecutionCount,
      pendingApprovalCount: c.pendingApprovalCount,
      executionReadiness:   readiness,
      controlPriority,
      links: controlLinks(c.clientId),
    };
  });
}

// ── Autonomy summary ──────────────────────────────────────────────────────────

export function summarizePortfolioAutonomyState(
  items: PortfolioAutomationStateItem[]
): PortfolioAutonomySummary {
  const byMode: Record<string, number> = {};
  let restrictedCount  = 0;
  let guardedCount     = 0;
  let approvalRequired = 0;
  let recommendOnly    = 0;
  let noPolicy         = 0;

  for (const item of items) {
    const mode = item.autonomyMode ?? "__no_policy__";
    byMode[mode] = (byMode[mode] ?? 0) + 1;

    if (!item.autonomyMode) {
      noPolicy++;
    } else if (item.autonomyMode === "restricted") {
      restrictedCount++;
    } else if (item.autonomyMode === "guarded_auto_execute") {
      guardedCount++;
    } else if (item.autonomyMode === "approval_required") {
      approvalRequired++;
    } else if (item.autonomyMode === "recommend_only" || item.autonomyMode === "prepare_only") {
      recommendOnly++;
    }
  }

  return {
    byMode,
    restrictedCount,
    guardedCount,
    approvalRequired,
    recommendOnly,
    noPolicy,
    total: items.length,
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function executionReadinessLabel(r: PortfolioExecutionReadiness): string {
  const MAP: Record<PortfolioExecutionReadiness, string> = {
    ready:       "Ready",
    restricted:  "Restricted",
    stopped:     "Emergency Stop",
    disabled:    "Auto-Exec Off",
    no_policy:   "No Policy",
  };
  return MAP[r];
}

export function executionReadinessBadgeClass(r: PortfolioExecutionReadiness): string {
  if (r === "ready")       return "border-emerald-800/50 bg-emerald-950/60 text-emerald-300";
  if (r === "stopped")     return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (r === "restricted")  return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (r === "disabled")    return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function autonomyModeLabel(mode: string | null): string {
  if (!mode) return "Not set";
  const MAP: Record<string, string> = {
    recommend_only:       "Recommend Only",
    prepare_only:         "Prepare Only",
    approval_required:    "Approval Required",
    guarded_auto_execute: "Guarded Auto-Execute",
    restricted:           "Restricted",
  };
  return MAP[mode] ?? mode.replace(/_/g, " ");
}

export function autonomyModeBadgeClass(mode: string | null): string {
  if (!mode)                          return "border-slate-700 bg-slate-800 text-slate-500";
  if (mode === "restricted")          return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (mode === "guarded_auto_execute") return "border-emerald-800/50 bg-emerald-950/60 text-emerald-300";
  if (mode === "approval_required")   return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  return "border-sky-800/50 bg-sky-950/60 text-sky-300";
}
