// ─────────────────────────────────────────────────────────────────────────────
// API Route: Quick Review & Launch
// ─────────────────────────────────────────────────────────────────────────────
// GET:  Load a review set from a generation run
// POST: Approve/reject a candidate, build launch draft, or execute launch
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import {
  buildCreativeReviewSet,
  approveCreativeCandidate,
  buildCreativeLaunchDraft,
  validateCreativeLaunchDraft,
  loadClientMetaTargets,
  executeCreativeTestLaunch,
} from "../../../../lib/quickReviewLaunch";

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId");
  const clientId = req.nextUrl.searchParams.get("clientId");

  if (!runId) {
    return NextResponse.json(
      { ok: false, error: "runId is required" },
      { status: 400 }
    );
  }

  try {
    const reviewSet = await buildCreativeReviewSet(runId);
    if (!reviewSet) {
      return NextResponse.json(
        { ok: false, error: "Generation run not found" },
        { status: 404 }
      );
    }

    // Also load Meta targets if we have a client
    const targetClientId = clientId || reviewSet.clientAccountId;
    const metaTargets = targetClientId
      ? await loadClientMetaTargets(targetClientId)
      : { campaigns: [], adSets: [] };

    return NextResponse.json({
      ok: true,
      reviewSet,
      metaTargets,
    });
  } catch (err) {
    console.error("Quick review load error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load review set" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body as { action: string };

    // ── Action: Approve/Reject a candidate ──
    if (action === "approve" || action === "reject") {
      const { generationRunId, variationType, variationId, notes } = body as {
        generationRunId: string;
        variationType: "copy" | "image";
        variationId: string;
        notes?: string;
      };

      if (!generationRunId || !variationType || !variationId) {
        return NextResponse.json(
          { ok: false, error: "generationRunId, variationType, and variationId are required" },
          { status: 400 }
        );
      }

      const result = await approveCreativeCandidate(
        generationRunId,
        variationType,
        variationId,
        action === "approve" ? "approved" : "rejected",
        notes
      );

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, decision: action });
    }

    // ── Action: Build launch draft and check readiness ──
    if (action === "check_readiness") {
      const { generationRunId, target } = body as {
        generationRunId: string;
        target?: {
          externalAdAccountId?: string;
          targetCampaignExternalId?: string;
          targetCampaignName?: string;
          targetAdSetExternalId?: string;
          targetAdSetName?: string;
          destinationUrl?: string;
          ctaType?: string;
        };
      };

      if (!generationRunId) {
        return NextResponse.json(
          { ok: false, error: "generationRunId is required" },
          { status: 400 }
        );
      }

      const draft = await buildCreativeLaunchDraft(generationRunId, target);
      if (!draft) {
        return NextResponse.json(
          { ok: false, error: "No approved variations found" },
          { status: 404 }
        );
      }

      const status = validateCreativeLaunchDraft(draft);

      return NextResponse.json({ ok: true, draft, launchStatus: status });
    }

    // ── Action: Execute Meta launch ──
    if (action === "launch") {
      const { generationRunId, target, executionMode } = body as {
        generationRunId: string;
        target?: {
          externalAdAccountId?: string;
          targetCampaignExternalId?: string;
          targetCampaignName?: string;
          targetAdSetExternalId?: string;
          targetAdSetName?: string;
          destinationUrl?: string;
          ctaType?: string;
        };
        executionMode?: "manual_publish" | "guarded_publish";
      };

      if (!generationRunId) {
        return NextResponse.json(
          { ok: false, error: "generationRunId is required" },
          { status: 400 }
        );
      }

      const draft = await buildCreativeLaunchDraft(generationRunId, target);
      if (!draft) {
        return NextResponse.json(
          { ok: false, error: "No approved variations found for launch" },
          { status: 404 }
        );
      }

      // Validate before launch
      const status = validateCreativeLaunchDraft(draft);
      if (!status.canLaunch) {
        return NextResponse.json(
          {
            ok: false,
            error: "Launch blocked",
            blockers: status.blockers,
          },
          { status: 422 }
        );
      }

      // Execute
      const result = await executeCreativeTestLaunch(draft, {
        executionMode: executionMode || "guarded_publish",
      });

      return NextResponse.json({
        ok: result.success,
        result,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("Quick review action error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}
