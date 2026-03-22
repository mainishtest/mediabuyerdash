// ─── Action History — Unified Timeline Aggregator ────────────────────────────
//
// Merges multiple event sources into a single account-level timeline:
//   1. AutomationAuditLog / ProposedAutomationAction / AutoExecutionLog
//      (via existing loadCombinedAuditHistory)
//   2. CreativeLabActivityLog (creative workflow transitions)
//   3. CreativeOutcomeRouteRecord (outcome routing decisions)
//
// Design: read-only aggregation. No new event store. No side effects.
// Reuses existing audit infra via lib/auditLog/persist.ts.

import { prisma } from "../db";
import { loadCombinedAuditHistory } from "../auditLog/persist";
import { summarizeAutomationHistory } from "../auditLog/builders";
import type { AutomationAuditEntry } from "../auditLog/types";
import type {
  ActionHistoryEntry,
  ActionHistoryTimelineItem,
  ActionHistoryGroup,
  ActionHistoryFilterState,
  ActionHistorySummary,
  ActionHistoryEventType,
  ActionHistoryStatus,
  ActionHistorySource,
  ActionHistoryActor,
  ActionHistoryEntityLink,
  ActionHistoryOutcomeLink,
} from "../../types/actionHistory";

// ── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_ACTOR: ActionHistoryActor = { type: "system", id: "system", label: "System" };
const CRON_ACTOR: ActionHistoryActor = { type: "cron", id: "cron", label: "Scheduled Job" };

// ── Main builder ────────────────────────────────────────────────────────────

export async function buildActionHistoryTimeline(opts: {
  workspaceId: string | null;
  clientId?:   string;
  eventType?:  ActionHistoryEventType | "";
  status?:     ActionHistoryStatus | "";
  dateFrom?:   string;
  dateTo?:     string;
  limit?:      number;
}): Promise<ActionHistoryEntry[]> {
  const limit = opts.limit ?? 100;

  // Fetch all sources in parallel
  const [auditEntries, creativeLabEntries, outcomeEntries] = await Promise.all([
    loadAuditHistoryAsActionHistory(opts),
    loadCreativeLabAsActionHistory(opts.workspaceId, opts.clientId, limit),
    loadOutcomeRoutesAsActionHistory(opts.clientId, limit),
  ]);

  // Merge
  let combined = [...auditEntries, ...creativeLabEntries, ...outcomeEntries];

  // Apply filters that aren't handled by individual loaders
  if (opts.eventType) {
    combined = combined.filter((e) => e.eventType === opts.eventType);
  }
  if (opts.status) {
    combined = combined.filter((e) => e.status === opts.status);
  }
  if (opts.dateFrom) {
    const from = new Date(opts.dateFrom).getTime();
    combined = combined.filter((e) => new Date(e.occurredAt).getTime() >= from);
  }
  if (opts.dateTo) {
    const to = new Date(opts.dateTo).getTime() + 86_400_000;
    combined = combined.filter((e) => new Date(e.occurredAt).getTime() <= to);
  }

  // Sort descending
  combined.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return combined.slice(0, limit);
}

// ── Summary ─────────────────────────────────────────────────────────────────

export function buildActionHistorySummary(entries: ActionHistoryEntry[]): ActionHistorySummary {
  const dates = entries.map((e) => e.occurredAt).sort();

  return {
    totalEntries:    entries.length,
    successCount:    entries.filter((e) => e.status === "success").length,
    failedCount:     entries.filter((e) => e.status === "failed").length,
    blockedCount:    entries.filter((e) => e.status === "blocked").length,
    pendingCount:    entries.filter((e) => e.status === "pending").length,
    scaleActions:    entries.filter((e) =>
      e.eventType === "scale_plan_created" || e.eventType === "scale_executed" || e.eventType === "budget_changed"
    ).length,
    testActions:     entries.filter((e) =>
      e.eventType === "test_created" || e.eventType === "test_launched"
    ).length,
    creativeActions: entries.filter((e) =>
      e.eventType === "creative_refresh_sent" || e.eventType === "image_generation_completed" || e.eventType === "creative_status_changed"
    ).length,
    outcomeRoutes:   entries.filter((e) => e.eventType === "outcome_routed").length,
    periodFrom:      dates[0] ?? null,
    periodTo:        dates[dates.length - 1] ?? null,
  };
}

// ── Group by date ───────────────────────────────────────────────────────────

export function groupActionHistoryEntries(entries: ActionHistoryEntry[]): ActionHistoryGroup[] {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const groups: Map<string, ActionHistoryTimelineItem[]> = new Map();

  for (const entry of entries) {
    const dateGroup = entry.occurredAt.slice(0, 10);
    const timeLabel = new Date(entry.occurredAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const item: ActionHistoryTimelineItem = {
      ...entry,
      dateGroup,
      timeLabel,
    };

    if (!groups.has(dateGroup)) groups.set(dateGroup, []);
    groups.get(dateGroup)!.push(item);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      label: date === today ? "Today"
           : date === yesterday ? "Yesterday"
           : new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
               month: "short", day: "numeric", year: "numeric",
             }),
      items,
    }));
}

// ── Recent actions summary (for daily brief integration) ────────────────────

export async function summarizeRecentActions(opts: {
  workspaceId: string | null;
  clientId?:   string;
  dayCount?:   number;
}): Promise<ActionHistorySummary> {
  const dateFrom = new Date(Date.now() - (opts.dayCount ?? 1) * 86_400_000)
    .toISOString().slice(0, 10);

  const entries = await buildActionHistoryTimeline({
    workspaceId: opts.workspaceId,
    clientId:    opts.clientId,
    dateFrom,
    limit:       200,
  });

  return buildActionHistorySummary(entries);
}

// ═══════════════════════════════════════════════════════════════════════════
// Source adapters — convert each source into ActionHistoryEntry[]
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. Automation audit → ActionHistoryEntry ────────────────────────────────

async function loadAuditHistoryAsActionHistory(opts: {
  workspaceId: string | null;
  clientId?:   string;
  limit?:      number;
}): Promise<ActionHistoryEntry[]> {
  const entries = await loadCombinedAuditHistory({
    workspaceId: opts.workspaceId,
    clientId:    opts.clientId,
    limit:       opts.limit ?? 80,
  });

  return entries.map(mapAuditToActionHistory);
}

function mapAuditToActionHistory(e: AutomationAuditEntry): ActionHistoryEntry {
  const eventType = mapAuditEventType(e.eventType, e.actionType);
  const status = mapAuditStatus(e);

  return {
    id:          e.id,
    eventType,
    status,
    title:       buildAuditTitle(e),
    description: e.notes ?? e.policyReason ?? buildAuditDescription(e),
    actor:       { type: e.actor.type, id: e.actor.id, label: e.actor.label },
    entity: {
      entityType: mapEntityType(e.scope.entityType),
      entityId:   e.scope.entityId,
      entityName: e.scope.entityName,
      href:       buildEntityHref(e),
    },
    outcomeLink: null, // Linked in post-processing
    clientId:    e.clientAccountId,
    clientName:  e.clientName ?? e.scope.clientName ?? null,
    source:      mapAuditSource(e.source),
    occurredAt:  e.occurredAt,
    href:        "/automation/history",
    metadata: {
      policyDecision: e.policyDecision,
      rollbackState:  e.rollback.state,
    },
  };
}

function mapAuditEventType(eventType: string, actionType: string): ActionHistoryEventType {
  // Scale-related actions
  if (actionType === "increase_budget" || actionType === "reduce_budget") {
    if (eventType === "execution_succeeded") return "scale_executed";
    if (eventType === "approved") return "scale_plan_created";
    if (eventType === "execution_failed") return "execution_failed";
    return "budget_changed";
  }

  switch (eventType) {
    case "recommended":         return "recommendation_created";
    case "approval_requested":  return "approval_requested";
    case "approved":            return "approval_granted";
    case "rejected":            return "approval_rejected";
    case "deferred":            return "approval_deferred";
    case "blocked":             return "action_blocked";
    case "emergency_stopped":   return "emergency_stopped";
    case "execution_started":   return "retry_started";
    case "execution_succeeded": return "execution_succeeded";
    case "execution_failed":    return "execution_failed";
    default:                    return "recommendation_created";
  }
}

function mapAuditStatus(e: AutomationAuditEntry): ActionHistoryStatus {
  if (e.eventType === "execution_succeeded" || e.eventType === "approved") return "success";
  if (e.eventType === "execution_failed") return "failed";
  if (e.eventType === "blocked" || e.eventType === "emergency_stopped") return "blocked";
  if (e.eventType === "approval_requested" || e.eventType === "recommended" || e.eventType === "prepared") return "pending";
  if (e.eventType === "deferred") return "pending";
  return "success";
}

function buildAuditTitle(e: AutomationAuditEntry): string {
  const entity = e.scope.entityName || "Unknown";
  const client = e.clientName ?? "";

  switch (e.eventType) {
    case "approved":            return `Approved ${e.actionType.replace(/_/g, " ")} for ${entity}`;
    case "rejected":            return `Rejected ${e.actionType.replace(/_/g, " ")} for ${entity}`;
    case "execution_succeeded": return `Executed ${e.actionType.replace(/_/g, " ")} on ${entity}`;
    case "execution_failed":    return `Failed: ${e.actionType.replace(/_/g, " ")} on ${entity}`;
    case "blocked":             return `Blocked: ${e.actionType.replace(/_/g, " ")} on ${entity}`;
    case "emergency_stopped":   return `Emergency stop on ${entity}`;
    case "approval_requested":  return `Approval requested: ${e.actionType.replace(/_/g, " ")} for ${entity}`;
    case "recommended":         return `Recommendation: ${e.actionType.replace(/_/g, " ")} for ${entity}`;
    default:                    return `${e.eventType.replace(/_/g, " ")} — ${entity}`;
  }
}

function buildAuditDescription(e: AutomationAuditEntry): string {
  if (e.execution?.errorMessage) return e.execution.errorMessage;
  if (e.block?.reason) return e.block.reason;
  if (e.approval?.reason) return e.approval.reason;
  return `${e.actionType.replace(/_/g, " ")} on ${e.scope.entityName}`;
}

function mapEntityType(t: string): ActionHistoryEntityLink["entityType"] {
  if (t === "campaign") return "campaign";
  if (t === "client" || t === "ad_account") return "client";
  return "workspace";
}

function buildEntityHref(e: AutomationAuditEntry): string {
  if (e.clientAccountId) return `/clients/${e.clientAccountId}/decision`;
  return "/automation/history";
}

function mapAuditSource(s: string): ActionHistorySource {
  if (s === "native") return "automation_audit";
  if (s === "bridged_execution") return "execution_log";
  return "proposed_action";
}

// ── 2. CreativeLabActivityLog → ActionHistoryEntry ──────────────────────────

async function loadCreativeLabAsActionHistory(
  workspaceId: string | null,
  clientId: string | undefined,
  limit: number,
): Promise<ActionHistoryEntry[]> {
  try {
    const rows = await prisma.creativeLabActivityLog.findMany({
      where: {},
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        item: {
          select: {
            id: true,
            title: true,
            clientAccountId: true,
            status: true,
          },
        },
      },
    });

    return rows
      .filter((r) => !clientId || r.item?.clientAccountId === clientId)
      .map((r): ActionHistoryEntry => {
        const eventType = mapCreativeAction(r.action, r.toStatus);
        return {
          id:          `creative_${r.id}`,
          eventType,
          status:      mapCreativeStatus(r.toStatus),
          title:       buildCreativeTitle(r.action, r.item?.title ?? "Creative", r.toStatus),
          description: r.note ?? `${r.action}: ${r.fromStatus ?? "—"} → ${r.toStatus ?? "—"}`,
          actor:       SYSTEM_ACTOR,
          entity: {
            entityType: "creative",
            entityId:   r.itemId,
            entityName: r.item?.title ?? "Creative item",
            href:       "/creative-lab",
          },
          outcomeLink: null,
          clientId:    r.item?.clientAccountId ?? null,
          clientName:  null,
          source:      "creative_lab",
          occurredAt:  r.createdAt.toISOString(),
          href:        "/creative-lab",
          metadata: {
            fromStatus: r.fromStatus,
            toStatus:   r.toStatus,
            action:     r.action,
          },
        };
      });
  } catch {
    return [];
  }
}

function mapCreativeAction(action: string, toStatus: string | null): ActionHistoryEventType {
  if (action === "generate_image" || action === "image_generated") return "image_generation_completed";
  if (action === "send_to_lab" || action === "refresh") return "creative_refresh_sent";
  if (action === "launch" || action === "publish") return "test_launched";
  if (action === "create" || action === "draft") return "test_created";
  return "creative_status_changed";
}

function mapCreativeStatus(toStatus: string | null): ActionHistoryStatus {
  if (!toStatus) return "success";
  if (toStatus === "failed" || toStatus === "error") return "failed";
  if (toStatus === "blocked") return "blocked";
  if (toStatus === "draft" || toStatus === "pending_review") return "pending";
  return "success";
}

function buildCreativeTitle(action: string, title: string, toStatus: string | null): string {
  if (action === "generate_image" || action === "image_generated") return `Image generated: ${title}`;
  if (action === "send_to_lab" || action === "refresh") return `Sent to Creative Lab: ${title}`;
  if (action === "launch" || action === "publish") return `Launched: ${title}`;
  if (action === "approve" || action === "approved") return `Approved: ${title}`;
  if (action === "reject" || action === "rejected") return `Rejected: ${title}`;
  return `${action}: ${title}${toStatus ? ` → ${toStatus}` : ""}`;
}

// ── 3. CreativeOutcomeRouteRecord → ActionHistoryEntry ──────────────────────

async function loadOutcomeRoutesAsActionHistory(
  clientId: string | undefined,
  limit: number,
): Promise<ActionHistoryEntry[]> {
  const db = prisma as Record<string, any>;
  try {
    const where: Record<string, unknown> = {};
    if (clientId) where.clientAccountId = clientId;

    const rows = await db.creativeOutcomeRouteRecord.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return rows.map((r: any): ActionHistoryEntry => ({
      id:          `outcome_${r.id}`,
      eventType:   "outcome_routed",
      status:      r.readinessState === "pending_action" ? "pending" : "success",
      title:       buildOutcomeTitle(r),
      description: buildOutcomeDescription(r),
      actor:       SYSTEM_ACTOR,
      entity: {
        entityType: "experiment",
        entityId:   r.testResultId ?? r.id,
        entityName: r.challengerVariantTitle ?? "Experiment outcome",
        href:       "/creative-lab/outcomes",
      },
      outcomeLink: {
        outcomeId:   r.id,
        outcomeType: mapOutcomeRouteType(r.routeType),
        label:       buildOutcomeRouteLabel(r.routeType),
        href:        "/creative-lab/outcomes",
      },
      clientId:    r.clientAccountId ?? null,
      clientName:  r.campaignName ?? null,
      source:      "outcome_route",
      occurredAt:  r.updatedAt?.toISOString() ?? new Date().toISOString(),
      href:        "/creative-lab/outcomes",
      metadata: {
        routeType:       r.routeType,
        readinessState:  r.readinessState,
        primaryLift:     r.primaryLift,
        confidenceScore: r.confidenceScore,
        outcome:         r.outcome,
      },
    }));
  } catch {
    return [];
  }
}

function buildOutcomeTitle(r: any): string {
  const variant = r.challengerVariantTitle ?? "Variant";
  switch (r.routeType) {
    case "send_winner_to_scale_review": return `Winner routed to scale: ${variant}`;
    case "keep_winner_running":         return `Winner kept running: ${variant}`;
    case "send_loser_to_creative_lab":  return `Loser sent to Creative Lab: ${variant}`;
    case "send_mixed_result_to_follow_up_test": return `Mixed result → follow-up test: ${variant}`;
    case "monitor_until_more_data":     return `Monitoring: ${variant}`;
    case "capture_learning_only":       return `Learning captured: ${variant}`;
    case "archive_creative_outcome":    return `Archived: ${variant}`;
    default:                            return `Outcome routed: ${variant}`;
  }
}

function buildOutcomeDescription(r: any): string {
  const parts: string[] = [];
  if (r.primaryLift != null) {
    const sign = r.primaryLift >= 0 ? "+" : "";
    parts.push(`${sign}${(r.primaryLift * 100).toFixed(1)}% lift`);
  }
  if (r.confidenceScore != null) {
    parts.push(`${Math.round(r.confidenceScore * 100)}% confidence`);
  }
  if (r.campaignName) parts.push(r.campaignName);
  return parts.join(" · ") || "Outcome routing decision";
}

function mapOutcomeRouteType(routeType: string): ActionHistoryOutcomeLink["outcomeType"] {
  switch (routeType) {
    case "send_winner_to_scale_review": return "scale_opportunity";
    case "keep_winner_running":         return "winner";
    case "send_loser_to_creative_lab":  return "refresh_needed";
    case "send_mixed_result_to_follow_up_test": return "retest_needed";
    case "monitor_until_more_data":     return "monitoring";
    case "capture_learning_only":       return "loser";
    case "archive_creative_outcome":    return "loser";
    default:                            return "monitoring";
  }
}

function buildOutcomeRouteLabel(routeType: string): string {
  switch (routeType) {
    case "send_winner_to_scale_review": return "Scale review";
    case "keep_winner_running":         return "Winner running";
    case "send_loser_to_creative_lab":  return "Creative refresh";
    case "send_mixed_result_to_follow_up_test": return "Follow-up test";
    case "monitor_until_more_data":     return "Monitoring";
    case "capture_learning_only":       return "Learning captured";
    case "archive_creative_outcome":    return "Archived";
    default:                            return "Outcome";
  }
}
