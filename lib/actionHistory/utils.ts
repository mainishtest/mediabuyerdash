// ─── Action History — Pure Utilities ─────────────────────────────────────────
//
// Client-safe functions. NO Prisma imports. NO DB access.
// These are imported by "use client" components for summary/grouping/filtering.
// Server-only aggregation stays in aggregator.ts.

import type {
  ActionHistoryEntry,
  ActionHistoryTimelineItem,
  ActionHistoryGroup,
  ActionHistorySummary,
} from "../../types/actionHistory";

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

// ── Filter helper (client-side) ─────────────────────────────────────────────

export function filterActionHistoryEntries(
  entries: ActionHistoryEntry[],
  filters: {
    clientId?: string;
    eventType?: string;
    status?: string;
    actor?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): ActionHistoryEntry[] {
  let result = entries;

  if (filters.clientId) {
    result = result.filter((e) => e.clientId === filters.clientId);
  }
  if (filters.eventType) {
    result = result.filter((e) => e.eventType === filters.eventType);
  }
  if (filters.status) {
    result = result.filter((e) => e.status === filters.status);
  }
  if (filters.actor) {
    result = result.filter((e) => e.actor.type === filters.actor);
  }
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    result = result.filter((e) => new Date(e.occurredAt).getTime() >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime() + 86_400_000;
    result = result.filter((e) => new Date(e.occurredAt).getTime() <= to);
  }

  return result;
}
