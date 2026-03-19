// lib/experiments/db.ts
// DB persistence layer for experiment records, results, and learnings.
// No business logic — all computation lives in builder/comparator/detector/learnings.

import { prisma }            from "../db";
import type {
  ExperimentPlan,
  ExperimentResult,
  ExperimentLearning,
  ExperimentWithResult,
  ExperimentListSummary,
  ExperimentStatus,
  ExperimentOutcome,
  ExperimentMetricSnapshot,
  ExperimentComparison,
  ExperimentEvaluationWindow,
}                            from "../../types/experiment";
import { buildEvaluationWindow } from "./builder";

// ---------------------------------------------------------------------------
// Save a new experiment plan
// ---------------------------------------------------------------------------

export async function saveExperimentPlan(
  plan: Omit<ExperimentPlan, "createdAt" | "updatedAt">,
): Promise<void> {
  await prisma.experimentRecord.create({
    data: {
      id:              plan.id,
      clientAccountId: plan.clientAccountId,
      campaignId:      plan.campaignId,
      name:            plan.name,
      description:     plan.description,
      status:          plan.status,
      comparisonMode:  plan.comparisonMode,
      // Control
      controlCreativeId:        plan.controlCreativeId,
      controlAdExternalId:      plan.controlAdExternalId,
      controlAdSetExternalId:   plan.controlAdSetExternalId,
      controlCampaignExternalId: plan.controlCampaignExternalId,
      controlLabel:             plan.controlLabel,
      // Challenger
      challengerPrepItemId:       plan.challengerPrepItemId,
      challengerAdExternalId:     plan.challengerAdExternalId,
      challengerAdSetExternalId:  plan.challengerAdSetExternalId,
      challengerCampaignExternalId: plan.challengerCampaignExternalId,
      challengerLabel:            plan.challengerLabel,
      // Shared
      externalAdAccountId: plan.externalAdAccountId,
      // Criteria
      primaryMetric:            plan.primaryMetric,
      secondaryMetrics:         plan.secondaryMetrics.length > 0 ? JSON.stringify(plan.secondaryMetrics) : null,
      successThreshold:         plan.successThreshold,
      minSpendPerVariant:       plan.minSpendPerVariant,
      minConversionsPerVariant: plan.minConversionsPerVariant,
      evaluationWindowDays:     plan.evaluationWindowDays,
      // Timeline
      startedAt:        plan.startedAt ? new Date(plan.startedAt) : new Date(),
      evaluationEndsAt: plan.evaluationEndsAt ? new Date(plan.evaluationEndsAt) : null,
      completedAt:      plan.completedAt ? new Date(plan.completedAt) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Upsert an experiment result (one result per experiment)
// ---------------------------------------------------------------------------

export async function upsertExperimentResult(
  result: Omit<ExperimentResult, "id">,
): Promise<void> {
  await prisma.experimentResultRecord.upsert({
    where:  { experimentId: result.experimentId },
    update: {
      outcome:               result.outcome,
      winningVariant:        result.winningVariant,
      confidence:            result.confidence,
      controlSnapshotJson:   result.controlSnapshot    ? JSON.stringify(result.controlSnapshot)    : null,
      challengerSnapshotJson: result.challengerSnapshot ? JSON.stringify(result.challengerSnapshot) : null,
      primaryMetricDelta:    result.primaryMetricDelta,
      primaryMetricLift:     result.primaryMetricLift,
      guardrailBreaches:     JSON.stringify(result.guardrailBreaches),
      outcomeReasons:        JSON.stringify(result.outcomeReasons),
      recommendedAction:     result.recommendedAction,
      recommendedNote:       result.recommendedNote,
      learningSummary:       result.learningSummary,
      evaluatedAt:           new Date(result.evaluatedAt),
    },
    create: {
      experimentId:          result.experimentId,
      outcome:               result.outcome,
      winningVariant:        result.winningVariant,
      confidence:            result.confidence,
      controlSnapshotJson:   result.controlSnapshot    ? JSON.stringify(result.controlSnapshot)    : null,
      challengerSnapshotJson: result.challengerSnapshot ? JSON.stringify(result.challengerSnapshot) : null,
      primaryMetricDelta:    result.primaryMetricDelta,
      primaryMetricLift:     result.primaryMetricLift,
      guardrailBreaches:     JSON.stringify(result.guardrailBreaches),
      outcomeReasons:        JSON.stringify(result.outcomeReasons),
      recommendedAction:     result.recommendedAction,
      recommendedNote:       result.recommendedNote,
      learningSummary:       result.learningSummary,
      evaluatedAt:           new Date(result.evaluatedAt),
    },
  });

  // Update experiment status
  const newStatus: ExperimentStatus = result.outcome === "archived" ? "archived"
    : result.outcome === "failed_test" ? "failed"
    : "completed";

  await prisma.experimentRecord.update({
    where: { id: result.experimentId },
    data:  { status: newStatus, completedAt: new Date(), updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Save learnings from a completed experiment
// ---------------------------------------------------------------------------

export async function saveExperimentLearnings(
  learnings: Omit<ExperimentLearning, "id" | "createdAt">[],
): Promise<void> {
  if (learnings.length === 0) return;
  await prisma.experimentLearningRecord.createMany({
    data: learnings.map((l) => ({
      experimentId:    l.experimentId,
      clientAccountId: l.clientAccountId,
      briefIntent:     l.briefIntent,
      draftType:       l.draftType,
      winningPattern:  l.winningPattern,
      outcomeLabel:    l.outcomeLabel,
      insightText:     l.insightText,
      detailJson:      l.detail ? JSON.stringify(l.detail) : null,
      usableForBriefs:  l.usableForBriefs,
      usableForScoring: l.usableForScoring,
    })),
  });
}

// ---------------------------------------------------------------------------
// Load experiments list
// ---------------------------------------------------------------------------

export async function loadExperiments(opts: {
  clientAccountId?: string;
  status?:          ExperimentStatus;
  limit?:           number;
}): Promise<ExperimentPlan[]> {
  const rows = await prisma.experimentRecord.findMany({
    where: {
      ...(opts.clientAccountId ? { clientAccountId: opts.clientAccountId } : {}),
      ...(opts.status          ? { status: opts.status }                    : {}),
    },
    orderBy: { createdAt: "desc" },
    take:    opts.limit ?? 50,
  });
  return rows.map(rowToPlan);
}

// ---------------------------------------------------------------------------
// Load a single experiment with result + learnings
// ---------------------------------------------------------------------------

export async function loadExperimentById(id: string): Promise<ExperimentWithResult | null> {
  const row = await prisma.experimentRecord.findUnique({
    where:   { id },
    include: {
      results:   true,
      learnings: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) return null;

  const plan   = rowToPlan(row);
  const result = row.results[0] ? rowToResult(row.results[0]) : null;
  const learnings = row.learnings.map(rowToLearning);
  const evalWindow = buildEvaluationWindow(plan.startedAt, plan.evaluationWindowDays, plan.evaluationEndsAt);

  return { ...plan, result, learnings, evaluationWindow: evalWindow };
}

// ---------------------------------------------------------------------------
// Update experiment status
// ---------------------------------------------------------------------------

export async function updateExperimentStatus(
  id:     string,
  status: ExperimentStatus,
): Promise<void> {
  await prisma.experimentRecord.update({
    where: { id },
    data:  { status, updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Load learnings for Creative Lab reuse
// ---------------------------------------------------------------------------

export async function loadExperimentLearnings(opts: {
  clientAccountId?: string;
  briefIntent?:     string;
  usableForBriefs?: boolean;
  limit?:           number;
}): Promise<ExperimentLearning[]> {
  const rows = await prisma.experimentLearningRecord.findMany({
    where: {
      ...(opts.clientAccountId  ? { clientAccountId: opts.clientAccountId }     : {}),
      ...(opts.briefIntent      ? { briefIntent: opts.briefIntent }              : {}),
      ...(opts.usableForBriefs  ? { usableForBriefs: opts.usableForBriefs }      : {}),
    },
    orderBy: { createdAt: "desc" },
    take:    opts.limit ?? 20,
  });
  return rows.map(rowToLearning);
}

// ---------------------------------------------------------------------------
// Build summary counts
// ---------------------------------------------------------------------------

export async function buildExperimentSummary(
  clientAccountId?: string,
): Promise<ExperimentListSummary> {
  const where = clientAccountId ? { clientAccountId } : {};

  const [statusCounts, outcomeCounts] = await Promise.all([
    prisma.experimentRecord.groupBy({
      by:    ["status"],
      where,
      _count: { status: true },
    }),
    prisma.experimentResultRecord.groupBy({
      by:    ["outcome"],
      where: { experiment: where },
      _count: { outcome: true },
    }),
  ]);

  const s: Record<string, number> = {};
  for (const r of statusCounts)  s[r.status]  = r._count.status;
  const o: Record<string, number> = {};
  for (const r of outcomeCounts) o[r.outcome] = r._count.outcome;

  const total = Object.values(s).reduce((a, b) => a + b, 0);
  return {
    total,
    active:         s["active"]     ?? 0,
    completed:      s["completed"]  ?? 0,
    challengerWins: o["challenger_wins"] ?? 0,
    controlHolds:   o["control_holds"]   ?? 0,
    noWinner:       (o["no_clear_winner"] ?? 0) + (o["mixed_result"] ?? 0),
    insufficient:   o["insufficient_data"] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Row → domain type helpers
// ---------------------------------------------------------------------------

type ExperimentRow = {
  id: string; clientAccountId: string; campaignId: string | null;
  name: string; description: string | null; status: string; comparisonMode: string;
  controlCreativeId: string | null; controlAdExternalId: string | null;
  controlAdSetExternalId: string | null; controlCampaignExternalId: string | null; controlLabel: string;
  challengerPrepItemId: string | null; challengerAdExternalId: string | null;
  challengerAdSetExternalId: string | null; challengerCampaignExternalId: string | null; challengerLabel: string;
  externalAdAccountId: string | null;
  primaryMetric: string; secondaryMetrics: string | null; successThreshold: number;
  minSpendPerVariant: number; minConversionsPerVariant: number; evaluationWindowDays: number;
  startedAt: Date; evaluationEndsAt: Date | null; completedAt: Date | null;
  createdAt: Date; updatedAt: Date;
};

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function rowToPlan(row: ExperimentRow): ExperimentPlan {
  return {
    id: row.id, clientAccountId: row.clientAccountId, campaignId: row.campaignId,
    name: row.name, description: row.description, status: row.status as ExperimentStatus,
    comparisonMode: row.comparisonMode as ExperimentPlan["comparisonMode"],
    controlCreativeId: row.controlCreativeId, controlAdExternalId: row.controlAdExternalId,
    controlAdSetExternalId: row.controlAdSetExternalId, controlCampaignExternalId: row.controlCampaignExternalId,
    controlLabel: row.controlLabel,
    challengerPrepItemId: row.challengerPrepItemId, challengerAdExternalId: row.challengerAdExternalId,
    challengerAdSetExternalId: row.challengerAdSetExternalId, challengerCampaignExternalId: row.challengerCampaignExternalId,
    challengerLabel: row.challengerLabel, externalAdAccountId: row.externalAdAccountId,
    primaryMetric: row.primaryMetric, secondaryMetrics: safeParse<string[]>(row.secondaryMetrics, []),
    successThreshold: row.successThreshold, minSpendPerVariant: row.minSpendPerVariant,
    minConversionsPerVariant: row.minConversionsPerVariant, evaluationWindowDays: row.evaluationWindowDays,
    startedAt: row.startedAt.toISOString(), evaluationEndsAt: row.evaluationEndsAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

type ResultRow = {
  id: string; experimentId: string; outcome: string; winningVariant: string | null;
  confidence: number; controlSnapshotJson: string | null; challengerSnapshotJson: string | null;
  primaryMetricDelta: number | null; primaryMetricLift: number | null;
  guardrailBreaches: string | null; outcomeReasons: string | null;
  recommendedAction: string | null; recommendedNote: string | null;
  learningSummary: string | null; evaluatedAt: Date;
};

function rowToResult(row: ResultRow): ExperimentResult {
  return {
    id: row.id, experimentId: row.experimentId,
    outcome: row.outcome as ExperimentOutcome,
    winningVariant: row.winningVariant as "control" | "challenger" | null,
    confidence: row.confidence,
    controlSnapshot:    safeParse<ExperimentMetricSnapshot | null>(row.controlSnapshotJson, null),
    challengerSnapshot: safeParse<ExperimentMetricSnapshot | null>(row.challengerSnapshotJson, null),
    comparison: null,  // not stored in DB — recomputed in UI if needed
    primaryMetricDelta: row.primaryMetricDelta,
    primaryMetricLift:  row.primaryMetricLift,
    guardrailBreaches:  safeParse<string[]>(row.guardrailBreaches, []),
    outcomeReasons:     safeParse<string[]>(row.outcomeReasons, []),
    recommendedAction: row.recommendedAction,
    recommendedNote:   row.recommendedNote,
    learningSummary:   row.learningSummary,
    evaluatedAt: row.evaluatedAt.toISOString(),
  };
}

type LearningRow = {
  id: string; experimentId: string; clientAccountId: string;
  briefIntent: string | null; draftType: string | null; winningPattern: string | null;
  outcomeLabel: string; insightText: string; detailJson: string | null;
  usableForBriefs: boolean; usableForScoring: boolean; createdAt: Date;
};

function rowToLearning(row: LearningRow): ExperimentLearning {
  return {
    id: row.id, experimentId: row.experimentId, clientAccountId: row.clientAccountId,
    briefIntent: row.briefIntent, draftType: row.draftType, winningPattern: row.winningPattern,
    outcomeLabel: row.outcomeLabel, insightText: row.insightText,
    detail: safeParse<Record<string, unknown>>(row.detailJson, {}),
    usableForBriefs: row.usableForBriefs, usableForScoring: row.usableForScoring,
    createdAt: row.createdAt.toISOString(),
  };
}
