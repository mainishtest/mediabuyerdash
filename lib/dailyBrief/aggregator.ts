// ─── Daily Morning Brief — Aggregator ────────────────────────────────────────
//
// Assembles a DailyMorningBrief by composing existing aggregators:
//   - buildDailyExecutiveSummary() → portfolio KPIs + client summaries
//   - buildDailyOutcomeSummary()   → winner/loser/scale highlights
//   - buildDigestContent()         → alerts, pacing, stale syncs
//
// No side effects. No email sending. Pure data assembly.
// CRM/Shopify is the source of truth for ROAS and CPA.

import { buildDailyExecutiveSummary } from "../dailySummary/aggregator";
import { buildDailyOutcomeSummary }   from "../dailyOutcomes/aggregator";
import { buildDigestContent }         from "../notifications/generator";
import type {
  DailyMorningBrief,
  DailyBriefSummary,
  DailyBriefAccountSummary,
  DailyBriefActionItem,
  DailyBriefWinner,
  DailyBriefLoser,
  DailyBriefBlockedItem,
  DailyBriefActionPriority,
} from "../../types/dailyBrief";

// ── Main builder ────────────────────────────────────────────────────────────

export async function buildDailyMorningBrief(opts: {
  workspaceId: string | null;
  timezone:    string;
  briefDate:   string;              // YYYY-MM-DD
}): Promise<DailyMorningBrief> {
  const { workspaceId, timezone, briefDate } = opts;

  // Run all three aggregators in parallel
  const [execSummary, outcomeSummary, digestContent] = await Promise.all([
    buildDailyExecutiveSummary({ workspaceId }),
    buildDailyOutcomeSummary({ limit: 30 }),
    buildDigestContent(workspaceId),
  ]);

  // ── Build account summaries ───────────────────────────────────────────
  const accounts = buildDailyBriefAccountSummaries(execSummary);

  // ── Build winners ─────────────────────────────────────────────────────
  const winners = buildDailyBriefWinners(outcomeSummary);

  // ── Build losers ──────────────────────────────────────────────────────
  const losers = buildDailyBriefLosers(outcomeSummary);

  // ── Build blocked items ───────────────────────────────────────────────
  const blockedItems = buildDailyBriefBlockedItems(execSummary, digestContent);

  // ── Build action items ────────────────────────────────────────────────
  const actions = buildDailyBriefActionItems(
    execSummary,
    outcomeSummary,
    digestContent,
  );

  // ── Build summary ─────────────────────────────────────────────────────
  const summary = buildBriefSummary(execSummary, winners, losers, blockedItems, actions);

  const id = `brief_${briefDate}_${Date.now()}`;

  return {
    id,
    briefDate,
    generatedAt:    new Date().toISOString(),
    deliveryState:  "generated",
    timezone,
    summary,
    accounts,
    actions,
    winners,
    losers,
    blockedItems,
    trustState:     execSummary.trustState,
    trustMessage:   execSummary.trustMessage,
    noDataYesterday: execSummary.noDataYesterday,
    hasPartialCrm:  execSummary.hasPartialCrm,
    hasStaleSyncs:  execSummary.hasStaleSync,
    hasMissingGoals: execSummary.hasMissingGoals,
    workspaceId,
  };
}

// ── Account summaries ───────────────────────────────────────────────────────

function buildDailyBriefAccountSummaries(
  exec: Awaited<ReturnType<typeof buildDailyExecutiveSummary>>
): DailyBriefAccountSummary[] {
  return exec.clients.map((c) => ({
    clientId:    c.clientId,
    clientName:  c.clientName,
    currency:    c.currency,
    spend:       c.spend,
    revenue:     c.revenue,
    roas:        c.roas,
    cpa:         c.cpa,
    orders:      c.orders,
    status:      c.status,
    trend:       c.trend,
    scaleReady:  c.scaleReadiness === "ready",
    alertCount:  c.alertCount,
    hasStaleSync: c.hasStaleSync,
    href:        c.href,
  }));
}

// ── Winners ─────────────────────────────────────────────────────────────────

type OutcomeSummaryResult = Awaited<ReturnType<typeof buildDailyOutcomeSummary>>;

function buildDailyBriefWinners(outcomes: OutcomeSummaryResult): DailyBriefWinner[] {
  return outcomes.highlights
    .filter((h) => h.type === "winner" || h.type === "scale_opportunity")
    .slice(0, 10)
    .map((h) => ({
      id:          h.id,
      title:       h.title,
      subtitle:    h.subtitle,
      lift:        h.primaryLift,
      confidence:  h.confidenceScore,
      clientName:  h.clientAccountId,
      scaleReady:  h.type === "scale_opportunity",
      href:        h.href,
    }));
}

// ── Losers ──────────────────────────────────────────────────────────────────

function buildDailyBriefLosers(outcomes: OutcomeSummaryResult): DailyBriefLoser[] {
  return outcomes.highlights
    .filter((h) => h.type === "loser" || h.type === "refresh_needed")
    .slice(0, 10)
    .map((h) => ({
      id:            h.id,
      title:         h.title,
      subtitle:      h.subtitle,
      lift:          h.primaryLift,
      confidence:    h.confidenceScore,
      clientName:    h.clientAccountId,
      refreshQueued: h.type === "refresh_needed",
      href:          h.href,
    }));
}

// ── Blocked items ───────────────────────────────────────────────────────────

function buildDailyBriefBlockedItems(
  exec:   Awaited<ReturnType<typeof buildDailyExecutiveSummary>>,
  digest: Awaited<ReturnType<typeof buildDigestContent>>,
): DailyBriefBlockedItem[] {
  const blocked: DailyBriefBlockedItem[] = [];

  // Stale syncs
  for (const item of digest.staleSyncs) {
    blocked.push({
      id:         `blocked_stale_${item.client}`,
      label:      `Stale sync: ${item.client}`,
      reason:     item.detail,
      category:   "stale_sync",
      clientName: item.client,
      href:       "/health",
    });
  }

  // Missing goals
  for (const item of digest.missingGoals) {
    blocked.push({
      id:         `blocked_goal_${item.label}`,
      label:      `Missing goal: ${item.label}`,
      reason:     item.detail,
      category:   "missing_goal",
      clientName: item.client,
      href:       `/clients`,
    });
  }

  // Clients with stale sync but not already captured
  const staleSyncClients = new Set(digest.staleSyncs.map((s) => s.client));
  for (const c of exec.clients) {
    if (c.hasStaleSync && !staleSyncClients.has(c.clientName)) {
      blocked.push({
        id:         `blocked_sync_${c.clientId}`,
        label:      `Stale data: ${c.clientName}`,
        reason:     "Sync data is more than 48h old. Numbers may be unreliable.",
        category:   "stale_sync",
        clientName: c.clientName,
        href:       "/health",
      });
    }
  }

  return blocked.slice(0, 15);
}

// ── Action items ────────────────────────────────────────────────────────────

function buildDailyBriefActionItems(
  exec:     Awaited<ReturnType<typeof buildDailyExecutiveSummary>>,
  outcomes: OutcomeSummaryResult,
  digest:   Awaited<ReturnType<typeof buildDigestContent>>,
): DailyBriefActionItem[] {
  const items: DailyBriefActionItem[] = [];
  let seq = 0;

  // Scale opportunities from outcomes
  for (const h of outcomes.highlights.filter((h) => h.type === "scale_opportunity")) {
    items.push({
      id:          `action_scale_${seq++}`,
      label:       "Review scale plan",
      description: h.title,
      priority:    "high",
      readiness:   h.isBlocker ? "blocked" : "ready",
      category:    "scale",
      clientName:  h.clientAccountId,
      href:        h.href,
      blockerNote: h.isBlocker ? "Pending action required before scaling" : null,
    });
  }

  // Refresh opportunities from outcomes
  for (const h of outcomes.highlights.filter((h) => h.type === "refresh_needed")) {
    items.push({
      id:          `action_refresh_${seq++}`,
      label:       "Send to Creative Lab",
      description: h.title,
      priority:    "medium",
      readiness:   h.isBlocker ? "blocked" : "ready",
      category:    "refresh",
      clientName:  h.clientAccountId,
      href:        "/creative-lab",
      blockerNote: h.isBlocker ? "Pending action required" : null,
    });
  }

  // Retest opportunities from outcomes
  for (const h of outcomes.highlights.filter((h) => h.type === "retest_needed")) {
    items.push({
      id:          `action_retest_${seq++}`,
      label:       "Create follow-up test",
      description: h.title,
      priority:    "medium",
      readiness:   "ready",
      category:    "retest",
      clientName:  h.clientAccountId,
      href:        "/creative-lab/launch",
      blockerNote: null,
    });
  }

  // Critical/at-risk clients
  for (const c of exec.clients.filter((c) => c.status === "critical" || c.status === "at_risk")) {
    const priority: DailyBriefActionPriority = c.status === "critical" ? "critical" : "high";
    items.push({
      id:          `action_client_${seq++}`,
      label:       c.status === "critical" ? "Investigate immediately" : "Review account",
      description: `${c.clientName}: ${c.status === "critical" ? "Critical" : "At risk"} — ROAS ${c.roas?.toFixed(2) ?? "N/A"}`,
      priority,
      readiness:   c.hasStaleSync ? "blocked" : "needs_review",
      category:    "alert",
      clientName:  c.clientName,
      href:        c.href,
      blockerNote: c.hasStaleSync ? "Stale sync — data may be unreliable" : null,
    });
  }

  // Pacing issues from digest
  for (const p of digest.pacingIssues) {
    items.push({
      id:          `action_pacing_${seq++}`,
      label:       "Fix pacing",
      description: `${p.label}: ${p.detail}`,
      priority:    "medium",
      readiness:   "ready",
      category:    "pacing",
      clientName:  p.client,
      href:        "/pacing",
      blockerNote: null,
    });
  }

  // Sort: critical → high → medium → low
  const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

  return items.slice(0, 20);
}

// ── Summary builder ─────────────────────────────────────────────────────────

function buildBriefSummary(
  exec:     Awaited<ReturnType<typeof buildDailyExecutiveSummary>>,
  winners:  DailyBriefWinner[],
  losers:   DailyBriefLoser[],
  blocked:  DailyBriefBlockedItem[],
  actions:  DailyBriefActionItem[],
): DailyBriefSummary {
  const { portfolio } = exec;

  // Build top-line message
  const parts: string[] = [];
  if (portfolio.criticalCount > 0) {
    parts.push(`${portfolio.criticalCount} critical`);
  }
  if (portfolio.atRiskCount > 0) {
    parts.push(`${portfolio.atRiskCount} at risk`);
  }
  if (winners.length > 0) {
    const scaleReady = winners.filter((w) => w.scaleReady).length;
    parts.push(scaleReady > 0 ? `${scaleReady} ready to scale` : `${winners.length} winners`);
  }
  if (losers.length > 0) {
    parts.push(`${losers.length} need refresh`);
  }

  const topLineMessage = parts.length > 0
    ? parts.join(", ")
    : exec.noDataYesterday
      ? "No data from yesterday. Check sync status."
      : "All accounts stable. No urgent actions.";

  return {
    totalAccounts:  portfolio.totalClients,
    accountsAtRisk: portfolio.atRiskCount + portfolio.criticalCount,
    accountsScaling: portfolio.scalingCount,
    totalSpend:     portfolio.totalSpend,
    totalRevenue:   portfolio.totalRevenue,
    blendedRoas:    portfolio.blendedRoas,
    blendedCpa:     portfolio.blendedCpa,
    winnersCount:   winners.length,
    losersCount:    losers.length,
    blockedCount:   blocked.length,
    actionCount:    actions.length,
    topLineMessage,
  };
}
