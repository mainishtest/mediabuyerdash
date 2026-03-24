// app/creative-lab/workspace/page.tsx
// Creative Review Workspace — server component entry point.
//
// Data flow (same pattern as /creative-lab/page.tsx):
//   1. Load creative performance snapshots from Meta sync + reconciliation.
//   2. Build CreativeLabItems with stable IDs.
//   3. Load persisted workflow state from DB.
//   4. Merge snapshot + DB state.
//   5. Enrich with brief + variant data.
//   6. Load launch queue from publish prep records.
//   7. Pass to CreativeReviewWorkspace client component.

export const dynamic = "force-dynamic";

import { getServerSession }           from "next-auth";
import { authOptions }                from "../../../lib/auth";
import { prisma }                     from "../../../lib/db";
import {
  loadCreativePerformanceData,
  buildCreativePerformanceSnapshots,
}                                     from "../../../lib/creativelab/performance";
import { buildCreativeLabItem }       from "../../../lib/creativelab/workflowUtils";
import {
  buildWorkflowItemId,
  getWorkflowStates,
}                                     from "../../../lib/creativelab/db";
import type {
  CreativeLabItem,
  CreativeLabSourceType,
}                                     from "../../../types/creativeLab";
import type { CreativePerformanceSnapshot } from "../../../lib/creativelab/types";
import { CreativeReviewWorkspace }    from "./CreativeReviewWorkspace";

export const metadata = {
  title: "Creative Review Workspace — Media Buying Dashboard",
};

type PageProps = {
  searchParams: { clientId?: string };
};

export default async function WorkspacePage({ searchParams }: PageProps) {
  const session     = await getServerSession(authOptions);
  const workspaceId = session?.user?.workspaceId ?? null;
  const selectedClientId = searchParams?.clientId ?? null;

  // ── Load clients ────────────────────────────────────────────────────────
  const clients = await prisma.clientAccount
    .findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
      where:   workspaceId ? { workspaceId } : {},
    })
    .catch(() => []);

  // ── Load creative performance snapshots ─────────────────────────────────
  const perfData  = await loadCreativePerformanceData(workspaceId).catch(() => null);
  const snapshots = perfData ? buildCreativePerformanceSnapshots(perfData) : [];

  // Build workflow items
  const rawItems = snapshots
    .filter((s) => s.evaluationStatus !== "insufficient_data")
    .map((snapshot) => {
      const id = buildWorkflowItemId(
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

  // Load persisted workflow state
  const persistedStates = await getWorkflowStates(
    rawItems.map((r) => r.id),
  ).catch(() => new Map<string, never>());

  // Merge snapshot + DB state
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

  // ── Enrich with brief + variant data ────────────────────────────────────
  const itemIds = items.map((i) => i.id);
  const briefs = await prisma.creativeBriefRecord
    .findMany({
      where:   { sourceItemId: { in: itemIds } },
      include: { variants: true },
    })
    .catch(() => []);

  const briefBySource = new Map(briefs.map((b) => [b.sourceItemId, b]));

  const enrichedItems = items.map((item) => {
    const brief = briefBySource.get(item.id);
    if (!brief) return { ...item, briefId: null, copyVariations: [], imageVariations: [] };

    const copyVariations = brief.variants
      .filter((v) => v.variantType === "copy")
      .map((v) => {
        const content = safeJson(v.contentJson);
        return {
          id:             v.id,
          title:          v.title,
          hook:           content?.hook ?? "",
          body:           content?.body ?? "",
          callToAction:   content?.callToAction ?? "",
          approvalStatus: v.reviewDecision ?? "draft",
        };
      });

    const imageVariations = brief.variants
      .filter((v) => v.variantType === "image")
      .map((v) => {
        const content = safeJson(v.contentJson);
        return {
          id:             v.id,
          title:          v.title,
          conceptSummary: content?.conceptSummary ?? "",
          visualChanges:  content?.visualChanges ?? "",
          goal:           content?.goal ?? "",
          thumbnailUrl:   null,
          approvalStatus: v.reviewDecision ?? "draft",
        };
      });

    return { ...item, briefId: brief.id, copyVariations, imageVariations };
  });

  // ── Load launch queue ───────────────────────────────────────────────────
  const prepItems = await prisma.publishPrepRecord
    .findMany({
      where:   selectedClientId ? { clientAccountId: selectedClientId } : {},
      orderBy: { createdAt: "desc" },
      take:    30,
    })
    .catch(() => []);

  const launchQueue = prepItems.map((p) => ({
    id:            p.id,
    testName:      p.variantTitle ?? "Untitled",
    campaignName:  p.campaignName ?? null,
    status:        mapPrepStatus(p.status),
    blockedReason: p.status === "blocked" ? (p.publishError ?? "Missing requirements") : null,
    createdAt:     p.createdAt.toISOString(),
  }));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <CreativeReviewWorkspace
      clients={clients}
      initialItems={enrichedItems}
      launchQueue={launchQueue}
      selectedClientId={selectedClientId}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers (same as creative-lab/page.tsx)
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
        ].filter(Boolean).join(" "),
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
        ].filter(Boolean).join(" "),
        nextAction: "Review creative hook and CTA — iterate or replace",
      };

    default:
      return {
        headline:  "Monitor — moderate performance",
        rationale: `CTR ${ctrStr}%. ${roasStr ? `Campaign ROAS ${roasStr}.` : ""} Performance is within range but not above goal.`.trim(),
        nextAction: "Monitor for 7 more days before making changes",
      };
  }
}

function mapPrepStatus(dbStatus: string): "blocked" | "incomplete" | "ready" | "launched" {
  if (dbStatus === "published") return "launched";
  if (dbStatus === "ready_to_publish" || dbStatus === "approved_for_launch") return "ready";
  if (dbStatus === "blocked") return "blocked";
  return "incomplete";
}

function safeJson(val: unknown): Record<string, string> {
  if (!val) return {};
  if (typeof val === "object") return val as Record<string, string>;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return {};
}
