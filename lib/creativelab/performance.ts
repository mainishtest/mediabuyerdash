// lib/creativelab/performance.ts
// Real-data creative performance evaluation.
//
// Data linkage chain:
//   MetaSyncedInsight (level="ad")   ← ad-level spend / clicks / CTR / frequency
//          ↓ join on externalAdId
//   MetaSyncedAd                     ← externalCreativeId, externalCampaignId
//          ↓ join on externalCreativeId
//   MetaSyncedCreative               ← thumbnailUrl, imageUrl, body, callToAction
//          ↓ join on externalCampaignId
//   ReconciledCampaignPerformance    ← calculatedRoas, calculatedCpa (CRM-verified)
//
// Metrics are aggregated per (externalCreativeId, externalCampaignId).
// ROAS/CPA are campaign-level (not creative-level) — Meta doesn't provide
// creative-level conversion data without the Conversions API.
//
// This module is intentionally separate from lib/creativeDiagnosisUtils.ts,
// which uses mock copy/image metadata for the AI generation pipeline.

import { prisma } from "../db";
import type {
  CreativePerformanceSnapshot,
  CreativeEvaluationStatus,
  CreativeDiagnostic,
  CreativeOpportunity,
} from "./types";

// ---------------------------------------------------------------------------
// Evaluation thresholds
// ---------------------------------------------------------------------------

const WINDOW_DAYS      = 14;    // analyse the last 14 days of insight data
const MIN_SPEND        = 50;    // below this → insufficient_data
const STRONG_CTR_PCT   = 1.5;   // CTR ≥ 1.5% is strong scroll-stop performance
const WEAK_CTR_PCT     = 0.8;   // CTR < 0.8% is a weak hook signal
const FATIGUE_FREQ     = 3.5;   // frequency > 3.5x → audience overexposed
const STRONG_ROAS      = 2.0;   // campaign ROAS ≥ 2.0 confirms strong conversion
const WEAK_ROAS        = 1.0;   // campaign ROAS < 1.0 = spending more than earning
const HIGH_SPEND_FLOOR = 200;   // threshold for "significant spend" in diagnostics

// ---------------------------------------------------------------------------
// DB loader
// ---------------------------------------------------------------------------

export async function loadCreativePerformanceData(workspaceId: string | null) {
  const windowStart    = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  const wsFilter = workspaceId ? { workspaceId } : {};

  // Phase 1: parallel — everything except insight rows (need ad account IDs first)
  const [
    clients,
    metaAccounts,
    syncedAds,
    syncedCreatives,
    syncedCampaigns,
    reconciledPerf,
  ] = await Promise.all([
    prisma.clientAccount.findMany({
      where:  workspaceId ? { workspaceId } : {},
      select: { id: true, name: true, workspaceId: true },
    }),
    prisma.metaSelectedAdAccount.findMany({
      where:  { clientAccountId: { not: null } },
      select: {
        clientAccountId: true,
        accessibleAdAccount: { select: { externalAdAccountId: true } },
      },
    }),
    prisma.metaSyncedAd.findMany({
      where:  wsFilter,
      select: {
        externalAdId:         true,
        externalCreativeId:   true,
        externalCampaignId:   true,
        externalAdAccountId:  true,
        workspaceId:          true,
      },
    }),
    prisma.metaSyncedCreative.findMany({
      where:  wsFilter,
      select: {
        externalCreativeId: true,
        name:               true,
        title:              true,
        body:               true,
        callToAction:       true,
        imageUrl:           true,
        thumbnailUrl:       true,
      },
    }),
    prisma.metaSyncedCampaign.findMany({
      where:  wsFilter,
      select: { externalCampaignId: true, name: true },
    }),
    prisma.reconciledCampaignPerformance.findMany({
      orderBy: { dateTo: "desc" },
      take:    500,
      select:  {
        clientAccountId:    true,
        externalCampaignId: true,
        campaignName:       true,
        calculatedRoas:     true,
        calculatedCpa:      true,
        dateTo:             true,
      },
    }),
  ]);

  // Build adAccount → client map
  const adAccountToClient = new Map<string, string>();
  for (const ma of metaAccounts) {
    if (ma.clientAccountId && ma.accessibleAdAccount?.externalAdAccountId) {
      adAccountToClient.set(ma.accessibleAdAccount.externalAdAccountId, ma.clientAccountId);
    }
  }

  const adAccountIds = [...new Set(syncedAds.map((a) => a.externalAdAccountId))];

  // Phase 2: ad-level insight rows (needs adAccountIds from Phase 1)
  const insightRows =
    adAccountIds.length > 0
      ? await prisma.metaSyncedInsight.findMany({
          where: {
            externalAdAccountId: { in: adAccountIds },
            level:               "ad",
            dateStart:           { gte: windowStartStr },
            externalAdId:        { not: "" },
          },
          select: {
            externalAdAccountId: true,
            externalAdId:        true,
            externalCampaignId:  true,
            spend:               true,
            impressions:         true,
            clicks:              true,
            frequency:           true,
          },
        })
      : [];

  // Build lookup maps
  const clientMap       = new Map(clients.map((c) => [c.id, c]));
  const creativeMap     = new Map(syncedCreatives.map((c) => [c.externalCreativeId, c]));
  const adMap           = new Map(syncedAds.map((a) => [a.externalAdId, a]));
  const campaignNameMap = new Map(syncedCampaigns.map((c) => [c.externalCampaignId, c.name]));

  // Latest reconciled per campaign (already ordered by dateTo desc → first = latest)
  const latestReconciledByCampaign = new Map<string, (typeof reconciledPerf)[0]>();
  for (const row of reconciledPerf) {
    if (!latestReconciledByCampaign.has(row.externalCampaignId)) {
      latestReconciledByCampaign.set(row.externalCampaignId, row);
    }
  }

  return {
    clientMap,
    adAccountToClient,
    adMap,
    creativeMap,
    campaignNameMap,
    latestReconciledByCampaign,
    insightRows,
  };
}

// ---------------------------------------------------------------------------
// Aggregator — joins insight rows to creatives, computes per-(creative, campaign)
// ---------------------------------------------------------------------------

export function buildCreativePerformanceSnapshots(
  data: Awaited<ReturnType<typeof loadCreativePerformanceData>>
): CreativePerformanceSnapshot[] {
  const {
    clientMap,
    adAccountToClient,
    adMap,
    creativeMap,
    campaignNameMap,
    latestReconciledByCampaign,
    insightRows,
  } = data;

  // Aggregate metrics per (externalCreativeId, externalCampaignId)
  type AggKey = string; // `${creativeId}::${campaignId}`
  const aggs = new Map<
    AggKey,
    {
      externalCreativeId:  string;
      externalCampaignId:  string;
      externalAdAccountId: string;
      spend:               number;
      impressions:         number;
      clicks:              number;
      freqValues:          number[];
    }
  >();

  for (const row of insightRows) {
    const ad = adMap.get(row.externalAdId);
    if (!ad || !ad.externalCreativeId) continue;

    const key: AggKey = `${ad.externalCreativeId}::${row.externalCampaignId}`;
    const existing    = aggs.get(key);

    if (!existing) {
      aggs.set(key, {
        externalCreativeId:  ad.externalCreativeId,
        externalCampaignId:  row.externalCampaignId,
        externalAdAccountId: row.externalAdAccountId,
        spend:               row.spend,
        impressions:         row.impressions,
        clicks:              row.clicks,
        freqValues:          row.frequency != null ? [row.frequency] : [],
      });
    } else {
      existing.spend       += row.spend;
      existing.impressions += row.impressions;
      existing.clicks      += row.clicks;
      if (row.frequency != null) existing.freqValues.push(row.frequency);
    }
  }

  const snapshots: CreativePerformanceSnapshot[] = [];

  for (const agg of aggs.values()) {
    const clientId = adAccountToClient.get(agg.externalAdAccountId);
    if (!clientId) continue;

    const client = clientMap.get(clientId);
    if (!client) continue;

    const creative   = creativeMap.get(agg.externalCreativeId);
    const reconciled = latestReconciledByCampaign.get(agg.externalCampaignId);

    const avgCtr =
      agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;

    const avgFrequency =
      agg.freqValues.length > 0
        ? agg.freqValues.reduce((a, b) => a + b, 0) / agg.freqValues.length
        : null;

    const campaignName =
      reconciled?.campaignName ??
      campaignNameMap.get(agg.externalCampaignId) ??
      agg.externalCampaignId;

    const snapshot: CreativePerformanceSnapshot = {
      externalCreativeId: agg.externalCreativeId,
      creativeName:       creative?.name ?? null,
      thumbnailUrl:       creative?.thumbnailUrl ?? null,
      imageUrl:           creative?.imageUrl ?? null,
      adTitle:            creative?.title ?? null,
      adCopy:             creative?.body ?? null,
      callToAction:       creative?.callToAction ?? null,

      externalCampaignId: agg.externalCampaignId,
      campaignName,
      clientAccountId:    clientId,
      clientName:         client.name,

      spend:        agg.spend,
      impressions:  agg.impressions,
      clicks:       agg.clicks,
      avgCtr,
      avgFrequency,

      campaignRoas: reconciled?.calculatedRoas ?? null,
      campaignCpa:  reconciled?.calculatedCpa  ?? null,

      evaluationStatus: "insufficient_data", // computed below
    };

    snapshot.evaluationStatus = evaluateCreative(snapshot);
    snapshots.push(snapshot);
  }

  // Sort: high-spend first so most meaningful creatives appear at top
  return snapshots.sort((a, b) => b.spend - a.spend);
}

// ---------------------------------------------------------------------------
// Evaluator — assigns CreativeEvaluationStatus
// ---------------------------------------------------------------------------

export function evaluateCreative(s: CreativePerformanceSnapshot): CreativeEvaluationStatus {
  if (s.spend < MIN_SPEND) return "insufficient_data";

  const isHighFreq  = s.avgFrequency !== null && s.avgFrequency > FATIGUE_FREQ;
  const isStrongCtr = s.avgCtr >= STRONG_CTR_PCT;
  const isWeakCtr   = s.avgCtr < WEAK_CTR_PCT;
  const hasGoodRoas = s.campaignRoas !== null && s.campaignRoas >= STRONG_ROAS;

  // Fatigue overrides everything — high frequency regardless of CTR
  if (isHighFreq) return "fatigued";

  // Strong requires both high CTR and confirmed ROAS
  if (isStrongCtr && hasGoodRoas) return "strong";

  // Weak: low CTR, OR high CTR with confirmed poor ROAS (click-through disconnect)
  if (isWeakCtr) return "weak";
  if (isStrongCtr && s.campaignRoas !== null && s.campaignRoas < WEAK_ROAS) return "weak";

  return "average";
}

// ---------------------------------------------------------------------------
// Diagnoser — explains the evaluation with signals and recommended action
// ---------------------------------------------------------------------------

export function diagnoseCreative(s: CreativePerformanceSnapshot): CreativeDiagnostic {
  const isHighFreq   = s.avgFrequency !== null && s.avgFrequency > FATIGUE_FREQ;
  const isWeakCtr    = s.avgCtr < WEAK_CTR_PCT;
  const isStrongCtr  = s.avgCtr >= STRONG_CTR_PCT;
  const hasGoodRoas  = s.campaignRoas !== null && s.campaignRoas >= STRONG_ROAS;
  const hasPoorRoas  = s.campaignRoas !== null && s.campaignRoas < WEAK_ROAS;
  const isHighSpend  = s.spend >= HIGH_SPEND_FLOOR;

  const ctrStr  = s.avgCtr.toFixed(2);
  const freqStr = s.avgFrequency != null ? s.avgFrequency.toFixed(1) : null;
  const roasStr = s.campaignRoas  != null ? s.campaignRoas.toFixed(2) : null;
  const spendStr = `$${Math.round(s.spend).toLocaleString()}`;

  // ── Insufficient data ────────────────────────────────────────────────────
  if (s.evaluationStatus === "insufficient_data") {
    return {
      externalCreativeId:   s.externalCreativeId,
      primaryIssue:         "Insufficient Data",
      supportingSignals:    [
        `${spendStr} spent — need ≥$${MIN_SPEND} for a reliable signal`,
      ],
      recommendedDirection:
        "Allow this creative to accumulate more spend before evaluating. Avoid pausing too early.",
    };
  }

  // ── Creative fatigue (high freq + weak CTR — strongest signal) ───────────
  if (isHighFreq && isWeakCtr) {
    return {
      externalCreativeId:   s.externalCreativeId,
      primaryIssue:         "Creative Fatigue",
      supportingSignals:    [
        `Frequency ${freqStr}x — audience has seen this ad too many times`,
        `CTR ${ctrStr}% — engagement has declined due to overexposure`,
        ...(isHighSpend ? [`${spendStr} spent on a fatigued creative`] : []),
      ],
      recommendedDirection:
        "Replace immediately. Develop a fresh creative with a different visual concept and hook angle. Do not increase budget on this creative.",
    };
  }

  // ── Creative fatigue (high freq only) ───────────────────────────────────
  if (isHighFreq) {
    return {
      externalCreativeId:   s.externalCreativeId,
      primaryIssue:         "Creative Fatigue",
      supportingSignals:    [
        `Frequency ${freqStr}x — audience is overexposed to this creative`,
        `CTR ${ctrStr}% — click-through still holding but likely to decline`,
      ],
      recommendedDirection:
        "Begin developing a replacement now. Rotate in a fresh creative before CTR drops. Preserve what is working in the new concept.",
    };
  }

  // ── Strong performer ─────────────────────────────────────────────────────
  if (isStrongCtr && hasGoodRoas) {
    return {
      externalCreativeId:   s.externalCreativeId,
      primaryIssue:         "Strong Performer",
      supportingSignals:    [
        `CTR ${ctrStr}% — strong scroll-stop and click-through rate`,
        ...(roasStr ? [`Campaign ROAS ${roasStr}x — clicks converting to revenue`] : []),
        ...(freqStr ? [`Frequency ${freqStr}x — audience engagement holding`] : []),
      ],
      recommendedDirection:
        "Scale budget on this creative. Develop variants that preserve the core hook, visual style, and message structure. Do not change what is working.",
    };
  }

  // ── Click-through disconnect (clicks but not converting) ─────────────────
  if (isStrongCtr && hasPoorRoas && isHighSpend) {
    return {
      externalCreativeId:   s.externalCreativeId,
      primaryIssue:         "Click-Through Disconnect",
      supportingSignals:    [
        `CTR ${ctrStr}% — the ad is generating strong click-through`,
        ...(roasStr ? [`Campaign ROAS ${roasStr}x — clicks are not converting to revenue`] : []),
        `${spendStr} spent with poor return`,
      ],
      recommendedDirection:
        "The creative hook is working, but the post-click experience is failing. Review landing page relevance, offer clarity, and pricing alignment. This is not a creative issue — it is an offer or funnel issue.",
    };
  }

  // ── Weak hook (low CTR + high spend) ────────────────────────────────────
  if (isWeakCtr && isHighSpend) {
    return {
      externalCreativeId:   s.externalCreativeId,
      primaryIssue:         "Weak Hook",
      supportingSignals:    [
        `CTR ${ctrStr}% — poor scroll-stop rate; audience is not engaging`,
        `${spendStr} spent without generating proportionate clicks`,
        ...(roasStr ? [`Campaign ROAS ${roasStr}x`] : []),
      ],
      recommendedDirection:
        "Test a stronger opening frame or benefit-led headline. Prioritize pattern-interrupt visuals. Reduce budget on this creative while testing replacements.",
    };
  }

  // ── Weak hook (low CTR) ──────────────────────────────────────────────────
  if (isWeakCtr) {
    return {
      externalCreativeId:   s.externalCreativeId,
      primaryIssue:         "Weak Hook",
      supportingSignals:    [
        `CTR ${ctrStr}% — below the ${WEAK_CTR_PCT}% threshold for an effective hook`,
        ...(roasStr ? [`Campaign ROAS ${roasStr}x`] : []),
      ],
      recommendedDirection:
        "Test a stronger visual hook or a more direct benefit-led headline. One variable at a time.",
    };
  }

  // ── Average performance ──────────────────────────────────────────────────
  return {
    externalCreativeId:   s.externalCreativeId,
    primaryIssue:         "Average Performance",
    supportingSignals:    [
      `CTR ${ctrStr}% — within normal range (${WEAK_CTR_PCT}–${STRONG_CTR_PCT}%)`,
      ...(roasStr ? [`Campaign ROAS ${roasStr}x`] : [
        "No CRM-verified ROAS available — run reconciliation for this campaign",
      ]),
      ...(freqStr ? [`Frequency ${freqStr}x`] : []),
    ],
    recommendedDirection:
      "Monitor this creative. Test one variable at a time (hook image, headline text, CTA wording) to move toward strong status.",
  };
}

// ---------------------------------------------------------------------------
// Opportunities builder
// ---------------------------------------------------------------------------

export function buildCreativeOpportunities(
  snapshots: CreativePerformanceSnapshot[]
): CreativeOpportunity[] {
  const opps: CreativeOpportunity[] = [];
  const urgencyRank: Record<string, number> = { high: 2, medium: 1, low: 0 };

  for (const s of snapshots) {
    if (s.evaluationStatus === "insufficient_data") continue;

    // Scale: strong performer
    if (s.evaluationStatus === "strong") {
      opps.push({
        externalCreativeId: s.externalCreativeId,
        creativeName:       s.creativeName,
        opportunityType:    "scale",
        headline:           "Scale this creative",
        description: [
          `CTR ${s.avgCtr.toFixed(2)}%`,
          s.campaignRoas != null ? `ROAS ${s.campaignRoas.toFixed(2)}x` : null,
          `$${Math.round(s.spend)} spend`,
          "→ increase budget and develop variants preserving the core hook.",
        ]
          .filter(Boolean)
          .join(" · "),
        urgency: "high",
      });
    }

    // Retire: fatigued
    if (s.evaluationStatus === "fatigued") {
      opps.push({
        externalCreativeId: s.externalCreativeId,
        creativeName:       s.creativeName,
        opportunityType:    "retire",
        headline:           "Replace fatigued creative",
        description: [
          s.avgFrequency != null ? `Frequency ${s.avgFrequency.toFixed(1)}x` : null,
          `CTR ${s.avgCtr.toFixed(2)}%`,
          "→ audience is overexposed. Develop fresh creative before performance collapses.",
        ]
          .filter(Boolean)
          .join(" · "),
        urgency: "high",
      });
    }

    // Iterate: weak + meaningful spend
    if (s.evaluationStatus === "weak" && s.spend >= HIGH_SPEND_FLOOR) {
      opps.push({
        externalCreativeId: s.externalCreativeId,
        creativeName:       s.creativeName,
        opportunityType:    "iterate",
        headline:           "Iterate on underperforming creative",
        description: [
          `CTR ${s.avgCtr.toFixed(2)}%`,
          `$${Math.round(s.spend)} spent`,
          s.campaignRoas != null ? `ROAS ${s.campaignRoas.toFixed(2)}x` : null,
          "→ test a stronger hook or visual before pausing spend.",
        ]
          .filter(Boolean)
          .join(" · "),
        urgency: "medium",
      });
    }

    // Refresh: average but approaching fatigue threshold
    if (
      s.evaluationStatus === "average" &&
      s.avgFrequency != null &&
      s.avgFrequency > 2.5
    ) {
      opps.push({
        externalCreativeId: s.externalCreativeId,
        creativeName:       s.creativeName,
        opportunityType:    "refresh",
        headline:           "Refresh before fatigue sets in",
        description: [
          `Frequency ${s.avgFrequency.toFixed(1)}x — approaching the ${FATIGUE_FREQ}x fatigue threshold`,
          "→ proactively rotate in a fresh variant now.",
        ].join(" "),
        urgency: "low",
      });
    }
  }

  return opps.sort(
    (a, b) => urgencyRank[b.urgency] - urgencyRank[a.urgency]
  );
}
