// ─── Learning Memory — Source Extractors ─────────────────────────────────────
//
// Four extractors pull from existing DB tables and normalize to LearningMemoryEntry.
// Each runs independently and returns a typed array. No two extractors share DB
// state. No existing lib modules are modified — this is additive only.

import { prisma } from "../db";
import type {
  LearningMemoryEntry,
  LearningCategory,
  LearningConfidence,
  LearningSignal,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

/** Maps an experiment winningPattern label to a LearningCategory. */
function patternToCategory(winningPattern: string | null, outcomeLabel: string): LearningCategory {
  if (winningPattern === "high_roas_angle")       return "winning_angle";
  if (winningPattern === "high_ctr_hook")         return "winning_hook";
  if (winningPattern === "low_cpa_conversion")    return "winning_offer_framing";
  if (outcomeLabel    === "control_holds")        return "experiment_pattern";
  if (outcomeLabel    === "no_clear_winner")      return "experiment_pattern";
  if (outcomeLabel    === "insufficient_data")    return "experiment_pattern";
  return "experiment_pattern";
}

/** Determines confidence from an experiment outcome label. */
function experimentConfidence(outcomeLabel: string): LearningConfidence {
  if (outcomeLabel === "challenger_wins" || outcomeLabel === "control_holds") return "high";
  if (outcomeLabel === "no_clear_winner" || outcomeLabel === "mixed_result")  return "medium";
  return "low";
}

/** Parses the detailJson from ExperimentLearningRecord for evidence signals. */
function parseExperimentEvidence(detailJson: string | null): LearningSignal[] {
  if (!detailJson) return [];
  try {
    const d = JSON.parse(detailJson) as Record<string, unknown>;
    const signals: LearningSignal[] = [];
    if (typeof d.primaryMetricLift === "number") {
      const lift = (d.primaryMetricLift as number) * 100;
      signals.push({
        label:     "ROAS lift vs control",
        value:     `${lift >= 0 ? "+" : ""}${lift.toFixed(1)}%`,
        direction: lift >= 0 ? "positive" : "negative",
      });
    }
    if (typeof d.challengerRoas === "number") {
      signals.push({
        label:     "Challenger ROAS",
        value:     `${(d.challengerRoas as number).toFixed(2)}x`,
        direction: (d.challengerRoas as number) >= 1.5 ? "positive" : "neutral",
      });
    }
    if (typeof d.controlRoas === "number") {
      signals.push({
        label:     "Control ROAS",
        value:     `${(d.controlRoas as number).toFixed(2)}x`,
        direction: "neutral",
      });
    }
    return signals;
  } catch {
    return [];
  }
}

// ── 1. Experiment learnings ───────────────────────────────────────────────────

export async function extractExperimentLearnings(filters: {
  clientId?: string;
  dateFrom?: string;
  dateTo?:   string;
  limit?:    number;
}): Promise<LearningMemoryEntry[]> {
  const { clientId, dateFrom, dateTo, limit = 100 } = filters;

  const rows = await prisma.experimentLearningRecord.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom ? { gte: new Date(dateFrom + "T00:00:00") } : {}),
          ...(dateTo   ? { lte: new Date(dateTo   + "T23:59:59") } : {}),
        },
      } : {}),
    },
    include: {
      experiment: { select: { id: true, name: true, campaignId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (rows.length === 0) return [];

  // Bulk-fetch client names
  const clientIds = [...new Set(rows.map((r) => r.clientAccountId))];
  const clients   = await prisma.clientAccount.findMany({
    where:  { id: { in: clientIds } },
    select: { id: true, name: true },
  });
  const clientMap: Record<string, string> = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  return rows.map((r): LearningMemoryEntry => ({
    id:           `exp-${r.id}`,
    sourceType:   "experiment_outcome",
    category:     patternToCategory(r.winningPattern, r.outcomeLabel),
    confidence:   experimentConfidence(r.outcomeLabel),
    clientId:     r.clientAccountId,
    clientName:   clientMap[r.clientAccountId] ?? "Unknown",
    campaignId:   r.experiment.campaignId ?? null,
    campaignName: null, // not stored on this record
    insightText:  r.insightText,
    pattern:      r.winningPattern ?? r.outcomeLabel,
    evidence:     parseExperimentEvidence(r.detailJson),
    relatedEntities: [
      { type: "experiment", id: r.experiment.id, label: r.experiment.name },
    ],
    usableForBriefs:  r.usableForBriefs,
    usableForScoring: r.usableForScoring,
    createdAt:    r.createdAt.toISOString(),
    periodFrom:   null,
    periodTo:     null,
  }));
}

// ── 2. Campaign performance learnings ─────────────────────────────────────────

export async function extractCampaignPerformanceLearnings(filters: {
  clientId?: string;
  dateFrom?: string;
  dateTo?:   string;
  limit?:    number;
}): Promise<LearningMemoryEntry[]> {
  const { clientId, dateFrom = daysAgo(90), dateTo, limit = 60 } = filters;

  // Fetch reconciled performance rows
  const perfRows = await prisma.reconciledCampaignPerformance.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      dateFrom: { gte: dateFrom },
      ...(dateTo ? { dateTo: { lte: dateTo } } : {}),
      calculatedRoas: { not: null },
    },
    orderBy: { dateFrom: "desc" },
    take: limit * 3, // fetch more, we'll filter
  });

  if (perfRows.length === 0) return [];

  // Aggregate per campaign
  type CampaignAgg = {
    clientAccountId: string;
    externalCampaignId: string;
    campaignName: string;
    roasValues: number[];
    totalSpend: number;
    periodFrom: string;
    periodTo: string;
  };

  const byId: Record<string, CampaignAgg> = {};
  for (const r of perfRows) {
    if (!byId[r.externalCampaignId]) {
      byId[r.externalCampaignId] = {
        clientAccountId:    r.clientAccountId,
        externalCampaignId: r.externalCampaignId,
        campaignName:       r.campaignName,
        roasValues:         [],
        totalSpend:         0,
        periodFrom:         r.dateFrom,
        periodTo:           r.dateTo,
      };
    }
    const agg = byId[r.externalCampaignId];
    if (r.calculatedRoas !== null) agg.roasValues.push(r.calculatedRoas);
    agg.totalSpend += r.metaSpend;
    if (r.dateFrom < agg.periodFrom) agg.periodFrom = r.dateFrom;
    if (r.dateTo   > agg.periodTo)   agg.periodTo   = r.dateTo;
  }

  // Bulk-fetch goals + client names
  const clientIds = [...new Set(Object.values(byId).map((a) => a.clientAccountId))];
  const [clients, goals] = await Promise.all([
    prisma.clientAccount.findMany({
      where:  { id: { in: clientIds } },
      select: { id: true, name: true },
    }),
    prisma.clientGoalDefaults.findMany({
      where:  { clientAccountId: { in: clientIds } },
      select: { clientAccountId: true, targetRoas: true, targetCpa: true },
    }).catch(() => [] as { clientAccountId: string; targetRoas: number | null; targetCpa: number | null }[]),
  ]);
  const clientMap: Record<string, string> = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const goalMap:   Record<string, { targetRoas: number | null }> = Object.fromEntries(
    goals.map((g) => [g.clientAccountId, { targetRoas: g.targetRoas }])
  );

  const entries: LearningMemoryEntry[] = [];

  for (const agg of Object.values(byId)) {
    if (agg.roasValues.length === 0) continue;
    const avgRoas    = agg.roasValues.reduce((s, v) => s + v, 0) / agg.roasValues.length;
    const targetRoas = goalMap[agg.clientAccountId]?.targetRoas ?? null;

    let category: LearningCategory;
    let insightText: string;
    let direction: "positive" | "negative";
    let conf: LearningConfidence;

    if (targetRoas !== null) {
      if (avgRoas >= 1.15 * targetRoas) {
        category    = "winning_angle";
        insightText = `${agg.campaignName} achieved ${avgRoas.toFixed(2)}x ROAS — ${Math.round((avgRoas / targetRoas - 1) * 100)}% above the ${targetRoas}x goal. Strong audience-message fit detected.`;
        direction   = "positive";
      } else if (avgRoas <= 0.80 * targetRoas) {
        category    = "poor_performer_pattern";
        insightText = `${agg.campaignName} averaged ${avgRoas.toFixed(2)}x ROAS — ${Math.round((1 - avgRoas / targetRoas) * 100)}% below the ${targetRoas}x goal. Review creative angles and audience targeting.`;
        direction   = "negative";
      } else {
        continue; // on-track campaigns are not a notable learning
      }
      conf = agg.roasValues.length >= 3 ? "high" : agg.roasValues.length >= 2 ? "medium" : "low";
    } else {
      // No goal set — only surface extreme performers
      if (avgRoas >= 3.5) {
        category    = "audience_message_fit";
        insightText = `${agg.campaignName} achieved ${avgRoas.toFixed(2)}x ROAS with no goal set. This may represent a strong message-audience fit worth preserving.`;
        direction   = "positive";
        conf        = agg.roasValues.length >= 2 ? "medium" : "low";
      } else if (avgRoas < 0.8) {
        category    = "poor_performer_pattern";
        insightText = `${agg.campaignName} averaged ${avgRoas.toFixed(2)}x ROAS. Spend of ${fmt(agg.totalSpend)} generated below-breakeven returns. Creative refresh may be warranted.`;
        direction   = "negative";
        conf        = agg.roasValues.length >= 2 ? "medium" : "low";
      } else {
        continue;
      }
    }

    entries.push({
      id:           `perf-${agg.externalCampaignId}-${agg.periodFrom}`,
      sourceType:   "creative_outcome",
      category,
      confidence:   conf,
      clientId:     agg.clientAccountId,
      clientName:   clientMap[agg.clientAccountId] ?? "Unknown",
      campaignId:   agg.externalCampaignId,
      campaignName: agg.campaignName,
      insightText,
      pattern:      avgRoas >= (targetRoas ?? 2) ? "strong_campaign_roas" : "weak_campaign_roas",
      evidence: [
        { label: "Avg ROAS",  value: `${avgRoas.toFixed(2)}x`,          direction },
        { label: "Spend",     value: fmt(agg.totalSpend),                direction: "neutral" },
        { label: "Periods",   value: String(agg.roasValues.length),      direction: "neutral" },
        ...(targetRoas ? [{ label: "Goal ROAS", value: `${targetRoas}x`, direction: "neutral" as const }] : []),
      ],
      relatedEntities: [
        { type: "campaign", id: agg.externalCampaignId, label: agg.campaignName },
      ],
      usableForBriefs:  direction === "positive",
      usableForScoring: true,
      createdAt:    new Date().toISOString(),
      periodFrom:   agg.periodFrom,
      periodTo:     agg.periodTo,
    });
  }

  return entries.slice(0, limit);
}

// ── 2b. Image variation outcome learnings ────────────────────────────────────

const INTENT_TO_VISUAL_CATEGORY: Record<string, LearningCategory> = {
  refresh_visual_hook:    "winning_visual_hook",
  refresh_composition:    "winning_composition",
  refresh_color_direction: "winning_color_direction",
  refresh_product_focus:  "winning_product_focus",
  refresh_ugc_style:      "winning_ugc_style",
  refresh_offer_framing:  "winning_offer_framing",
  refresh_lifestyle_angle: "winning_angle",
  full_visual_reset:      "refresh_pattern",
};

export async function extractImageVariationLearnings(filters: {
  clientId?: string;
  dateFrom?: string;
  dateTo?:   string;
  limit?:    number;
}): Promise<LearningMemoryEntry[]> {
  const { clientId, dateFrom, dateTo, limit = 60 } = filters;

  // Load launched experiment launch plans with image variation challengers
  const plans = await prisma.experimentLaunchPlanRecord.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      readinessState: "launched",
      challengerVariantType: "image",
      ...(dateFrom ? { createdAt: { gte: new Date(dateFrom + "T00:00:00") } } : {}),
      ...(dateTo   ? { createdAt: { lte: new Date(dateTo   + "T23:59:59") } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id:                    true,
      name:                  true,
      clientAccountId:       true,
      challengerClientName:  true,
      challengerCampaignName: true,
      challengerVariantTitle: true,
      challengerBriefIntent: true,
      challengerBriefDraftType: true,
      controlLabel:          true,
      controlCreativeName:   true,
      hypothesis:            true,
      primaryMetric:         true,
      successThreshold:      true,
      targetCampaignExternalId: true,
      linkedExperimentId:    true,
      createdAt:             true,
      launchedAt:            true,
    },
  });

  if (plans.length === 0) return [];

  // Cross-reference with experiment results if available
  const experimentIds = plans.map((p) => p.linkedExperimentId).filter(Boolean) as string[];
  const results = experimentIds.length > 0
    ? await prisma.experimentResultRecord.findMany({
        where: { experimentId: { in: experimentIds } },
        select: {
          experimentId:     true,
          outcome:          true,
          winningVariant:   true,
          confidence:       true,
          primaryMetricLift: true,
        },
      })
    : [];
  const resultMap = new Map(results.map((r) => [r.experimentId, r]));

  const entries: LearningMemoryEntry[] = [];

  for (const plan of plans) {
    const result = plan.linkedExperimentId ? resultMap.get(plan.linkedExperimentId) : null;
    const intent = plan.challengerBriefIntent ?? "image_variation";

    // Determine category from intent + outcome
    let category: LearningCategory;
    let conf: LearningConfidence;
    let insightText: string;
    const clientName = plan.challengerClientName ?? "Unknown";
    const variantTitle = plan.challengerVariantTitle ?? "Image variation";

    if (result) {
      const outcome = result.outcome;
      const lift = result.primaryMetricLift ?? 0;
      const liftPct = (lift * 100).toFixed(1);

      if (outcome === "challenger_wins") {
        category = INTENT_TO_VISUAL_CATEGORY[intent] ?? "winning_visual_hook";
        conf = result.confidence >= 0.7 ? "high" : "medium";
        insightText = `Image variation "${variantTitle}" outperformed control with +${liftPct}% lift on ${plan.primaryMetric}. Visual direction: ${intent.replace(/_/g, " ")}.`;
      } else if (outcome === "control_holds") {
        category = "poor_performer_visual_pattern";
        conf = result.confidence >= 0.7 ? "high" : "medium";
        insightText = `Image variation "${variantTitle}" underperformed control (${liftPct}% lift). The ${intent.replace(/_/g, " ")} direction did not improve ${plan.primaryMetric} for ${clientName}.`;
      } else if (outcome === "no_clear_winner" || outcome === "mixed_result") {
        category = "experiment_pattern";
        conf = "medium";
        insightText = `Image variation test "${plan.name}" showed ${outcome.replace(/_/g, " ")} — no definitive winner between control and "${variantTitle}".`;
      } else {
        category = "experiment_pattern";
        conf = "low";
        insightText = `Image variation test "${plan.name}" resulted in ${outcome.replace(/_/g, " ")}. Insufficient data to draw conclusions.`;
      }
    } else {
      // No result yet — still a learning about launch patterns
      category = "launch_condition";
      conf = "low";
      insightText = `Image variation "${variantTitle}" was launched for testing (${intent.replace(/_/g, " ")}). Awaiting results.`;
    }

    const evidence: LearningSignal[] = [
      { label: "Visual direction", value: intent.replace(/_/g, " "), direction: "neutral" },
      { label: "Variant", value: variantTitle, direction: "neutral" },
    ];

    if (result) {
      const lift = result.primaryMetricLift ?? 0;
      evidence.push({
        label: `${plan.primaryMetric} lift`,
        value: `${lift >= 0 ? "+" : ""}${(lift * 100).toFixed(1)}%`,
        direction: lift > 0 ? "positive" : lift < 0 ? "negative" : "neutral",
      });
      evidence.push({
        label: "Confidence",
        value: `${((result.confidence ?? 0) * 100).toFixed(0)}%`,
        direction: (result.confidence ?? 0) >= 0.7 ? "positive" : "neutral",
      });
    }

    if (plan.hypothesis) {
      evidence.push({ label: "Hypothesis", value: plan.hypothesis.slice(0, 100), direction: "neutral" });
    }

    entries.push({
      id:           `imgvar-${plan.id}`,
      sourceType:   "image_variation_outcome",
      category,
      confidence:   conf,
      clientId:     plan.clientAccountId,
      clientName,
      campaignId:   plan.targetCampaignExternalId ?? null,
      campaignName: plan.challengerCampaignName ?? null,
      insightText,
      pattern:      intent,
      evidence,
      relatedEntities: [
        { type: "experiment_launch_plan", id: plan.id, label: plan.name },
        ...(plan.linkedExperimentId ? [{ type: "experiment", id: plan.linkedExperimentId, label: plan.name }] : []),
      ],
      usableForBriefs:  result?.outcome === "challenger_wins",
      usableForScoring: !!result,
      createdAt:    (plan.launchedAt ?? plan.createdAt).toISOString(),
      periodFrom:   (plan.launchedAt ?? plan.createdAt).toISOString().slice(0, 10),
      periodTo:     null,
    });
  }

  return entries.slice(0, limit);
}

// ── 3. Publish / launch outcome learnings ─────────────────────────────────────

const INTENT_TO_CATEGORY: Record<string, LearningCategory> = {
  preserve_winner_pattern:  "winning_angle",
  refresh_hook:             "refresh_pattern",
  refresh_angle:            "refresh_pattern",
  refresh_visual_direction: "refresh_pattern",
  full_reset:               "refresh_pattern",
};

const INTENT_LABEL: Record<string, string> = {
  preserve_winner_pattern:  "preserve winner",
  refresh_hook:             "hook refresh",
  refresh_angle:            "angle refresh",
  refresh_visual_direction: "visual refresh",
  full_reset:               "full creative reset",
};

export async function extractPublishLearnings(filters: {
  clientId?: string;
  dateFrom?: string;
  dateTo?:   string;
  limit?:    number;
}): Promise<LearningMemoryEntry[]> {
  const { clientId, dateFrom, dateTo, limit = 60 } = filters;

  const rows = await prisma.publishPrepRecord.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      publishedAt: { not: null },
      ...(dateFrom ? { publishedAt: { gte: new Date(dateFrom + "T00:00:00") } } : {}),
      ...(dateTo   ? { publishedAt: { lte: new Date(dateTo   + "T23:59:59") } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id:           true,
      variantTitle: true,
      variantType:  true,
      briefIntent:  true,
      clientAccountId: true,
      clientName:   true,
      campaignName: true,
      targetCampaignExternalId: true,
      publishedAt:  true,
    },
  });

  return rows.map((r): LearningMemoryEntry => {
    const category    = INTENT_TO_CATEGORY[r.briefIntent] ?? "launch_condition";
    const intentLabel = INTENT_LABEL[r.briefIntent] ?? r.briefIntent;
    return {
      id:           `pub-${r.id}`,
      sourceType:   "publish_outcome",
      category,
      confidence:   "low", // no post-launch outcome measurement yet
      clientId:     r.clientAccountId,
      clientName:   r.clientName,
      campaignId:   r.targetCampaignExternalId ?? null,
      campaignName: r.campaignName ?? null,
      insightText:  `A ${r.variantType} variant with ${intentLabel} intent was successfully launched for ${r.clientName}${r.campaignName ? ` (${r.campaignName})` : ""}.`,
      pattern:      r.briefIntent,
      evidence: [
        { label: "Variant type", value: r.variantType,    direction: "neutral" },
        { label: "Intent",       value: intentLabel,      direction: "neutral" },
        { label: "Published",    value: r.publishedAt?.toISOString().slice(0, 10) ?? "—", direction: "neutral" },
      ],
      relatedEntities: [
        { type: "creative", id: r.id, label: r.variantTitle },
      ],
      usableForBriefs:  category === "winning_angle",
      usableForScoring: false,
      createdAt:    r.publishedAt?.toISOString() ?? new Date().toISOString(),
      periodFrom:   r.publishedAt?.toISOString().slice(0, 10) ?? null,
      periodTo:     r.publishedAt?.toISOString().slice(0, 10) ?? null,
    };
  });
}

// ── 4. Automation / recommendation outcome learnings ──────────────────────────

const ACTION_TO_CATEGORY: Record<string, LearningCategory> = {
  pause_campaign:     "poor_performer_pattern",
  reduce_budget:      "poor_performer_pattern",
  increase_budget:    "winning_angle",
  review_creative:    "fatigue_pattern",
  refresh_creative:   "refresh_pattern",
  run_sync:           "experiment_pattern",
  investigate_client: "poor_performer_pattern",
};

export async function extractAutomationLearnings(filters: {
  clientId?: string;
  dateFrom?: string;
  dateTo?:   string;
  limit?:    number;
}): Promise<LearningMemoryEntry[]> {
  const { clientId, dateFrom, dateTo, limit = 40 } = filters;

  const rows = await prisma.proposedAutomationAction.findMany({
    where: {
      ...(clientId ? { clientAccountId: clientId } : {}),
      status: "executed",
      ...(dateFrom ? { proposedAt: { gte: new Date(dateFrom + "T00:00:00") } } : {}),
      ...(dateTo   ? { proposedAt: { lte: new Date(dateTo   + "T23:59:59") } } : {}),
    },
    orderBy: { proposedAt: "desc" },
    take: limit,
    select: {
      id:              true,
      actionType:      true,
      clientAccountId: true,
      clientName:      true,
      entityName:      true,
      rationale:       true,
      priority:        true,
      proposedAt:      true,
      approvedAt:      true,
    },
  });

  return rows.map((r): LearningMemoryEntry => {
    const category = ACTION_TO_CATEGORY[r.actionType] ?? "recommendation_outcome";
    const isPositive = ["increase_budget", "refresh_creative"].includes(r.actionType);
    return {
      id:           `auto-${r.id}`,
      sourceType:   "recommendation_outcome",
      category,
      confidence:   r.priority === "high" ? "medium" : "low",
      clientId:     r.clientAccountId,
      clientName:   r.clientName,
      campaignId:   null,
      campaignName: r.entityName,
      insightText:  `Automation: "${r.actionType.replace(/_/g, " ")}" was executed for ${r.entityName} (${r.clientName}). Rationale: ${r.rationale.slice(0, 120)}${r.rationale.length > 120 ? "…" : ""}`,
      pattern:      r.actionType,
      evidence: [
        { label: "Action type", value: r.actionType.replace(/_/g, " "), direction: isPositive ? "positive" : "negative" },
        { label: "Priority",    value: r.priority,                       direction: "neutral" },
        { label: "Entity",      value: r.entityName,                     direction: "neutral" },
      ],
      relatedEntities: [
        { type: "automation", id: r.id, label: `${r.actionType} — ${r.entityName}` },
      ],
      usableForBriefs:  ["review_creative", "refresh_creative"].includes(r.actionType),
      usableForScoring: true,
      createdAt:    r.proposedAt.toISOString(),
      periodFrom:   r.proposedAt.toISOString().slice(0, 10),
      periodTo:     (r.approvedAt ?? r.proposedAt).toISOString().slice(0, 10),
    };
  });
}
