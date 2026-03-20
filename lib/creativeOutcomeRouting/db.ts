// lib/creativeOutcomeRouting/db.ts
// DB persistence for CreativeOutcomeRoute records.
// Uses (prisma as any) pattern — model added via SQL migration, not yet in
// the generated client type. All business logic lives in router.ts / learnings.ts.

import { prisma } from "../db";
import type {
  CreativeOutcomeRoute,
  CreativeOutcomeRoutingSummary,
  CreativeOutcomeReadinessState,
} from "../../types/creativeOutcomeRouting";

// ---------------------------------------------------------------------------
// DB record shape
// ---------------------------------------------------------------------------

type RouteRecord = {
  id:              string;
  clientAccountId: string;
  testResultId:    string;

  routeType:      string;
  readinessState: string;

  outcome:         string | null;
  confidenceLevel: string | null;
  confidenceScore: number | null;
  primaryLift:     number | null;
  winningVariant:  string | null;

  challengerVariantTitle: string | null;
  controlCreativeName:    string | null;
  campaignName:           string | null;
  primaryMetric:          string | null;

  reasonsJson:  string;   // JSON: CreativeOutcomeReason[]
  evidenceJson: string;   // JSON: Record<string, unknown>
  learningJson: string | null; // JSON: CreativeIterationLearning | null

  nextActionLabel: string;
  nextActionHint:  string;
  linkedWorkflow:  string | null;
  learningSummary: string | null;

  actionedAt: Date | null;
  actionedBy: string | null;
  actionNote: string | null;
  archivedAt: Date | null;

  launchPlanId: string | null;
  experimentId: string | null;
  briefId:      string | null;
  variantId:    string | null;
  prepItemId:   string | null;

  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Safe JSON parse
// ---------------------------------------------------------------------------

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Map DB record → domain type
// ---------------------------------------------------------------------------

function mapRecord(r: RouteRecord): CreativeOutcomeRoute {
  return {
    id:              r.id,
    clientAccountId: r.clientAccountId,
    testResultId:    r.testResultId,

    routeType:      r.routeType      as CreativeOutcomeRoute["routeType"],
    readinessState: r.readinessState as CreativeOutcomeReadinessState,

    outcome:         r.outcome         as CreativeOutcomeRoute["outcome"],
    confidenceLevel: r.confidenceLevel as CreativeOutcomeRoute["confidenceLevel"],
    confidenceScore: r.confidenceScore,
    primaryLift:     r.primaryLift,
    winningVariant:  r.winningVariant  as CreativeOutcomeRoute["winningVariant"],

    challengerVariantTitle: r.challengerVariantTitle,
    controlCreativeName:    r.controlCreativeName,
    campaignName:           r.campaignName,
    primaryMetric:          r.primaryMetric,

    reasons:  safeParse(r.reasonsJson,  []),
    evidence: safeParse(r.evidenceJson, {}),
    learning: safeParse(r.learningJson, null),

    nextActionLabel: r.nextActionLabel,
    nextActionHint:  r.nextActionHint,
    linkedWorkflow:  r.linkedWorkflow,
    learningSummary: r.learningSummary,

    actionedAt: r.actionedAt ? r.actionedAt.toISOString() : null,
    actionedBy: r.actionedBy,
    actionNote: r.actionNote,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,

    launchPlanId: r.launchPlanId,
    experimentId: r.experimentId,
    briefId:      r.briefId,
    variantId:    r.variantId,
    prepItemId:   r.prepItemId,

    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function saveCreativeOutcomeRoute(
  route: CreativeOutcomeRoute,
): Promise<CreativeOutcomeRoute> {
  // eslint-disable-next-line
  const record = await (prisma as any).creativeOutcomeRouteRecord.upsert({
    where: { testResultId: route.testResultId },
    create: {
      id:              route.id,
      clientAccountId: route.clientAccountId,
      testResultId:    route.testResultId,
      routeType:       route.routeType,
      readinessState:  route.readinessState,
      outcome:         route.outcome,
      confidenceLevel: route.confidenceLevel,
      confidenceScore: route.confidenceScore,
      primaryLift:     route.primaryLift,
      winningVariant:  route.winningVariant,
      challengerVariantTitle: route.challengerVariantTitle,
      controlCreativeName:    route.controlCreativeName,
      campaignName:           route.campaignName,
      primaryMetric:          route.primaryMetric,
      reasonsJson:     JSON.stringify(route.reasons),
      evidenceJson:    JSON.stringify(route.evidence),
      learningJson:    route.learning ? JSON.stringify(route.learning) : null,
      nextActionLabel: route.nextActionLabel,
      nextActionHint:  route.nextActionHint,
      linkedWorkflow:  route.linkedWorkflow,
      learningSummary: route.learningSummary,
      launchPlanId:    route.launchPlanId,
      experimentId:    route.experimentId,
      briefId:         route.briefId,
      variantId:       route.variantId,
      prepItemId:      route.prepItemId,
    },
    update: {
      routeType:       route.routeType,
      readinessState:  route.readinessState,
      outcome:         route.outcome,
      confidenceLevel: route.confidenceLevel,
      confidenceScore: route.confidenceScore,
      primaryLift:     route.primaryLift,
      winningVariant:  route.winningVariant,
      challengerVariantTitle: route.challengerVariantTitle,
      controlCreativeName:    route.controlCreativeName,
      campaignName:           route.campaignName,
      primaryMetric:          route.primaryMetric,
      reasonsJson:     JSON.stringify(route.reasons),
      evidenceJson:    JSON.stringify(route.evidence),
      learningJson:    route.learning ? JSON.stringify(route.learning) : null,
      nextActionLabel: route.nextActionLabel,
      nextActionHint:  route.nextActionHint,
      linkedWorkflow:  route.linkedWorkflow,
      learningSummary: route.learningSummary,
      updatedAt:       new Date(),
    },
  });
  return mapRecord(record as RouteRecord);
}

export async function updateCreativeOutcomeRouteState(
  id: string,
  patch: {
    readinessState?: CreativeOutcomeReadinessState;
    actionedAt?:     string | null;
    actionedBy?:     string | null;
    actionNote?:     string | null;
    archivedAt?:     string | null;
  },
): Promise<CreativeOutcomeRoute> {
  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.readinessState !== undefined) data.readinessState = patch.readinessState;
  if (patch.actionedAt     !== undefined) data.actionedAt     = patch.actionedAt ? new Date(patch.actionedAt) : null;
  if (patch.actionedBy     !== undefined) data.actionedBy     = patch.actionedBy;
  if (patch.actionNote     !== undefined) data.actionNote     = patch.actionNote;
  if (patch.archivedAt     !== undefined) data.archivedAt     = patch.archivedAt ? new Date(patch.archivedAt) : null;

  // eslint-disable-next-line
  const record = await (prisma as any).creativeOutcomeRouteRecord.update({
    where: { id },
    data,
  });
  return mapRecord(record as RouteRecord);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function loadCreativeOutcomeRouteById(
  id: string,
): Promise<CreativeOutcomeRoute | null> {
  // eslint-disable-next-line
  const record = await (prisma as any).creativeOutcomeRouteRecord.findUnique({
    where: { id },
  });
  return record ? mapRecord(record as RouteRecord) : null;
}

export async function loadCreativeOutcomeRouteByTestResultId(
  testResultId: string,
): Promise<CreativeOutcomeRoute | null> {
  // eslint-disable-next-line
  const record = await (prisma as any).creativeOutcomeRouteRecord.findUnique({
    where: { testResultId },
  });
  return record ? mapRecord(record as RouteRecord) : null;
}

export async function loadCreativeOutcomeRoutes(opts: {
  clientAccountId?: string;
  readinessState?:  CreativeOutcomeReadinessState;
  limit?:           number;
  offset?:          number;
}): Promise<CreativeOutcomeRoute[]> {
  const where: Record<string, unknown> = {};
  if (opts.clientAccountId) where.clientAccountId = opts.clientAccountId;
  if (opts.readinessState)  where.readinessState  = opts.readinessState;

  // eslint-disable-next-line
  const records = await (prisma as any).creativeOutcomeRouteRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take:  opts.limit  ?? 100,
    skip:  opts.offset ?? 0,
  });
  return (records as RouteRecord[]).map(mapRecord);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export async function buildCreativeOutcomeRoutingSummary(
  clientAccountId?: string,
): Promise<CreativeOutcomeRoutingSummary> {
  const where: Record<string, unknown> = {};
  if (clientAccountId) where.clientAccountId = clientAccountId;

  // eslint-disable-next-line
  const db = (prisma as any).creativeOutcomeRouteRecord;

  const [
    total,
    pendingAction,
    actioned,
    archived,
    learningCaptured,
    winnerRoutes,
    loserRoutes,
    mixedRoutes,
    monitorRoutes,
  ] = await Promise.all([
    db.count({ where }),
    db.count({ where: { ...where, readinessState: "pending_action" } }),
    db.count({ where: { ...where, readinessState: "actioned" } }),
    db.count({ where: { ...where, readinessState: "archived" } }),
    db.count({ where: { ...where, readinessState: "learning_captured" } }),
    db.count({ where: { ...where, routeType: { in: ["send_winner_to_scale_review", "keep_winner_running"] } } }),
    db.count({ where: { ...where, routeType: "send_loser_to_creative_lab" } }),
    db.count({ where: { ...where, routeType: "send_mixed_result_to_follow_up_test" } }),
    db.count({ where: { ...where, routeType: "monitor_until_more_data" } }),
  ]);

  return {
    total,
    pendingAction,
    actioned,
    archived,
    learningCaptured,
    winnerRoutes,
    loserRoutes,
    mixedRoutes,
    monitorRoutes,
  };
}
