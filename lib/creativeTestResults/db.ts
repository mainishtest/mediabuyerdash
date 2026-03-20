// lib/creativeTestResults/db.ts
// DB persistence layer for creative test results and lifecycle links.
// No business logic — all computation lives in evaluator/lifecycle/ingestor.

import { prisma } from "../db";
import type {
  CreativeTestResult,
  CreativeTestResultSummary,
  CreativeTestTrackingState,
  CreativeTestOutcome,
  CreativeTestMetricSnapshot,
  CreativeTestComparison,
  CreativeTestEvaluationWindow,
  CreativeTestConfidence,
  CreativeTestOutcomeReason,
  CreativeLifecycleResultLink,
  CreateCreativeTestResultInput,
} from "../../types/creativeTestResults";
import { buildTestEvaluationWindow, computeCreativeTestConfidence } from "./evaluator";
import { buildRecommendedNextStep } from "./lifecycle";

// ---------------------------------------------------------------------------
// Type alias for the DB record shape
// ---------------------------------------------------------------------------

type TestResultRecord = {
  id:               string;
  clientAccountId:  string;
  name:             string;
  trackingState:    string;
  outcome:          string | null;
  launchPlanId:     string | null;
  experimentId:     string | null;
  prepItemId:       string | null;
  briefId:          string | null;
  controlCreativeId:         string | null;
  controlCreativeName:       string | null;
  controlAdExternalId:       string | null;
  challengerVariantTitle:    string | null;
  challengerAdExternalId:    string | null;
  clientName:                string | null;
  campaignName:              string | null;
  adSetName:                 string | null;
  externalAdAccountId:       string | null;
  targetCampaignExternalId:  string | null;
  targetAdSetExternalId:     string | null;
  primaryMetric:             string;
  successThreshold:          number;
  evaluationWindowDays:      number;
  minSpendPerVariant:        number;
  minConversionsPerVariant:  number;
  controlSnapshotJson:       string | null;
  challengerSnapshotJson:    string | null;
  primaryMetricDelta:        number | null;
  primaryMetricLift:         number | null;
  guardrailBreaches:         string | null;
  outcomeReasons:            string | null;
  confidence:                number | null;
  winningVariant:            string | null;
  windowStartedAt:           Date | null;
  windowEndsAt:              Date | null;
  isWindowComplete:          boolean;
  recommendedNextStep:       string | null;
  markedForReview:           boolean;
  archivedAt:                Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LifecycleLinkRecord = {
  id:              string;
  testResultId:    string;
  clientAccountId: string;
  prepItemId:      string | null;
  briefId:         string | null;
  variantId:       string | null;
  launchPlanId:    string | null;
  experimentId:    string | null;
  outcome:         string | null;
  winningRole:     string | null;
  confidence:      number | null;
  primaryLift:     number | null;
  attachedAt:      Date;
};

// ---------------------------------------------------------------------------
// Helper: safe JSON parse
// ---------------------------------------------------------------------------

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Map DB record → domain type
// ---------------------------------------------------------------------------

function mapRecord(r: TestResultRecord): CreativeTestResult {
  const controlSnapshot   = safeParse<CreativeTestMetricSnapshot | null>(r.controlSnapshotJson, null);
  const challengerSnapshot = safeParse<CreativeTestMetricSnapshot | null>(r.challengerSnapshotJson, null);
  const guardrailBreaches  = safeParse<string[]>(r.guardrailBreaches, []);
  const rawOutcomeReasons  = safeParse<string[]>(r.outcomeReasons, []);

  const outcomeReasons: CreativeTestOutcomeReason[] = rawOutcomeReasons.map((d, i) => ({
    key:         `reason_${i}`,
    label:       `Reason ${i + 1}`,
    description: d,
  }));

  // Reconstruct comparison from stored deltas if snapshots exist
  let comparison: CreativeTestComparison | null = null;
  if (r.primaryMetricDelta !== null && r.primaryMetricLift !== null) {
    comparison = {
      primaryMetric:             r.primaryMetric,
      primaryDelta:              r.primaryMetricDelta,
      primaryLift:               r.primaryMetricLift,
      secondaryDeltas:           {},
      guardrailBreaches,
      isStatisticallyMeaningful: Math.abs(r.primaryMetricLift) >= r.successThreshold,
      confidenceNote:            r.primaryMetricLift !== null
        ? `Lift: ${(r.primaryMetricLift * 100).toFixed(1)}%`
        : "No data",
    };
  }

  // Reconstruct evaluation window
  let evaluationWindow: CreativeTestEvaluationWindow | null = null;
  if (r.windowStartedAt) {
    evaluationWindow = buildTestEvaluationWindow(
      r.windowStartedAt.toISOString().split("T")[0],
      r.evaluationWindowDays,
      r.windowEndsAt ? r.windowEndsAt.toISOString().split("T")[0] : null,
    );
  }

  // Reconstruct confidence
  let confidence: CreativeTestConfidence | null = null;
  if (r.confidence !== null && r.outcome) {
    confidence = computeCreativeTestConfidence(
      r.confidence,
      r.isWindowComplete,
      r.outcome as CreativeTestOutcome,
    );
  }

  // Reconstruct recommended next step
  const recommendedNextStep = r.recommendedNextStep ?? buildRecommendedNextStep(
    r.outcome as CreativeTestOutcome | null,
    r.winningVariant as "control" | "challenger" | null,
    r.isWindowComplete,
    evaluationWindow?.daysRemaining ?? 0,
  );

  return {
    id:              r.id,
    clientAccountId: r.clientAccountId,
    name:            r.name,
    trackingState:   r.trackingState as CreativeTestTrackingState,
    outcome:         r.outcome as CreativeTestOutcome | null,
    launchPlanId:    r.launchPlanId,
    experimentId:    r.experimentId,
    prepItemId:      r.prepItemId,
    briefId:         r.briefId,
    controlCreativeId:        r.controlCreativeId,
    controlCreativeName:      r.controlCreativeName,
    controlAdExternalId:      r.controlAdExternalId,
    challengerVariantTitle:   r.challengerVariantTitle,
    challengerAdExternalId:   r.challengerAdExternalId,
    clientName:               r.clientName,
    campaignName:             r.campaignName,
    adSetName:                r.adSetName,
    externalAdAccountId:      r.externalAdAccountId,
    targetCampaignExternalId: r.targetCampaignExternalId,
    targetAdSetExternalId:    r.targetAdSetExternalId,
    primaryMetric:            r.primaryMetric,
    successThreshold:         r.successThreshold,
    evaluationWindowDays:     r.evaluationWindowDays,
    minSpendPerVariant:       r.minSpendPerVariant,
    minConversionsPerVariant: r.minConversionsPerVariant,
    controlSnapshot,
    challengerSnapshot,
    comparison,
    confidence,
    winningVariant:   r.winningVariant as "control" | "challenger" | null,
    outcomeReasons,
    guardrailBreaches,
    evaluationWindow,
    recommendedNextStep,
    lifecycleLink:    null,  // loaded separately when needed
    markedForReview:  r.markedForReview,
    archivedAt:       r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt:        r.createdAt.toISOString(),
    updatedAt:        r.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Save a new test result
// ---------------------------------------------------------------------------

export async function saveCreativeTestResult(
  input: CreateCreativeTestResultInput & { id: string },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  await db.creativeTestResultRecord.create({
    data: {
      id:               input.id,
      clientAccountId:  input.clientAccountId,
      name:             input.name,
      trackingState:    "pending_launch",
      launchPlanId:     input.launchPlanId    ?? null,
      experimentId:     input.experimentId    ?? null,
      prepItemId:       input.prepItemId      ?? null,
      briefId:          input.briefId         ?? null,
      controlCreativeId:         input.controlCreativeId        ?? null,
      controlCreativeName:       input.controlCreativeName      ?? null,
      controlAdExternalId:       input.controlAdExternalId      ?? null,
      challengerVariantTitle:    input.challengerVariantTitle   ?? null,
      challengerAdExternalId:    input.challengerAdExternalId   ?? null,
      clientName:                input.clientName               ?? null,
      campaignName:              input.campaignName             ?? null,
      adSetName:                 input.adSetName                ?? null,
      externalAdAccountId:       input.externalAdAccountId      ?? null,
      targetCampaignExternalId:  input.targetCampaignExternalId ?? null,
      targetAdSetExternalId:     input.targetAdSetExternalId    ?? null,
      primaryMetric:             input.primaryMetric            ?? "roas_7d",
      successThreshold:          input.successThreshold         ?? 0.10,
      evaluationWindowDays:      input.evaluationWindowDays     ?? 7,
      minSpendPerVariant:        input.minSpendPerVariant       ?? 50.0,
      minConversionsPerVariant:  input.minConversionsPerVariant ?? 5,
    },
  });
}

// ---------------------------------------------------------------------------
// Update an existing test result (partial patch)
// ---------------------------------------------------------------------------

export async function updateCreativeTestResult(
  id:      string,
  updates: Partial<{
    trackingState:          string;
    outcome:                string | null;
    controlSnapshotJson:    string | null;
    challengerSnapshotJson: string | null;
    primaryMetricDelta:     number | null;
    primaryMetricLift:      number | null;
    guardrailBreaches:      string | null;
    outcomeReasons:         string | null;
    confidence:             number | null;
    winningVariant:         string | null;
    windowStartedAt:        Date | null;
    windowEndsAt:           Date | null;
    isWindowComplete:       boolean;
    recommendedNextStep:    string | null;
    markedForReview:        boolean;
    archivedAt:             Date | null;
    experimentId:           string | null;
    launchPlanId:           string | null;
  }>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  await db.creativeTestResultRecord.update({
    where: { id },
    data:  { ...updates, updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Load a list of results
// ---------------------------------------------------------------------------

export async function loadCreativeTestResults(opts?: {
  clientAccountId?: string;
  trackingState?:   CreativeTestTrackingState;
  limit?:           number;
}): Promise<CreativeTestResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const where: Record<string, unknown> = {};
  if (opts?.clientAccountId) where.clientAccountId = opts.clientAccountId;
  if (opts?.trackingState)   where.trackingState   = opts.trackingState;

  const records: TestResultRecord[] = await db.creativeTestResultRecord.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take:    opts?.limit ?? 50,
  });

  return records.map(mapRecord);
}

// ---------------------------------------------------------------------------
// Load a single result by id
// ---------------------------------------------------------------------------

export async function loadCreativeTestResultById(
  id: string,
): Promise<CreativeTestResult | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const record: TestResultRecord | null = await db.creativeTestResultRecord.findUnique({
    where: { id },
  });
  if (!record) return null;
  return mapRecord(record);
}

// ---------------------------------------------------------------------------
// Build aggregate summary
// ---------------------------------------------------------------------------

export async function buildCreativeTestResultDbSummary(
  clientAccountId?: string,
): Promise<CreativeTestResultSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const where: Record<string, unknown> = {};
  if (clientAccountId) where.clientAccountId = clientAccountId;

  const [stateGroups, outcomeGroups] = await Promise.all([
    db.creativeTestResultRecord.groupBy({
      by:    ["trackingState"],
      where,
      _count: { trackingState: true },
    }) as Promise<Array<{ trackingState: string; _count: { trackingState: number } }>>,
    db.creativeTestResultRecord.groupBy({
      by:    ["outcome"],
      where: { ...where, outcome: { not: null } },
      _count: { outcome: true },
    }) as Promise<Array<{ outcome: string; _count: { outcome: number } }>>,
  ]);

  const summary: CreativeTestResultSummary = {
    total:          0,
    pendingLaunch:  0,
    active:         0,
    evaluating:     0,
    completed:      0,
    stale:          0,
    blocked:        0,
    challengerWins: 0,
    controlHolds:   0,
    noWinner:       0,
  };

  for (const g of stateGroups) {
    const count = g._count.trackingState;
    summary.total += count;
    switch (g.trackingState as CreativeTestTrackingState) {
      case "pending_launch": summary.pendingLaunch += count; break;
      case "active":         summary.active        += count; break;
      case "evaluating":     summary.evaluating    += count; break;
      case "completed":      summary.completed     += count; break;
      case "stale":          summary.stale         += count; break;
      case "blocked":        summary.blocked       += count; break;
    }
  }

  for (const g of outcomeGroups) {
    const count = g._count.outcome;
    if (g.outcome === "challenger_wins") summary.challengerWins += count;
    if (g.outcome === "control_holds")   summary.controlHolds   += count;
    if (g.outcome === "no_clear_winner") summary.noWinner       += count;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Save a lifecycle link
// ---------------------------------------------------------------------------

export async function saveCreativeLifecycleResultLink(input: {
  testResultId:    string;
  clientAccountId: string;
  prepItemId?:     string | null;
  briefId?:        string | null;
  variantId?:      string | null;
  launchPlanId?:   string | null;
  experimentId?:   string | null;
  outcome?:        string | null;
  winningRole?:    string | null;
  confidence?:     number | null;
  primaryLift?:    number | null;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  await db.creativeLifecycleResultLinkRecord.create({
    data: {
      testResultId:    input.testResultId,
      clientAccountId: input.clientAccountId,
      prepItemId:      input.prepItemId   ?? null,
      briefId:         input.briefId      ?? null,
      variantId:       input.variantId    ?? null,
      launchPlanId:    input.launchPlanId ?? null,
      experimentId:    input.experimentId ?? null,
      outcome:         input.outcome      ?? null,
      winningRole:     input.winningRole  ?? null,
      confidence:      input.confidence   ?? null,
      primaryLift:     input.primaryLift  ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Load lifecycle links for a result
// ---------------------------------------------------------------------------

export async function loadLifecycleLinksForResult(
  testResultId: string,
): Promise<CreativeLifecycleResultLink[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const records: LifecycleLinkRecord[] = await db.creativeLifecycleResultLinkRecord.findMany({
    where: { testResultId },
  });

  return records.map((r) => ({
    testResultId:    r.testResultId,
    clientAccountId: r.clientAccountId,
    prepItemId:      r.prepItemId,
    briefId:         r.briefId,
    variantId:       r.variantId,
    launchPlanId:    r.launchPlanId,
    experimentId:    r.experimentId,
    outcome:         r.outcome as CreativeTestOutcome | null,
    winningRole:     r.winningRole as "control" | "challenger" | null,
    confidence:      r.confidence,
    primaryLift:     r.primaryLift,
    attachedAt:      r.attachedAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Load lifecycle links for a prep item (used by Creative Lab to show test history)
// ---------------------------------------------------------------------------

export async function loadLifecycleLinksForPrepItem(
  prepItemId: string,
): Promise<CreativeLifecycleResultLink[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const records: LifecycleLinkRecord[] = await db.creativeLifecycleResultLinkRecord.findMany({
    where: { prepItemId },
    orderBy: { attachedAt: "desc" },
  });

  return records.map((r) => ({
    testResultId:    r.testResultId,
    clientAccountId: r.clientAccountId,
    prepItemId:      r.prepItemId,
    briefId:         r.briefId,
    variantId:       r.variantId,
    launchPlanId:    r.launchPlanId,
    experimentId:    r.experimentId,
    outcome:         r.outcome as CreativeTestOutcome | null,
    winningRole:     r.winningRole as "control" | "challenger" | null,
    confidence:      r.confidence,
    primaryLift:     r.primaryLift,
    attachedAt:      r.attachedAt.toISOString(),
  }));
}
