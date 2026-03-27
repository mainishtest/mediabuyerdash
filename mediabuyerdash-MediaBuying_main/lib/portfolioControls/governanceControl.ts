// ─── Portfolio Controls — Governance Control Board Builder ────────────────────
//
// Pure functions that build governance control items and blockers from raw
// stop and override records. No DB calls — receives data from aggregator.

import type {
  PortfolioGovernanceControlItem,
  PortfolioEmergencyStopSummary,
  PortfolioGovernanceBlocker,
  PortfolioControlPriority,
  PortfolioControlLinks,
} from "./types";
import type { PortfolioAutomationStateItem } from "./types";

// ── Helper: standard links ────────────────────────────────────────────────────

function controlLinks(clientId: string | null): PortfolioControlLinks {
  return {
    account:       clientId ? `/clients/${clientId}` : `/clients`,
    approvalQueue: clientId ? `/automation?clientId=${clientId}` : `/automation`,
    governance:    `/automation/governance`,
    policies:      `/automation/policies`,
    auditHistory:  `/automation/history`,
  };
}

// ── Helper: human-readable scope label ───────────────────────────────────────

function buildScopeLabel(
  scope: string,
  scopeId: string,
  clientName: string | null
): string {
  if (scope === "global")      return "Global (all accounts)";
  if (scope === "client")      return clientName ? `Client: ${clientName}` : `Client: ${scopeId.slice(0, 8)}…`;
  if (scope === "ad_account")  return `Ad Account: ${scopeId.slice(0, 12)}…`;
  if (scope === "campaign")    return `Campaign: ${scopeId.slice(0, 12)}…`;
  if (scope === "action_type") return `Action type: ${scopeId.replace(/_/g, " ")}`;
  return `${scope}: ${scopeId.slice(0, 12)}…`;
}

// ── Raw types ─────────────────────────────────────────────────────────────────

export type RawStopRow = {
  id:          string;
  workspaceId: string;
  scope:       string;
  scopeId:     string;
  reason:      string;
  stoppedBy:   string | null;
  isActive:    boolean;
  expiresAt:   Date | null;
  createdAt:   Date;
};

export type RawOverrideRow = {
  id:           string;
  workspaceId:  string;
  overrideType: string;
  scope:        string;
  scopeId:      string;
  reason:       string;
  appliedBy:    string | null;
  isActive:     boolean;
  expiresAt:    Date | null;
  createdAt:    Date;
};

// ── Build governance control items (stops + overrides) ────────────────────────

export function buildPortfolioGovernanceControlBoard(params: {
  stops:     RawStopRow[];
  overrides: RawOverrideRow[];
  // Map from clientId → clientName for scope label building
  clientNames: Map<string, string>;
}): PortfolioGovernanceControlItem[] {
  const items: PortfolioGovernanceControlItem[] = [];

  // Emergency stops
  for (const s of params.stops) {
    const isGlobal   = s.scope === "global";
    const clientId   = s.scope === "client" ? s.scopeId : null;
    const clientName = clientId ? (params.clientNames.get(clientId) ?? null) : null;
    const scopeLabel = buildScopeLabel(s.scope, s.scopeId, clientName);

    const controlPriority: PortfolioControlPriority = isGlobal ? "critical" : "high";

    items.push({
      id:              s.id,
      controlType:     "emergency_stop",
      overrideType:    null,
      scope:           s.scope,
      scopeId:         s.scopeId,
      scopeLabel,
      reason:          s.reason,
      appliedBy:       s.stoppedBy ?? null,
      appliedAt:       s.createdAt.toISOString(),
      expiresAt:       s.expiresAt?.toISOString() ?? null,
      isGlobal,
      clientId,
      clientName,
      controlPriority,
      links: controlLinks(clientId),
    });
  }

  // Active overrides
  for (const o of params.overrides) {
    const isGlobal   = o.scope === "global";
    const clientId   = o.scope === "client" ? o.scopeId : null;
    const clientName = clientId ? (params.clientNames.get(clientId) ?? null) : null;
    const scopeLabel = buildScopeLabel(o.scope, o.scopeId, clientName);

    // pause_scope and require_approval_all overrides are higher priority
    const isHighImpact = o.overrideType === "pause_scope" ||
                         o.overrideType === "require_approval_all" ||
                         o.overrideType === "override_block";

    const controlPriority: PortfolioControlPriority =
      isGlobal      ? "critical" :
      isHighImpact  ? "high"     :
                      "medium";

    items.push({
      id:              o.id,
      controlType:     "override",
      overrideType:    o.overrideType,
      scope:           o.scope,
      scopeId:         o.scopeId,
      scopeLabel,
      reason:          o.reason,
      appliedBy:       o.appliedBy ?? null,
      appliedAt:       o.createdAt.toISOString(),
      expiresAt:       o.expiresAt?.toISOString() ?? null,
      isGlobal,
      clientId,
      clientName,
      controlPriority,
      links: controlLinks(clientId),
    });
  }

  // Sort: global first, then by priority desc, then by age desc
  const PW: Record<PortfolioControlPriority, number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  };

  items.sort((a, b) => {
    if (a.isGlobal !== b.isGlobal) return a.isGlobal ? -1 : 1;
    const pd = PW[b.controlPriority] - PW[a.controlPriority];
    if (pd !== 0) return pd;
    // Emergency stops before overrides at same priority
    if (a.controlType !== b.controlType) {
      return a.controlType === "emergency_stop" ? -1 : 1;
    }
    return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
  });

  return items;
}

// ── Emergency stop summary ────────────────────────────────────────────────────

export function summarizePortfolioEmergencyStops(
  stops: PortfolioGovernanceControlItem[],
  clientNames: Map<string, string>
): PortfolioEmergencyStopSummary {
  const stopItems = stops.filter((s) => s.controlType === "emergency_stop");

  const globalStops  = stopItems.filter((s) => s.isGlobal).length;
  const clientStops  = stopItems.filter((s) => s.scope === "client").length;
  const otherStops   = stopItems.length - globalStops - clientStops;

  const stoppedClientIds   = [...new Set(stopItems.filter((s) => s.clientId).map((s) => s.clientId!))];
  const stoppedClientNames = stoppedClientIds.map((id) => clientNames.get(id) ?? id);

  return {
    totalActive: stopItems.length,
    globalStops,
    clientStops,
    otherStops,
    stoppedClientIds,
    stoppedClientNames,
  };
}

// ── Governance blockers ───────────────────────────────────────────────────────

export function buildGovernanceBlockers(
  automationState:   PortfolioAutomationStateItem[],
  approvalsByClient: Map<string, number>,  // clientId → overdue approval count
  stopsByClient:     Set<string>           // clientIds with active stops
): PortfolioGovernanceBlocker[] {
  const blockers: PortfolioGovernanceBlocker[] = [];

  for (const item of automationState) {
    const cid         = item.clientId;
    const blockerTypes: string[] = [];
    const descriptions: string[] = [];

    if (item.hasEmergencyStop) {
      blockerTypes.push("emergency_stop");
      descriptions.push("Emergency stop is active — all automation blocked");
    }

    if (item.isRestricted) {
      blockerTypes.push("restricted");
      descriptions.push("Automation is in restricted mode");
    }

    const overdueCount = approvalsByClient.get(cid) ?? 0;
    if (overdueCount > 0) {
      blockerTypes.push("overdue_approval");
      descriptions.push(`${overdueCount} approval${overdueCount !== 1 ? "s" : ""} overdue >48h`);
    }

    if (blockerTypes.length === 0) continue;

    // Determine intervention recommendation
    let intervention: string;
    let controlPriority: PortfolioControlPriority;

    if (item.hasEmergencyStop) {
      intervention   = "Review and lift emergency stop in governance controls";
      controlPriority = "critical";
    } else if (overdueCount > 0 && item.isRestricted) {
      intervention   = "Resolve overdue approvals and review restriction policy";
      controlPriority = "high";
    } else if (overdueCount > 0) {
      intervention   = "Review and act on overdue approvals in the approval queue";
      controlPriority = "high";
    } else {
      intervention   = "Review automation restriction in governance policies";
      controlPriority = "medium";
    }

    blockers.push({
      clientId:        cid,
      clientName:      item.clientName,
      blockerTypes,
      description:     descriptions.join(". "),
      intervention,
      controlPriority,
      links: item.links,
    });
  }

  // Sort: critical first, then high
  const PW: Record<PortfolioControlPriority, number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  };
  blockers.sort((a, b) => PW[b.controlPriority] - PW[a.controlPriority]);
  return blockers;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function controlTypeLabel(t: string): string {
  if (t === "emergency_stop") return "Emergency Stop";
  if (t === "override")       return "Override";
  return t;
}

export function controlTypeBadgeClass(t: string): string {
  if (t === "emergency_stop") return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  return "border-amber-800/50 bg-amber-950/60 text-amber-300";
}

export function overrideTypeLabel(t: string | null): string {
  if (!t) return "—";
  const MAP: Record<string, string> = {
    pause_scope:           "Pause Scope",
    require_approval_all:  "Require All Approvals",
    defer_action:          "Defer Action",
    override_block:        "Override Block",
    resume_scope:          "Resume Scope",
  };
  return MAP[t] ?? t.replace(/_/g, " ");
}

export function scopeLabel(scope: string): string {
  const MAP: Record<string, string> = {
    global:      "Global",
    client:      "Client",
    ad_account:  "Ad Account",
    campaign:    "Campaign",
    action_type: "Action Type",
  };
  return MAP[scope] ?? scope;
}
