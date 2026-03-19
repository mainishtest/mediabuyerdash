// app/creative-lab/page.tsx
// Creative Lab — workflow queue landing page.
//
// Data flow:
//   1. Load creative performance snapshots from Meta sync + reconciliation.
//   2. Build CreativeLabItems with stable, deterministic IDs.
//   3. Load persisted workflow state from DB (status, notes, activityLog).
//   4. Merge: overlay DB state onto snapshot-derived items.
//   5. Pass merged items to the client WorkflowView.
//
// The original AI generation pipeline is at /creative-lab/generate.

export const dynamic = "force-dynamic";

import { getServerSession }                           from "next-auth";
import { authOptions }                                from "../../lib/auth";
import { prisma }                                     from "../../lib/db";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
}                                                     from "../../lib/creativelab/performance";
import { buildCreativeLabItem }                       from "../../lib/creativelab/workflowUtils";
import {
  buildWorkflowItemId,
  getWorkflowStates,
}                                                     from "../../lib/creativelab/db";
import { CreativeLabWorkflowView }                    from "./CreativeLabWorkflowView";
import type { CreativeLabItem, CreativeLabSourceType } from "../../types/creativeLab";
import type { CreativePerformanceSnapshot }            from "../../lib/creativelab/types";

export const metadata = {
  title: "Creative Lab — Media Buying Dashboard",
};

type PageProps = {
  searchParams: { clientId?: string };
};

export default async function CreativeLabPage({ searchParams }: PageProps) {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;

  const selectedClientId = searchParams?.clientId ?? null;

  // Load all clients for the filter selector.
  const clients = await prisma.clientAccount
    .findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
      where:   workspaceId ? { workspaceId } : {},
    })
    .catch(() => []);

  // Load creative performance snapshots from the evaluation pipeline.
  // Gracefully falls back to empty on DB error or missing Meta sync.
  const perfData  = await loadCreativePerformanceData(workspaceId).catch(() => null);
  const snapshots = perfData ? buildCreativePerformanceSnapshots(perfData) : [];

  // Build workflow items with stable, deterministic IDs.
  const rawItems: Array<{ id: string; item: CreativeLabItem }> = snapshots
    .filter((s) => s.evaluationStatus !== "insufficient_data")
    .map((snapshot, idx) => {
      const id         = buildWorkflowItemId(
        snapshot.clientAccountId,
        snapshot.externalCreativeId,
        snapshot.externalCampaignId,
      );
      const sourceType = deriveSourceType(snapshot);
      const { headline, rationale, nextAction } = deriveRecommendation(snapshot);

      const item = buildCreativeLabItem({
        id,
        clientAccountId:         snapshot.clientAccountId,
        clientName:              snapshot.clientName,
        sourceType,
        recommendationHeadline:  headline,
        recommendationRationale: rationale,
        suggestedNextAction:     nextAction,
        snapshot,
      });

      return { id, item };
    });

  // Load any persisted workflow state from DB for these item IDs.
  const persistedStates = await getWorkflowStates(
    rawItems.map((r) => r.id),
  ).catch(() => new Map<string, never>());

  // Merge: overlay DB state (status, notes, activityLog) where it exists.
  const items: CreativeLabItem[] = rawItems.map(({ id, item }) => {
    const persisted = persistedStates.get(id);
    if (!persisted) return item;

    return {
      ...item,
      status: persisted.status as CreativeLabItem["status"],
      notes:  persisted.notes ?? null,
      activityLog: persisted.activityLog.map((e) => ({
        id:        e.id,
        action:    e.action,
        note:      e.note,
        actor:     null,
        timestamp: e.createdAt.toISOString(),
      })),
    };
  });

  return (
    <CreativeLabWorkflowView
      clients={clients}
      initialItems={items}
      selectedClientId={selectedClientId}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveSourceType(s: CreativePerformanceSnapshot): CreativeLabSourceType {
  switch (s.evaluationStatus) {
    case "strong":   return "winning_creative";
    case "fatigued": return "fatigued_creative";
    case "weak":     return "underperforming_creative";
    default:         return "underperforming_creative";
  }
}

function deriveRecommendation(s: CreativePerformanceSnapshot): {
  headline:   string;
  rationale:  string;
  nextAction: string;
} {
  const ctrStr  = s.avgCtr.toFixed(2);
  const freqStr = s.avgFrequency != null ? `${s.avgFrequency.toFixed(1)}x` : null;
  const roasStr = s.campaignRoas != null ? `${s.campaignRoas.toFixed(2)}x` : null;

  switch (s.evaluationStatus) {
    case "strong":
      return {
        headline:  "Winning creative — ready to scale",
        rationale: [
          `CTR ${ctrStr}% is above the strong threshold.`,
          roasStr ? `Campaign ROAS ${roasStr} (CRM-verified).` : null,
          "This creative is generating above-goal returns and is a candidate for budget increase or audience expansion.",
        ]
          .filter(Boolean)
          .join(" "),
        nextAction: "Increase ad set budget 10–20% or duplicate into new audiences",
      };

    case "fatigued":
      return {
        headline:  "Audience fatigue detected — refresh required",
        rationale: [
          freqStr ? `Frequency ${freqStr} — audience is overexposed.` : "High frequency detected.",
          `CTR ${ctrStr}% — engagement is declining.`,
          "Performance will continue to deteriorate without a creative swap.",
        ].join(" "),
        nextAction: "Generate new copy variations or replace the image hook",
      };

    case "weak":
      return {
        headline:  "Weak engagement — creative not resonating",
        rationale: [
          `CTR ${ctrStr}% is below the 0.8% threshold.`,
          roasStr ? `Campaign ROAS ${roasStr}.` : null,
          "The hook or image is not stopping the scroll. Review the opening frame and CTA.",
        ]
          .filter(Boolean)
          .join(" "),
        nextAction: "Review creative hook and CTA — iterate or replace",
      };

    default:
      return {
        headline:  "Monitor — moderate performance",
        rationale: `CTR ${ctrStr}%. ${roasStr ? `Campaign ROAS ${roasStr}.` : ""} Performance is within range but not above goal. Review for optimisation opportunities.`.trim(),
        nextAction: "Monitor for 7 more days before making changes",
      };
  }
}
