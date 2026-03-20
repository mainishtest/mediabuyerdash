// app/api/experiments/[id]/actions/route.ts
// GET  — compute and return outcome action recommendations for an experiment.
// POST — approve a recommendation by creating a ProposedAutomationAction.
//
// Reuses: lib/experiments/db, lib/outcomeActions, lib/automation/persist

import { NextRequest, NextResponse }                from "next/server";
import { loadExperimentById }                       from "../../../../../lib/experiments";
import {
  buildOutcomeActionRecommendations,
  summarizeOutcomeActions,
}                                                   from "../../../../../lib/outcomeActions";
import { upsertProposedActions }                    from "../../../../../lib/automation/persist";
import type { ProposedAutomationActionDraft }       from "../../../../../lib/automation/types";

// ---------------------------------------------------------------------------
// GET — compute recommendations (pure, no DB write)
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const experiment = await loadExperimentById(id).catch(() => null);
  if (!experiment) {
    return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
  }

  const recommendations = buildOutcomeActionRecommendations(experiment);
  const summary = summarizeOutcomeActions(
    experiment.id,
    experiment.name,
    experiment.result?.outcome ?? "not_evaluated",
    recommendations,
  );

  return NextResponse.json({ ok: true, recommendations, summary, experiment });
}

// ---------------------------------------------------------------------------
// POST — approve a recommendation
// Body: { recommendationId, workspaceId? }
// Routes the approved action into the existing automation proposal workflow.
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { recommendationId, workspaceId } = (body ?? {}) as {
    recommendationId?: string;
    workspaceId?:      string;
  };

  if (!recommendationId) {
    return NextResponse.json({ error: "recommendationId is required." }, { status: 400 });
  }

  // Load experiment + recompute recommendations
  const experiment = await loadExperimentById(id).catch(() => null);
  if (!experiment) {
    return NextResponse.json({ error: "Experiment not found." }, { status: 404 });
  }

  const recommendations = buildOutcomeActionRecommendations(experiment);
  const rec = recommendations.find((r) => r.id === recommendationId);
  if (!rec) {
    return NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
  }

  // Only approve if readiness allows it
  if (rec.readiness === "not_ready" || rec.readiness === "approval_blocked") {
    return NextResponse.json({
      ok:       false,
      error:    "Recommendation is not ready for approval.",
      blockers: rec.blockers,
    }, { status: 422 });
  }

  // Map to automation action — only if this rec has an automation action type
  if (!rec.automationActionType) {
    // Actions like monitor_only, keep_winner_running don't create automation proposals.
    // They are informational recommendations only.
    return NextResponse.json({
      ok:   true,
      note: `Action type "${rec.actionType}" is informational — no automation proposal created.`,
      id,
      recommendationId,
    });
  }

  // Build automation proposal draft (reuses existing automation layer)
  const draft: ProposedAutomationActionDraft = {
    workspaceId:     workspaceId ?? null,
    automationRuleId: null,
    clientAccountId: experiment.clientAccountId,
    clientName:      `Client ${experiment.clientAccountId}`,
    actionType:      rec.automationActionType as ProposedAutomationActionDraft["actionType"],
    priority:        rec.priority === "urgent" ? "high" : rec.priority as ProposedAutomationActionDraft["priority"],
    entityType:      rec.relatedEntityType === "campaign" ? "campaign" : "client",
    entityId:        rec.relatedEntityId ?? experiment.clientAccountId,
    entityName:      rec.relatedEntityName ?? experiment.name,
    rationale:       `[Experiment: ${experiment.name}] ${rec.rationale}`,
    supportingData: {
      experimentId:       experiment.id,
      outcome:            experiment.result?.outcome ?? "",
      confidence:         experiment.result?.confidence ?? 0,
      primaryLift:        experiment.result?.primaryMetricLift ?? 0,
      recommendationType: rec.actionType,
    },
    deduplicationKey: `${experiment.id}:${rec.automationActionType}:${rec.relatedEntityId ?? experiment.clientAccountId}`,
    expiresAt:        new Date(Date.now() + 7 * 86_400_000),  // 7 days
  };

  try {
    await upsertProposedActions([draft]);
  } catch (err) {
    console.error("[experiments/actions POST]", err);
    return NextResponse.json({ error: "Failed to create automation proposal." }, { status: 500 });
  }

  return NextResponse.json({
    ok:              true,
    message:         `Action "${rec.title}" submitted for approval via the automation workflow.`,
    id,
    recommendationId,
    automationActionType: rec.automationActionType,
  });
}
