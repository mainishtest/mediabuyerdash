// lib/experimentLaunch/db.ts
// DB persistence layer for experiment launch plans.
// No business logic — computation lives in builder/mapping/criteria/readiness.

import { prisma }  from "../db";
import type {
  CreativeExperimentLaunchPlan,
  CreativeExperimentLaunchSummary,
  CreativeExperimentReadinessState,
} from "../../types/experimentLaunch";
import { buildCreativeExperimentGuardrails }       from "./criteria";
import { computeCreativeExperimentLaunchReadiness } from "./readiness";
import { buildCreativeExperimentMapping }           from "./mapping";
import { buildCreativeExperimentSuccessCriteria }   from "./criteria";
import { assignCreativeExperimentRoles }            from "./builder";

// ---------------------------------------------------------------------------
// Type alias — Prisma record shape
// ---------------------------------------------------------------------------

type LaunchPlanRecord = {
  id:               string;
  clientAccountId:  string;
  name:             string;
  hypothesis:       string | null;
  objective:        string | null;
  prepItemId:       string | null;
  briefId:          string | null;
  variantId:        string | null;
  recommendationId: string | null;
  readinessState:   string;
  controlLabel:              string;
  controlCreativeId:         string | null;
  controlCreativeName:       string | null;
  controlAdExternalId:       string | null;
  controlAdSetExternalId:    string | null;
  controlCampaignExternalId: string | null;
  challengerLabel:              string;
  challengerCreativeName:       string | null;
  challengerAdExternalId:       string | null;
  challengerAdSetExternalId:    string | null;
  challengerCampaignExternalId: string | null;
  challengerBriefIntent:        string | null;
  challengerBriefDraftType:     string | null;
  challengerVariantTitle:       string | null;
  challengerVariantType:        string | null;
  challengerClientName:         string | null;
  challengerCampaignName:       string | null;
  targetCampaignId:         string | null;
  targetCampaignName:       string | null;
  targetCampaignExternalId: string | null;
  targetAdSetId:            string | null;
  targetAdSetName:          string | null;
  targetAdSetExternalId:    string | null;
  externalAdAccountId:      string | null;
  comparisonMode:           string;
  primaryMetric:            string;
  secondaryMetricsJson:     string | null;
  guardrailMetricsJson:     string | null;
  successThreshold:         number;
  minSpendPerVariant:       number;
  minConversionsPerVariant: number;
  evaluationWindowDays:     number;
  launchNotes:              string | null;
  approvedAt:               Date | null;
  approvedBy:               string | null;
  linkedExperimentId:       string | null;
  launchedAt:               Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Map DB record → domain type
// ---------------------------------------------------------------------------

function safeParseStringArray(json: string | null, fallback: string[]): string[] {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : fallback;
  } catch {
    return fallback;
  }
}

function mapRecord(r: LaunchPlanRecord): CreativeExperimentLaunchPlan {
  const secondaryMetrics: string[] = safeParseStringArray(r.secondaryMetricsJson, ["cpa_7d", "ctr"]);
  const guardrailMetrics: string[] = safeParseStringArray(r.guardrailMetricsJson, ["cpm"]);

  const { control, challenger } = assignCreativeExperimentRoles({
    controlCreativeId:         r.controlCreativeId,
    controlCreativeName:       r.controlCreativeName,
    controlLabel:              r.controlLabel,
    challengerPrepItemId:      r.prepItemId,
    challengerBriefId:         r.briefId,
    challengerVariantId:       r.variantId,
    challengerVariantTitle:    r.challengerVariantTitle,
    challengerVariantType:     r.challengerVariantType as "copy" | "image" | null,
    challengerBriefIntent:     r.challengerBriefIntent,
    challengerBriefDraftType:  r.challengerBriefDraftType,
    challengerClientName:      r.challengerClientName,
    challengerCampaignName:    r.challengerCampaignName,
    challengerLabel:           r.challengerLabel,
  });

  // Restore external IDs on control from stored fields
  const controlWithIds = {
    ...control,
    adExternalId:       r.controlAdExternalId,
    adSetExternalId:    r.controlAdSetExternalId,
    campaignExternalId: r.controlCampaignExternalId,
  };

  const challengerWithIds = {
    ...challenger,
    adExternalId:       r.challengerAdExternalId,
    adSetExternalId:    r.challengerAdSetExternalId,
    campaignExternalId: r.challengerCampaignExternalId,
  };

  const mapping = buildCreativeExperimentMapping({
    clientAccountId:          r.clientAccountId,
    externalAdAccountId:      r.externalAdAccountId,
    targetCampaignId:         r.targetCampaignId,
    targetCampaignName:       r.targetCampaignName,
    targetCampaignExternalId: r.targetCampaignExternalId,
    targetAdSetId:            r.targetAdSetId,
    targetAdSetName:          r.targetAdSetName,
    targetAdSetExternalId:    r.targetAdSetExternalId,
    comparisonMode:           r.comparisonMode as "simultaneous" | "sequential",
  });

  const successCriteria = buildCreativeExperimentSuccessCriteria({
    primaryMetric:            r.primaryMetric,
    secondaryMetrics,
    guardrailMetrics,
    successThreshold:         r.successThreshold,
    minSpendPerVariant:       r.minSpendPerVariant,
    minConversionsPerVariant: r.minConversionsPerVariant,
    evaluationWindowDays:     r.evaluationWindowDays,
  });

  const partialPlan = {
    id:              r.id,
    clientAccountId: r.clientAccountId,
    name:            r.name,
    hypothesis:      r.hypothesis,
    objective:       r.objective,
    prepItemId:      r.prepItemId,
    briefId:         r.briefId,
    variantId:       r.variantId,
    recommendationId: r.recommendationId,
    control:    controlWithIds,
    challenger: challengerWithIds,
    mapping,
    successCriteria,
    launchNotes: r.launchNotes,
    approvedAt:  r.approvedAt ? r.approvedAt.toISOString() : null,
    approvedBy:  r.approvedBy,
    linkedExperimentId: r.linkedExperimentId,
    launchedAt:         r.launchedAt ? r.launchedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };

  const guardrails = buildCreativeExperimentGuardrails({
    ...partialPlan,
    readiness: { state: r.readinessState },
  });
  const readiness = computeCreativeExperimentLaunchReadiness({
    ...partialPlan,
    guardrails,
  });

  return { ...partialPlan, guardrails, readiness };
}

// ---------------------------------------------------------------------------
// Save a new plan
// ---------------------------------------------------------------------------

export async function saveExperimentLaunchPlan(
  plan: CreativeExperimentLaunchPlan,
): Promise<void> {
  // eslint-disable-next-line
  const db = prisma as any;
  await db.experimentLaunchPlanRecord.create({
    data: {
      id:               plan.id,
      clientAccountId:  plan.clientAccountId,
      name:             plan.name,
      hypothesis:       plan.hypothesis,
      objective:        plan.objective,
      prepItemId:       plan.prepItemId,
      briefId:          plan.briefId,
      variantId:        plan.variantId,
      recommendationId: plan.recommendationId,
      readinessState:   plan.readiness.state,
      // Control
      controlLabel:              plan.control.label,
      controlCreativeId:         plan.control.creativeId,
      controlCreativeName:       plan.control.creativeName,
      controlAdExternalId:       plan.control.adExternalId,
      controlAdSetExternalId:    plan.control.adSetExternalId,
      controlCampaignExternalId: plan.control.campaignExternalId,
      // Challenger
      challengerLabel:              plan.challenger.label,
      challengerCreativeName:       plan.challenger.creativeName,
      challengerAdExternalId:       plan.challenger.adExternalId,
      challengerAdSetExternalId:    plan.challenger.adSetExternalId,
      challengerCampaignExternalId: plan.challenger.campaignExternalId,
      challengerBriefIntent:        plan.challenger.briefIntent,
      challengerBriefDraftType:     plan.challenger.briefDraftType,
      challengerVariantTitle:       plan.challenger.variantTitle,
      challengerVariantType:        plan.challenger.variantType,
      challengerClientName:         plan.challenger.clientName,
      challengerCampaignName:       plan.challenger.campaignName,
      // Mapping
      targetCampaignId:         plan.mapping.campaignId,
      targetCampaignName:       plan.mapping.campaignName,
      targetCampaignExternalId: plan.mapping.campaignExternalId,
      targetAdSetId:            plan.mapping.adSetId,
      targetAdSetName:          plan.mapping.adSetName,
      targetAdSetExternalId:    plan.mapping.adSetExternalId,
      externalAdAccountId:      plan.mapping.externalAdAccountId,
      comparisonMode:           plan.mapping.comparisonMode,
      // Criteria
      primaryMetric:            plan.successCriteria.primaryMetric,
      secondaryMetricsJson:     JSON.stringify(plan.successCriteria.secondaryMetrics),
      guardrailMetricsJson:     JSON.stringify(plan.successCriteria.guardrailMetrics),
      successThreshold:         plan.successCriteria.successThreshold,
      minSpendPerVariant:       plan.successCriteria.minSpendPerVariant,
      minConversionsPerVariant: plan.successCriteria.minConversionsPerVariant,
      evaluationWindowDays:     plan.successCriteria.evaluationWindowDays,
      launchNotes:              plan.launchNotes,
    },
  });
}

// ---------------------------------------------------------------------------
// Update an existing plan (partial patch)
// ---------------------------------------------------------------------------

export async function updateExperimentLaunchPlan(
  id:      string,
  updates: Partial<{
    name:             string;
    hypothesis:       string | null;
    objective:        string | null;
    readinessState:   CreativeExperimentReadinessState;
    // Control
    controlLabel:              string;
    controlCreativeId:         string | null;
    controlCreativeName:       string | null;
    controlAdExternalId:       string | null;
    controlAdSetExternalId:    string | null;
    controlCampaignExternalId: string | null;
    // Target mapping
    targetCampaignId:         string | null;
    targetCampaignName:       string | null;
    targetCampaignExternalId: string | null;
    targetAdSetId:            string | null;
    targetAdSetName:          string | null;
    targetAdSetExternalId:    string | null;
    externalAdAccountId:      string | null;
    comparisonMode:           string;
    // Criteria
    primaryMetric:            string;
    secondaryMetricsJson:     string;
    guardrailMetricsJson:     string;
    successThreshold:         number;
    minSpendPerVariant:       number;
    minConversionsPerVariant: number;
    // Notes and approval
    launchNotes:  string | null;
    approvedAt:   Date | null;
    approvedBy:   string | null;
    // Launch link
    linkedExperimentId: string | null;
    launchedAt:         Date | null;
  }>,
): Promise<void> {
  // eslint-disable-next-line
  const db = prisma as any;
  await db.experimentLaunchPlanRecord.update({
    where: { id },
    data:  { ...updates, updatedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Load a list of plans
// ---------------------------------------------------------------------------

export async function loadExperimentLaunchPlans(opts?: {
  clientAccountId?: string;
  readinessState?:  CreativeExperimentReadinessState;
  limit?:           number;
}): Promise<CreativeExperimentLaunchPlan[]> {
  // eslint-disable-next-line
  const db = prisma as any;
  const where: Record<string, unknown> = {};
  if (opts?.clientAccountId) where.clientAccountId = opts.clientAccountId;
  if (opts?.readinessState)  where.readinessState  = opts.readinessState;

  const records: LaunchPlanRecord[] = await db.experimentLaunchPlanRecord.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take:    opts?.limit ?? 50,
  });

  return records.map(mapRecord);
}

// ---------------------------------------------------------------------------
// Load a single plan by id
// ---------------------------------------------------------------------------

export async function loadExperimentLaunchPlanById(
  id: string,
): Promise<CreativeExperimentLaunchPlan | null> {
  // eslint-disable-next-line
  const db = prisma as any;
  const record: LaunchPlanRecord | null = await db.experimentLaunchPlanRecord.findUnique({
    where: { id },
  });
  if (!record) return null;
  return mapRecord(record);
}

// ---------------------------------------------------------------------------
// Build aggregate summary
// ---------------------------------------------------------------------------

export async function buildExperimentLaunchPlanSummary(
  clientAccountId?: string,
): Promise<CreativeExperimentLaunchSummary> {
  // eslint-disable-next-line
  const db = prisma as any;
  const where: Record<string, unknown> = {};
  if (clientAccountId) where.clientAccountId = clientAccountId;

  const groups: Array<{ readinessState: string; _count: { readinessState: number } }> =
    await db.experimentLaunchPlanRecord.groupBy({
      by:    ["readinessState"],
      where,
      _count: { readinessState: true },
    });

  const summary: CreativeExperimentLaunchSummary = {
    total:          0,
    draft:          0,
    needsMapping:   0,
    needsApproval:  0,
    readyForLaunch: 0,
    blocked:        0,
    launched:       0,
  };

  for (const g of groups) {
    const count = g._count.readinessState;
    summary.total += count;
    switch (g.readinessState as CreativeExperimentReadinessState) {
      case "draft":            summary.draft          += count; break;
      case "needs_mapping":    summary.needsMapping   += count; break;
      case "needs_approval":   summary.needsApproval  += count; break;
      case "ready_for_launch": summary.readyForLaunch += count; break;
      case "blocked":          summary.blocked        += count; break;
      case "launched":         summary.launched       += count; break;
    }
  }

  return summary;
}
