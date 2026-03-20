// lib/experimentLaunch/builder.ts
// Assembles CreativeExperimentLaunchPlan entities from approved creative drafts.
// All functions are pure — no DB access, no API calls.
//
// Architecture rules:
//   - buildCreativeExperimentLaunchPlan() is the single public entry point.
//   - Readiness is computed separately via computeCreativeExperimentLaunchReadiness().
//   - CRM ROAS/CPA inform success criteria defaults — never Meta self-reported.
//   - 7-day attribution window is the enforced default for evaluationWindowDays.

import type {
  CreativeExperimentLaunchPlan,
  CreativeExperimentControl,
  CreativeExperimentChallenger,
  CreativeExperimentMapping,
  CreativeExperimentSuccessCriteria,
  CreativeExperimentGuardrail,
  CreativeExperimentLaunchReadiness,
  CreateExperimentLaunchPlanInput,
} from "../../types/experimentLaunch";
import type { PublishPrepItem } from "../../types/publishPrep";
import { buildCreativeExperimentMapping }         from "./mapping";
import { buildCreativeExperimentSuccessCriteria, buildCreativeExperimentGuardrails } from "./criteria";
import { computeCreativeExperimentLaunchReadiness } from "./readiness";

// ---------------------------------------------------------------------------
// Assign roles to a control/challenger pair
// ---------------------------------------------------------------------------

export function assignCreativeExperimentRoles(opts: {
  controlCreativeId?:   string | null;
  controlCreativeName?: string | null;
  controlLabel?:        string;
  challengerPrepItemId?:   string | null;
  challengerBriefId?:      string | null;
  challengerVariantId?:    string | null;
  challengerVariantTitle?: string | null;
  challengerVariantType?:  "copy" | "image" | null;
  challengerBriefIntent?:  string | null;
  challengerBriefDraftType?: string | null;
  challengerClientName?:   string | null;
  challengerCampaignName?: string | null;
  challengerLabel?:        string;
}): { control: CreativeExperimentControl; challenger: CreativeExperimentChallenger } {
  const control: CreativeExperimentControl = {
    role:               "control",
    label:              opts.controlLabel ?? "Control",
    creativeId:         opts.controlCreativeId ?? null,
    creativeName:       opts.controlCreativeName ?? null,
    adExternalId:       null,
    adSetExternalId:    null,
    campaignExternalId: null,
    prepItemId:         null,
    briefId:            null,
    variantId:          null,
    variantTitle:       null,
    variantType:        null,
  };

  const challenger: CreativeExperimentChallenger = {
    role:               "challenger",
    label:              opts.challengerLabel ?? "Challenger",
    creativeId:         null,   // not yet assigned a Meta creative id — pending launch
    creativeName:       opts.challengerVariantTitle ?? null,
    adExternalId:       null,
    adSetExternalId:    null,
    campaignExternalId: null,
    prepItemId:         opts.challengerPrepItemId ?? null,
    briefId:            opts.challengerBriefId ?? null,
    variantId:          opts.challengerVariantId ?? null,
    variantTitle:       opts.challengerVariantTitle ?? null,
    variantType:        opts.challengerVariantType ?? null,
    briefIntent:        opts.challengerBriefIntent ?? null,
    briefDraftType:     opts.challengerBriefDraftType ?? null,
    clientName:         opts.challengerClientName ?? null,
    campaignName:       opts.challengerCampaignName ?? null,
  };

  return { control, challenger };
}

// ---------------------------------------------------------------------------
// Build launch plan from a PublishPrepItem (main entry point for wiring)
// ---------------------------------------------------------------------------

export function buildCreativeExperimentLaunchPlanFromPrepItem(opts: {
  id:          string;
  prepItem:    PublishPrepItem;
  name?:       string;
  hypothesis?: string | null;
  objective?:  string | null;
}): CreativeExperimentLaunchPlan {
  const { id, prepItem, name, hypothesis = null, objective = null } = opts;

  const { control, challenger } = assignCreativeExperimentRoles({
    challengerPrepItemId:    prepItem.id,
    challengerBriefId:       prepItem.briefId,
    challengerVariantId:     prepItem.variantId,
    challengerVariantTitle:  prepItem.variantTitle,
    challengerVariantType:   prepItem.variantType,
    challengerBriefIntent:   prepItem.briefIntent,
    challengerBriefDraftType: prepItem.briefDraftType,
    challengerClientName:    prepItem.clientName,
    challengerCampaignName:  prepItem.campaignName,
  });

  const mapping = buildCreativeExperimentMapping({
    clientAccountId:          prepItem.clientAccountId,
    targetCampaignId:         prepItem.targetMapping.targetCampaignId,
    targetCampaignName:       prepItem.targetMapping.targetCampaignName,
    targetCampaignExternalId: prepItem.targetMapping.targetCampaignExternalId,
    targetAdSetId:            prepItem.targetMapping.targetAdSetId,
    targetAdSetName:          prepItem.targetMapping.targetAdSetName,
    targetAdSetExternalId:    prepItem.targetMapping.targetAdSetExternalId,
  });

  const successCriteria = buildCreativeExperimentSuccessCriteria({
    hypothesis,
  });

  const partialPlan = {
    id,
    clientAccountId: prepItem.clientAccountId,
    name: name ?? `Test: ${prepItem.variantTitle ?? "Unnamed"}`,
    hypothesis,
    objective,
    prepItemId:       prepItem.id,
    briefId:          prepItem.briefId,
    variantId:        prepItem.variantId,
    recommendationId: null,
    control,
    challenger,
    mapping,
    successCriteria,
    guardrails:       [] as CreativeExperimentGuardrail[],
    readiness:        {} as CreativeExperimentLaunchReadiness,  // filled below
    launchNotes:      null,
    approvedAt:       null,
    approvedBy:       null,
    linkedExperimentId: null,
    launchedAt:         null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Evaluate guardrails and readiness
  const guardrails = buildCreativeExperimentGuardrails(partialPlan);
  const readiness  = computeCreativeExperimentLaunchReadiness({ ...partialPlan, guardrails });

  return { ...partialPlan, guardrails, readiness };
}

// ---------------------------------------------------------------------------
// Build launch plan from structured input (used by the API POST handler)
// ---------------------------------------------------------------------------

export function buildCreativeExperimentLaunchPlan(opts: {
  id:    string;
  input: CreateExperimentLaunchPlanInput;
}): CreativeExperimentLaunchPlan {
  const { id, input } = opts;

  const { control, challenger } = assignCreativeExperimentRoles({
    challengerPrepItemId:      input.prepItemId,
    challengerBriefId:         input.briefId,
    challengerVariantId:       input.variantId,
    challengerVariantTitle:    input.challengerVariantTitle,
    challengerVariantType:     input.challengerVariantType,
    challengerBriefIntent:     input.challengerBriefIntent,
    challengerBriefDraftType:  input.challengerBriefDraftType,
    challengerClientName:      input.challengerClientName,
    challengerCampaignName:    input.challengerCampaignName,
  });

  const mapping = buildCreativeExperimentMapping({
    clientAccountId:          input.clientAccountId,
    externalAdAccountId:      input.externalAdAccountId,
    targetCampaignId:         input.targetCampaignId,
    targetCampaignName:       input.targetCampaignName,
    targetCampaignExternalId: input.targetCampaignExternalId,
    targetAdSetId:            input.targetAdSetId,
    targetAdSetName:          input.targetAdSetName,
    targetAdSetExternalId:    input.targetAdSetExternalId,
    comparisonMode:           input.comparisonMode,
  });

  const successCriteria = buildCreativeExperimentSuccessCriteria({
    primaryMetric:            input.primaryMetric,
    secondaryMetrics:         input.secondaryMetrics,
    guardrailMetrics:         input.guardrailMetrics,
    successThreshold:         input.successThreshold,
    minSpendPerVariant:       input.minSpendPerVariant,
    minConversionsPerVariant: input.minConversionsPerVariant,
    evaluationWindowDays:     input.evaluationWindowDays,
    hypothesis:               input.hypothesis,
  });

  const now = new Date().toISOString();

  const partialPlan = {
    id,
    clientAccountId: input.clientAccountId,
    name:            input.name,
    hypothesis:      input.hypothesis ?? null,
    objective:       input.objective ?? null,
    prepItemId:      input.prepItemId ?? null,
    briefId:         input.briefId ?? null,
    variantId:       input.variantId ?? null,
    recommendationId: input.recommendationId ?? null,
    control,
    challenger,
    mapping,
    successCriteria,
    guardrails:       [] as CreativeExperimentGuardrail[],
    readiness:        {} as CreativeExperimentLaunchReadiness,
    launchNotes:      input.launchNotes ?? null,
    approvedAt:       null,
    approvedBy:       null,
    linkedExperimentId: null,
    launchedAt:         null,
    createdAt: now,
    updatedAt: now,
  };

  const guardrails = buildCreativeExperimentGuardrails(partialPlan);
  const readiness  = computeCreativeExperimentLaunchReadiness({ ...partialPlan, guardrails });

  return { ...partialPlan, guardrails, readiness };
}
