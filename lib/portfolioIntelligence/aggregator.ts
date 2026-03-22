// ─── Portfolio Intelligence — Aggregator ──────────────────────────────────────
//
// Server-only. Composes existing data sources into a unified priority queue.
// No new Prisma queries — reuses existing aggregators.
//
// Data sources:
//   1. buildDailyExecutiveSummary() → per-client status, trend, scale readiness
//   2. buildDailyOutcomeSummary()   → winners, losers, tests
//   3. buildActionHistoryTimeline() → blocked/failed actions
//   4. buildPortfolioPayload()      → health board, risks, opportunities
//
// Output: PortfolioIntelligenceSummary with unified priority queue.

import { buildDailyExecutiveSummary }  from "../dailySummary/aggregator";
import { buildDailyOutcomeSummary }    from "../dailyOutcomes/aggregator";
import { buildActionHistoryTimeline }  from "../actionHistory/aggregator";
import type { PortfolioHealthBoardItem } from "../portfolio/types";
import { buildPortfolioPayload }       from "../portfolio/aggregator";
import {
  computePortfolioPriorityScore,
  determineCategory,
  type ScoringInput,
} from "./scoring";
import type {
  PortfolioIntelligenceSummary,
  PortfolioPriorityItem,
  PortfolioScaleCandidate,
  PortfolioDeclineSignal,
  PortfolioBlocker,
  PortfolioOpportunity,
  PortfolioRisk,
  PortfolioIntelligenceEvidence,
  PortfolioActionSuggestion,
} from "../../types/portfolioIntelligence";

// ── Main aggregator ─────────────────────────────────────────────────────────

export async function buildPortfolioIntelligenceSummary(opts: {
  workspaceId: string | null;
}): Promise<PortfolioIntelligenceSummary> {
  const { workspaceId } = opts;
  const warnings: string[] = [];
  const inputSources: string[] = [];

  // Fetch all data sources in parallel
  const [execResult, outcomesResult, actionsResult, portfolioResult] = await Promise.allSettled([
    buildDailyExecutiveSummary({ workspaceId }),
    buildDailyOutcomeSummary({ limit: 100 }),
    buildActionHistoryTimeline({
      workspaceId,
      dateFrom: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
      limit: 200,
    }),
    buildPortfolioPayload({ workspaceId }),
  ]);

  const exec = execResult.status === "fulfilled" ? execResult.value : null;
  if (exec) inputSources.push("daily_executive_summary");
  else warnings.push("Executive summary unavailable.");

  const outcomes = outcomesResult.status === "fulfilled" ? outcomesResult.value : null;
  if (outcomes) inputSources.push("daily_outcomes");
  else warnings.push("Outcome data unavailable.");

  const actions = actionsResult.status === "fulfilled" ? actionsResult.value : [];
  if (actions.length > 0) inputSources.push("action_history");

  const portfolio = portfolioResult.status === "fulfilled" ? portfolioResult.value : null;
  if (portfolio) inputSources.push("portfolio_health");
  else warnings.push("Portfolio health data unavailable.");

  // ── Build per-client outcome/action lookup maps ──────────────────────────

  // Winners and losers per client
  const winnersPerClient = new Set<string>();
  const losersPerClient  = new Set<string>();
  const testPerClient    = new Set<string>();
  const blockerHighlights: Array<{ clientId: string; title: string; subtitle: string; href: string }> = [];

  if (outcomes) {
    for (const h of outcomes.highlights) {
      if (h.type === "winner" || h.type === "scale_opportunity") winnersPerClient.add(h.clientAccountId);
      if (h.type === "loser" || h.type === "refresh_needed") losersPerClient.add(h.clientAccountId);
      if (h.type === "retest_needed") testPerClient.add(h.clientAccountId);
      if (h.isBlocker) {
        blockerHighlights.push({
          clientId: h.clientAccountId,
          title:    h.title,
          subtitle: h.subtitle,
          href:     h.href,
        });
      }
    }
  }

  // Blocked/failed actions per client
  const blockedActionsByClient = new Set<string>();
  const blockedActionItems: Array<{ clientId: string; clientName: string; title: string; desc: string; href: string }> = [];

  for (const a of actions) {
    if (a.status === "blocked" || a.status === "failed") {
      if (a.clientId) {
        blockedActionsByClient.add(a.clientId);
        blockedActionItems.push({
          clientId:   a.clientId,
          clientName: a.clientName ?? "Unknown",
          title:      a.title,
          desc:       a.description,
          href:       a.href,
        });
      }
    }
  }

  // Portfolio health board lookup
  const healthByClient = new Map<string, PortfolioHealthBoardItem>();
  if (portfolio) {
    for (const h of portfolio.healthBoard) healthByClient.set(h.clientId, h);
  }

  // ── Build unified priority items ─────────────────────────────────────────

  const priorities: PortfolioPriorityItem[] = [];
  const scaleCandidates: PortfolioScaleCandidate[] = [];
  const declineSignals: PortfolioDeclineSignal[] = [];

  if (exec) {
    // Trust state applied to all items
    const trustState = exec.trustState;

    for (const client of exec.clients) {
      const health = healthByClient.get(client.clientId);

      const scoringInput: ScoringInput = {
        status:           client.status,
        trend:            client.trend,
        roas:             client.roas,
        roasGoal:         client.roasGoal,
        scaleReadiness:   client.scaleReadiness,
        alertCount:       client.alertCount,
        highAlertCount:   health?.highAlertCount ?? 0,
        hasStaleSync:     client.hasStaleSync,
        hasBlockedAction: blockedActionsByClient.has(client.clientId),
        hasPendingTest:   testPerClient.has(client.clientId),
        hasWinner:        winnersPerClient.has(client.clientId),
        hasLoser:         losersPerClient.has(client.clientId),
        hasEmergencyStop: health?.hasEmergencyStop ?? false,
        isRestricted:     health?.isRestricted ?? false,
      };

      const score    = computePortfolioPriorityScore(scoringInput);
      const category = determineCategory(scoringInput);

      // Skip low-signal monitor items to keep queue scannable
      if (category === "monitor" && score.total < 10) continue;

      const evidence = buildClientEvidence(client, health);
      const action   = buildClientAction(client, category);

      priorities.push({
        id:         `pi-${client.clientId}`,
        category,
        clientId:   client.clientId,
        clientName: client.clientName,
        title:      buildPriorityTitle(client.clientName, category),
        reason:     buildPriorityReason(client, category),
        score,
        evidence,
        action,
        isBlocked:  blockedActionsByClient.has(client.clientId) || (health?.hasEmergencyStop ?? false),
        isReady:    client.scaleReadiness === "ready" && !client.hasStaleSync,
        trustState,
        detectedAt: new Date().toISOString(),
      });

      // Scale candidates
      if (client.scaleReadiness === "ready" || client.scaleReadiness === "possible") {
        scaleCandidates.push({
          clientId:   client.clientId,
          clientName: client.clientName,
          roas:       client.roas,
          roasGoal:   client.roasGoal,
          trend:      client.trend,
          spend:      client.spend,
          readiness:  client.scaleReadiness,
          evidence,
          action:     { label: "Review scale plan", description: `${client.clientName} is ready to scale.`, href: `/clients/${client.clientId}/decision` },
        });
      }

      // Decline signals
      if (client.status === "at_risk" || client.status === "critical") {
        declineSignals.push({
          clientId:   client.clientId,
          clientName: client.clientName,
          roas:       client.roas,
          roasGoal:   client.roasGoal,
          trend:      client.trend,
          status:     client.status,
          alertCount: client.alertCount,
          evidence,
          action:     { label: "Investigate account", description: `${client.clientName} needs attention.`, href: `/clients/${client.clientId}/decision` },
        });
      }
    }
  }

  // Sort priority queue: highest score first
  priorities.sort((a, b) => b.score.total - a.score.total);

  // ── Build blockers ───────────────────────────────────────────────────────

  const blockers: PortfolioBlocker[] = [];

  for (const item of blockedActionItems.slice(0, 10)) {
    blockers.push({
      id:          `blocker-action-${item.clientId}-${blockers.length}`,
      clientId:    item.clientId,
      clientName:  item.clientName,
      blockerType: "action_blocked",
      title:       item.title,
      description: item.desc,
      action:      { label: "Resolve blocker", description: item.desc, href: item.href },
    });
  }

  for (const item of blockerHighlights.slice(0, 5)) {
    blockers.push({
      id:          `blocker-outcome-${item.clientId}-${blockers.length}`,
      clientId:    item.clientId,
      clientName:  item.clientId,
      blockerType: "outcome_pending",
      title:       item.title,
      description: item.subtitle,
      action:      { label: "Review outcome", description: item.subtitle, href: item.href },
    });
  }

  // ── Map portfolio opportunities and risks ────────────────────────────────

  const opportunities: PortfolioOpportunity[] = (portfolio?.opportunities ?? []).slice(0, 10).map((o) => ({
    id:              o.id,
    clientId:        o.clientId,
    clientName:      o.clientName,
    opportunityType: o.opportunityType,
    title:           o.title,
    description:     o.description,
    evidence:        [{ label: "Type", value: o.opportunityType.replace(/_/g, " "), source: "Portfolio health", direction: "positive" as const }],
    action:          { label: "View opportunity", description: o.description, href: o.href },
  }));

  const risks: PortfolioRisk[] = (portfolio?.risks ?? []).slice(0, 10).map((r) => ({
    id:          r.id,
    clientId:    r.clientId,
    clientName:  r.clientName,
    riskType:    r.riskType,
    title:       r.title,
    description: r.description,
    severity:    r.priority === "critical" ? "critical" as const : r.priority === "high" ? "high" as const : r.priority === "medium" ? "medium" as const : "low" as const,
    action:      { label: "Investigate risk", description: r.description, href: r.href },
  }));

  // ── Counts ───────────────────────────────────────────────────────────────

  const countByCategory = (cat: string) => priorities.filter((p) => p.category === cat).length;

  return {
    generatedAt:         new Date().toISOString(),
    totalAccounts:       exec?.clients.length ?? 0,
    priorities:          priorities.slice(0, 25),
    scaleCandidates:     scaleCandidates.slice(0, 10),
    declineSignals:      declineSignals.slice(0, 10),
    blockers:            blockers.slice(0, 10),
    opportunities,
    risks,
    scaleNowCount:       countByCategory("scale_now"),
    investigateNowCount: countByCategory("investigate_now"),
    refreshNeededCount:  countByCategory("refresh_needed"),
    testNeededCount:     countByCategory("test_needed"),
    blockedActionCount:  countByCategory("blocked_action"),
    monitorCount:        countByCategory("monitor"),
    inputSources,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

type ClientSummary = Awaited<ReturnType<typeof import("../dailySummary/aggregator").buildDailyExecutiveSummary>>["clients"][number];
type HealthItem = { healthScore: number; healthLabel: string; highAlertCount: number; hasEmergencyStop: boolean; isRestricted: boolean; pacingStatus: string; pacingPct: number | null } | undefined;

function buildClientEvidence(
  client: ClientSummary,
  health: HealthItem,
): PortfolioIntelligenceEvidence[] {
  const ev: PortfolioIntelligenceEvidence[] = [];

  if (client.roas !== null) {
    const dir = client.roasGoal && client.roas >= client.roasGoal ? "positive" : client.roasGoal && client.roas < client.roasGoal * 0.7 ? "negative" : "neutral";
    ev.push({ label: "ROAS", value: `${client.roas.toFixed(2)}×`, source: "CRM reconciliation", direction: dir as PortfolioIntelligenceEvidence["direction"] });
  }
  if (client.roasGoal !== null) {
    ev.push({ label: "ROAS goal", value: `${client.roasGoal.toFixed(2)}×`, source: "Client goals", direction: "neutral" });
  }
  ev.push({ label: "Trend", value: client.trend, source: "3-day trend", direction: client.trend === "up" ? "positive" : client.trend === "down" ? "negative" : "neutral" });
  ev.push({ label: "Status", value: client.status, source: "Performance engine", direction: client.status === "scaling" ? "positive" : client.status === "critical" ? "negative" : "neutral" });

  if (client.spend > 0) {
    ev.push({ label: "Spend", value: `$${client.spend.toLocaleString()}`, source: "Meta", direction: "neutral" });
  }
  if (client.alertCount > 0) {
    ev.push({ label: "Alerts", value: String(client.alertCount), source: "Alert system", direction: "negative" });
  }
  if (health?.pacingPct !== null && health?.pacingPct !== undefined) {
    ev.push({ label: "Pacing", value: `${Math.round(health.pacingPct)}%`, source: "Budget pacing", direction: health.pacingStatus === "on_pacing" ? "positive" : "negative" });
  }

  return ev;
}

function buildClientAction(
  client: ClientSummary,
  category: string,
): PortfolioActionSuggestion {
  const base = `/clients/${client.clientId}/decision`;

  switch (category) {
    case "scale_now":
      return { label: "Review scale plan", description: `${client.clientName} is performing above goal. Consider budget increase.`, href: base };
    case "investigate_now":
      return { label: "Investigate account", description: `${client.clientName} needs immediate attention.`, href: base };
    case "refresh_needed":
      return { label: "Open Creative Lab", description: `${client.clientName} has underperforming creatives.`, href: "/creative-lab" };
    case "test_needed":
      return { label: "Create follow-up test", description: `${client.clientName} has tests needing follow-up.`, href: "/creative-lab/launch" };
    case "blocked_action":
      return { label: "Resolve blocker", description: `${client.clientName} has blocked actions.`, href: "/history" };
    default:
      return { label: "Review account", description: `${client.clientName} — review current status.`, href: base };
  }
}

function buildPriorityTitle(clientName: string, category: string): string {
  switch (category) {
    case "scale_now":        return `${clientName} — Ready to Scale`;
    case "investigate_now":  return `${clientName} — Needs Investigation`;
    case "refresh_needed":   return `${clientName} — Creative Refresh Needed`;
    case "test_needed":      return `${clientName} — Follow-Up Test Needed`;
    case "blocked_action":   return `${clientName} — Blocked Action`;
    default:                 return `${clientName} — Monitor`;
  }
}

function buildPriorityReason(client: ClientSummary, category: string): string {
  const roasStr = client.roas !== null ? `ROAS ${client.roas.toFixed(2)}×` : "No ROAS data";
  const goalStr = client.roasGoal !== null ? ` (goal: ${client.roasGoal.toFixed(2)}×)` : "";

  switch (category) {
    case "scale_now":
      return `${roasStr}${goalStr} with ${client.trend} trend. Scale readiness: ${client.scaleReadiness}.`;
    case "investigate_now":
      return `${roasStr}${goalStr}. Status: ${client.status}, trend: ${client.trend}. ${client.alertCount} alert(s).`;
    case "refresh_needed":
      return `Underperforming creatives detected. ${roasStr}${goalStr}.`;
    case "test_needed":
      return `Mixed test results need follow-up. ${roasStr}${goalStr}.`;
    case "blocked_action":
      return `Blocked or failed actions require attention. ${roasStr}${goalStr}.`;
    default:
      return `${roasStr}${goalStr}. Trend: ${client.trend}. Status: ${client.status}.`;
  }
}
