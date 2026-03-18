// app/creative-lab/page.tsx
// Creative Lab — workflow queue landing page.
//
// Loads creative performance data from the existing Meta sync + reconciliation
// pipeline, maps snapshots into CreativeLabItem workflow entities, and
// passes them to the client-side WorkflowView.
//
// The original AI generation pipeline is accessible at /creative-lab/generate.

export const dynamic = "force-dynamic";

import { getServerSession }                      from "next-auth";
import { authOptions }                            from "../../lib/auth";
import { prisma }                                 from "../../lib/db";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
}                                                 from "../../lib/creativelab/performance";
import { buildCreativeLabItem }                   from "../../lib/creativelab/workflowUtils";
import { CreativeLabWorkflowView }                from "./CreativeLabWorkflowView";
import type { CreativeLabItem, CreativeLabSourceType } from "../../types/creativeLab";
import type { CreativePerformanceSnapshot }       from "../../lib/creativelab/types";

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

  // Load all clients for the filter selector
  const clients = await prisma.clientAccount
    .findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
      where:   workspaceId ? { workspaceId } : {},
    })
    .catch(() => []);

  // Load creative performance snapshots from the existing evaluation pipeline.
  // Gracefully returns empty array on DB error (e.g. no Meta sync yet).
  const perfData  = await loadCreativePerformanceData(workspaceId).catch(() => null);
  const snapshots = perfData ? buildCreativePerformanceSnapshots(perfData) : [];

  // Build workflow items from snapshots.
  // Skip "insufficient_data" — not enough signal to recommend action.
  const items: CreativeLabItem[] = snapshots
    .filter((s) => s.evaluationStatus !== "insufficient_data")
    .map((snapshot, idx) => {
      const sourceType = deriveSourceType(snapshot);
      const { headline, rationale, nextAction } = deriveRecommendation(snapshot);

      return buildCreativeLabItem({
        id:                      `snap_${snapshot.externalCreativeId}_${idx}`,
        clientAccountId:         snapshot.clientAccountId,
        clientName:              snapshot.clientName,
        sourceType,
        recommendationHeadline:  headline,
        recommendationRationale: rationale,
        suggestedNextAction:     nextAction,
        snapshot,
      });
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
// Helpers — map CreativePerformanceSnapshot signals to workflow vocabulary
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
