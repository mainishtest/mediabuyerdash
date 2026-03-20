// ─── Portfolio Controls — Approval Board Builder ──────────────────────────────
//
// Pure functions that transform raw approval records into typed board items.
// No DB calls here — receives data from the aggregator.
// Aging classification and control priority derivation live here.

import type {
  PortfolioApprovalBoardItem,
  PortfolioApprovalAging,
  PortfolioApprovalAgingBucket,
  PortfolioControlPriority,
  PortfolioControlLinks,
} from "./types";

// ── Helper: aging from hours ──────────────────────────────────────────────────

export function agingBucket(hours: number): PortfolioApprovalAgingBucket {
  if (hours < 4)  return "fresh";
  if (hours < 24) return "aging";
  if (hours < 48) return "overdue";
  return "critical";
}

export function agingHours(proposedAt: string | Date): number {
  return (Date.now() - new Date(proposedAt).getTime()) / 3_600_000;
}

// ── Helper: control priority from aging + action priority ─────────────────────

function deriveControlPriority(
  dbPriority: string,
  bucket: PortfolioApprovalAgingBucket,
  status: string
): PortfolioControlPriority {
  if (status === "escalated" || bucket === "critical") return "critical";
  if (bucket === "overdue" || dbPriority === "high")   return "high";
  if (bucket === "aging"   || dbPriority === "medium") return "medium";
  return "low";
}

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

// ── Types for raw DB rows ─────────────────────────────────────────────────────

export type RawApprovalRow = {
  id:              string;
  clientAccountId: string;
  clientName:      string;
  actionType:      string;
  priority:        string;
  status:          string;
  entityName:      string;
  entityType:      string;
  rationale:       string;
  proposedAt:      Date;
  deferredUntil:   Date | null;
  escalatedAt:     Date | null;
  escalationNote:  string | null;
};

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildPortfolioApprovalBoard(
  rows: RawApprovalRow[]
): PortfolioApprovalBoardItem[] {
  const items: PortfolioApprovalBoardItem[] = rows.map((row) => {
    const hours  = agingHours(row.proposedAt);
    const bucket = agingBucket(hours);
    const status = row.status as "proposed" | "deferred" | "escalated";

    return {
      id:              row.id,
      clientId:        row.clientAccountId,
      clientName:      row.clientName,
      actionType:      row.actionType,
      priority:        row.priority as "low" | "medium" | "high",
      status,
      entityName:      row.entityName,
      entityType:      row.entityType,
      rationale:       row.rationale,
      agingHours:      Math.round(hours * 10) / 10,
      agingBucket:     bucket,
      proposedAt:      row.proposedAt.toISOString(),
      deferredUntil:   row.deferredUntil?.toISOString() ?? null,
      escalationNote:  row.escalationNote ?? null,
      controlPriority: deriveControlPriority(row.priority, bucket, status),
      links:           controlLinks(row.clientAccountId),
    };
  });

  // Sort: escalated first, then by control priority desc, then by aging desc
  const PRIORITY_WEIGHT: Record<PortfolioControlPriority, number> = {
    critical: 4, high: 3, medium: 2, low: 1,
  };

  items.sort((a, b) => {
    // Escalated always first
    if (a.status === "escalated" && b.status !== "escalated") return -1;
    if (b.status === "escalated" && a.status !== "escalated") return  1;
    // Then priority desc
    const pd = PRIORITY_WEIGHT[b.controlPriority] - PRIORITY_WEIGHT[a.controlPriority];
    if (pd !== 0) return pd;
    // Then aging desc (oldest first)
    return b.agingHours - a.agingHours;
  });

  return items;
}

// ── Aging summary ─────────────────────────────────────────────────────────────

export function summarizePortfolioApprovalAging(
  items: PortfolioApprovalBoardItem[]
): PortfolioApprovalAging {
  const result: PortfolioApprovalAging = {
    fresh: 0, aging: 0, overdue: 0, critical: 0, total: items.length,
  };
  for (const item of items) {
    result[item.agingBucket]++;
  }
  return result;
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function agingBucketLabel(bucket: PortfolioApprovalAgingBucket): string {
  const MAP: Record<PortfolioApprovalAgingBucket, string> = {
    fresh:    "Fresh (<4h)",
    aging:    "Aging (4–24h)",
    overdue:  "Overdue (24–48h)",
    critical: "Critical (>48h)",
  };
  return MAP[bucket];
}

export function agingBucketBadgeClass(bucket: PortfolioApprovalAgingBucket): string {
  if (bucket === "critical") return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (bucket === "overdue")  return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (bucket === "aging")    return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function approvalStatusBadgeClass(status: string): string {
  if (status === "escalated") return "border-violet-800/50 bg-violet-950/60 text-violet-300";
  if (status === "deferred")  return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function controlPriorityBadgeClass(p: PortfolioControlPriority): string {
  if (p === "critical") return "border-rose-800/50 bg-rose-950/60 text-rose-300";
  if (p === "high")     return "border-amber-800/50 bg-amber-950/60 text-amber-300";
  if (p === "medium")   return "border-sky-800/50 bg-sky-950/60 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

export function actionTypeLabel(t: string): string {
  const MAP: Record<string, string> = {
    pause_campaign:     "Pause Campaign",
    reduce_budget:      "Reduce Budget",
    increase_budget:    "Increase Budget",
    review_creative:    "Review Creative",
    refresh_creative:   "Refresh Creative",
    run_sync:           "Run Sync",
    investigate_client: "Investigate Client",
    set_goals:          "Set Goals",
    review_pacing:      "Review Pacing",
  };
  return MAP[t] ?? t.replace(/_/g, " ");
}

export function formatAgingHours(h: number): string {
  if (h < 1)  return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d ${Math.round(h % 24)}h`;
}
