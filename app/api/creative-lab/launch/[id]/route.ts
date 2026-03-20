// app/api/creative-lab/launch/[id]/route.ts
// GET   /api/creative-lab/launch/[id] — fetch a single plan
// PATCH /api/creative-lab/launch/[id] — update plan fields and recompute readiness

import { NextRequest, NextResponse } from "next/server";
import {
  loadExperimentLaunchPlanById,
  updateExperimentLaunchPlan,
  buildCreativeExperimentGuardrails,
  computeCreativeExperimentLaunchReadiness,
} from "../../../../../lib/experimentLaunch";
import { buildCreativeExperimentMapping }       from "../../../../../lib/experimentLaunch";
import { buildCreativeExperimentSuccessCriteria } from "../../../../../lib/experimentLaunch";

// ---------------------------------------------------------------------------
// GET — fetch single plan
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const plan = await loadExperimentLaunchPlanById(id);
    if (!plan) {
      return NextResponse.json({ ok: false, error: "Plan not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    console.error("[launch/[id]/GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to fetch plan." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — partial update, then recompute readiness
//
// Accepted fields:
//   name, hypothesis, objective, launchNotes
//   controlCreativeId, controlCreativeName, controlAdExternalId,
//   controlAdSetExternalId, controlCampaignExternalId
//   targetCampaignId, targetCampaignName, targetCampaignExternalId,
//   targetAdSetId, targetAdSetName, targetAdSetExternalId,
//   externalAdAccountId, comparisonMode
//   primaryMetric, secondaryMetrics (string[]), guardrailMetrics (string[]),
//   successThreshold, minSpendPerVariant, minConversionsPerVariant
//   approve: boolean  — marks approvedAt / clears it
//   markLaunched: { experimentId: string }  — links to experiment
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Load current plan
    const plan = await loadExperimentLaunchPlanById(id);
    if (!plan) {
      return NextResponse.json({ ok: false, error: "Plan not found." }, { status: 404 });
    }

    // Build the patch object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};

    if (body.name            !== undefined) patch.name       = body.name;
    if (body.hypothesis      !== undefined) patch.hypothesis = body.hypothesis;
    if (body.objective       !== undefined) patch.objective  = body.objective;
    if (body.launchNotes     !== undefined) patch.launchNotes = body.launchNotes;

    // Control fields
    if (body.controlCreativeId         !== undefined) patch.controlCreativeId         = body.controlCreativeId;
    if (body.controlCreativeName       !== undefined) patch.controlCreativeName       = body.controlCreativeName;
    if (body.controlAdExternalId       !== undefined) patch.controlAdExternalId       = body.controlAdExternalId;
    if (body.controlAdSetExternalId    !== undefined) patch.controlAdSetExternalId    = body.controlAdSetExternalId;
    if (body.controlCampaignExternalId !== undefined) patch.controlCampaignExternalId = body.controlCampaignExternalId;

    // Mapping fields
    if (body.targetCampaignId         !== undefined) patch.targetCampaignId         = body.targetCampaignId;
    if (body.targetCampaignName       !== undefined) patch.targetCampaignName       = body.targetCampaignName;
    if (body.targetCampaignExternalId !== undefined) patch.targetCampaignExternalId = body.targetCampaignExternalId;
    if (body.targetAdSetId            !== undefined) patch.targetAdSetId            = body.targetAdSetId;
    if (body.targetAdSetName          !== undefined) patch.targetAdSetName          = body.targetAdSetName;
    if (body.targetAdSetExternalId    !== undefined) patch.targetAdSetExternalId    = body.targetAdSetExternalId;
    if (body.externalAdAccountId      !== undefined) patch.externalAdAccountId      = body.externalAdAccountId;
    if (body.comparisonMode           !== undefined) patch.comparisonMode           = body.comparisonMode;

    // Criteria fields
    if (body.primaryMetric            !== undefined) patch.primaryMetric            = body.primaryMetric;
    if (body.successThreshold         !== undefined) patch.successThreshold         = body.successThreshold;
    if (body.minSpendPerVariant       !== undefined) patch.minSpendPerVariant       = body.minSpendPerVariant;
    if (body.minConversionsPerVariant !== undefined) patch.minConversionsPerVariant = body.minConversionsPerVariant;
    if (Array.isArray(body.secondaryMetrics)) patch.secondaryMetricsJson = JSON.stringify(body.secondaryMetrics);
    if (Array.isArray(body.guardrailMetrics)) patch.guardrailMetricsJson = JSON.stringify(body.guardrailMetrics);

    // Approval action
    if (body.approve === true) {
      patch.approvedAt = new Date();
      patch.approvedBy = body.approvedBy ?? "user";
    }
    if (body.approve === false) {
      patch.approvedAt = null;
      patch.approvedBy = null;
    }

    // Mark launched
    if (body.markLaunched?.experimentId) {
      patch.linkedExperimentId = body.markLaunched.experimentId;
      patch.launchedAt         = new Date();
      patch.readinessState     = "launched";
    }

    // Compute new readiness from merged state
    const mergedPlan = {
      ...plan,
      control: {
        ...plan.control,
        creativeId:         patch.controlCreativeId         ?? plan.control.creativeId,
        creativeName:       patch.controlCreativeName       ?? plan.control.creativeName,
        adExternalId:       patch.controlAdExternalId       ?? plan.control.adExternalId,
        adSetExternalId:    patch.controlAdSetExternalId    ?? plan.control.adSetExternalId,
        campaignExternalId: patch.controlCampaignExternalId ?? plan.control.campaignExternalId,
      },
      mapping: buildCreativeExperimentMapping({
        clientAccountId:          plan.clientAccountId,
        externalAdAccountId:      patch.externalAdAccountId      ?? plan.mapping.externalAdAccountId,
        targetCampaignId:         patch.targetCampaignId         ?? plan.mapping.campaignId,
        targetCampaignName:       patch.targetCampaignName       ?? plan.mapping.campaignName,
        targetCampaignExternalId: patch.targetCampaignExternalId ?? plan.mapping.campaignExternalId,
        targetAdSetId:            patch.targetAdSetId            ?? plan.mapping.adSetId,
        targetAdSetName:          patch.targetAdSetName          ?? plan.mapping.adSetName,
        targetAdSetExternalId:    patch.targetAdSetExternalId    ?? plan.mapping.adSetExternalId,
        comparisonMode:           (patch.comparisonMode          ?? plan.mapping.comparisonMode) as "simultaneous" | "sequential",
      }),
      successCriteria: buildCreativeExperimentSuccessCriteria({
        primaryMetric:            patch.primaryMetric            ?? plan.successCriteria.primaryMetric,
        secondaryMetrics:         body.secondaryMetrics           ?? plan.successCriteria.secondaryMetrics,
        guardrailMetrics:         body.guardrailMetrics           ?? plan.successCriteria.guardrailMetrics,
        successThreshold:         patch.successThreshold         ?? plan.successCriteria.successThreshold,
        minSpendPerVariant:       patch.minSpendPerVariant       ?? plan.successCriteria.minSpendPerVariant,
        minConversionsPerVariant: patch.minConversionsPerVariant ?? plan.successCriteria.minConversionsPerVariant,
      }),
      hypothesis: patch.hypothesis ?? plan.hypothesis,
      approvedAt: patch.approvedAt ? (patch.approvedAt as Date).toISOString() : plan.approvedAt,
      launchedAt: patch.launchedAt ? (patch.launchedAt as Date).toISOString() : plan.launchedAt,
      linkedExperimentId: patch.linkedExperimentId ?? plan.linkedExperimentId,
    };

    const guardrails = buildCreativeExperimentGuardrails(mergedPlan);
    const readiness  = computeCreativeExperimentLaunchReadiness({ ...mergedPlan, guardrails });

    // Persist readiness state
    if (!patch.readinessState) {
      patch.readinessState = readiness.state;
    }

    await updateExperimentLaunchPlan(id, patch);

    // Return the refreshed plan
    const updated = await loadExperimentLaunchPlanById(id);
    return NextResponse.json({ ok: true, plan: updated });
  } catch (err) {
    console.error("[launch/[id]/PATCH]", err);
    return NextResponse.json({ ok: false, error: "Failed to update plan." }, { status: 500 });
  }
}
