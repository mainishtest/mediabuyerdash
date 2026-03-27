// app/api/experiments/route.ts
// GET  — list experiments with summary
// POST — create a new experiment plan

import { NextRequest, NextResponse }       from "next/server";
import {
  loadExperiments,
  buildExperimentSummary,
  saveExperimentPlan,
  buildEvaluationWindow,
}                                          from "../../../lib/experiments";
import type {
  ExperimentPlan,
  ExperimentStatus,
  ExperimentComparisonMode,
}                                          from "../../../types/experiment";

// ---------------------------------------------------------------------------
// GET — list
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clientAccountId  = searchParams.get("clientAccountId") ?? undefined;
  const status           = searchParams.get("status")          ?? undefined;

  try {
    const [plans, summary] = await Promise.all([
      loadExperiments({ clientAccountId, status: status as ExperimentStatus | undefined, limit: 50 }),
      buildExperimentSummary(clientAccountId),
    ]);
    return NextResponse.json({ ok: true, plans, summary });
  } catch (err) {
    console.error("[experiments GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to load experiments." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new experiment plan
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const d = (body ?? {}) as Record<string, unknown>;

  if (!d.name || typeof d.name !== "string") {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  if (!d.clientAccountId || typeof d.clientAccountId !== "string") {
    return NextResponse.json({ error: "clientAccountId is required." }, { status: 400 });
  }

  const windowDays: number = typeof d.evaluationWindowDays === "number" ? d.evaluationWindowDays : 7;
  const startedAt           = new Date().toISOString();
  const endsAt              = new Date(Date.now() + windowDays * 86_400_000).toISOString();
  const evalWindow          = buildEvaluationWindow(startedAt, windowDays, endsAt);

  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const plan: Omit<ExperimentPlan, "createdAt" | "updatedAt"> = {
    id,
    clientAccountId:  d.clientAccountId as string,
    campaignId:       (d.campaignId         as string | null) ?? null,
    name:             d.name as string,
    description:      (d.description        as string | null) ?? null,
    status:           "active" as ExperimentStatus,
    comparisonMode:   ((d.comparisonMode as string) ?? "simultaneous") as ExperimentComparisonMode,
    // Control
    controlCreativeId:        (d.controlCreativeId        as string | null) ?? null,
    controlAdExternalId:      (d.controlAdExternalId      as string | null) ?? null,
    controlAdSetExternalId:   (d.controlAdSetExternalId   as string | null) ?? null,
    controlCampaignExternalId: (d.controlCampaignExternalId as string | null) ?? null,
    controlLabel:             (d.controlLabel as string) || "Control",
    // Challenger
    challengerPrepItemId:       (d.challengerPrepItemId       as string | null) ?? null,
    challengerAdExternalId:     (d.challengerAdExternalId     as string | null) ?? null,
    challengerAdSetExternalId:  (d.challengerAdSetExternalId  as string | null) ?? null,
    challengerCampaignExternalId: (d.challengerCampaignExternalId as string | null) ?? null,
    challengerLabel:            (d.challengerLabel as string) || "Challenger",
    // Shared
    externalAdAccountId: (d.externalAdAccountId as string | null) ?? null,
    // Criteria
    primaryMetric:            (d.primaryMetric as string) || "roas_7d",
    secondaryMetrics:         Array.isArray(d.secondaryMetrics) ? d.secondaryMetrics as string[] : ["cpa_7d", "ctr"],
    successThreshold:         typeof d.successThreshold === "number" ? d.successThreshold : 0.10,
    minSpendPerVariant:       typeof d.minSpendPerVariant === "number" ? d.minSpendPerVariant : 50,
    minConversionsPerVariant: typeof d.minConversionsPerVariant === "number" ? d.minConversionsPerVariant : 5,
    evaluationWindowDays:     windowDays,
    // Timeline
    startedAt,
    evaluationEndsAt: endsAt,
    completedAt:      null,
  };

  try {
    await saveExperimentPlan(plan);
  } catch (err) {
    console.error("[experiments POST save]", err);
    return NextResponse.json({ error: "Failed to save experiment." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, plan });
}
