// lib/experiments/ingestor.ts
// Pulls live performance data from MetaSyncedInsight and CRMPerformanceRow
// and assembles ExperimentMetricSnapshot objects for control and challenger.
//
// CRM attribution note:
//   CRMPerformanceRow is campaign-level (not ad-level).
//   In simultaneous mode, CRM is split between variants proportional to Meta spend.
//   In sequential mode (before/after), each window has its own CRM rows.
//   This limitation is documented in docs/experiments.md.

import { prisma }            from "../db";
import { finaliseSnapshot, buildEmptySnapshot, buildWindowDates } from "./builder";
import type {
  ExperimentPlan,
  ExperimentMetricSnapshot,
}                            from "../../types/experiment";

// ---------------------------------------------------------------------------
// Load Meta delivery totals for a variant over the window
// ---------------------------------------------------------------------------

async function loadMetaDelivery(opts: {
  externalAdAccountId: string | null;
  externalAdId?:       string | null;
  externalAdSetId?:    string | null;
  externalCampaignId?: string | null;
  windowStart:         string;
  windowEnd:           string;
}): Promise<{ spend: number; impressions: number; clicks: number }> {
  if (!opts.externalAdAccountId) return { spend: 0, impressions: 0, clicks: 0 };

  // Build filter — most specific first (ad > adset > campaign)
  const entityFilter = opts.externalAdId
    ? { externalAdId: opts.externalAdId }
    : opts.externalAdSetId
      ? { externalAdSetId: opts.externalAdSetId }
      : opts.externalCampaignId
        ? { externalCampaignId: opts.externalCampaignId }
        : {};

  if (Object.keys(entityFilter).length === 0) return { spend: 0, impressions: 0, clicks: 0 };

  const rows = await prisma.metaSyncedInsight.findMany({
    where: {
      externalAdAccountId: opts.externalAdAccountId,
      dateStart: { gte: opts.windowStart, lte: opts.windowEnd },
      ...entityFilter,
    },
    select: { spend: true, impressions: true, clicks: true },
  });

  return rows.reduce(
    (acc, r) => ({
      spend:       acc.spend       + r.spend,
      impressions: acc.impressions + r.impressions,
      clicks:      acc.clicks      + r.clicks,
    }),
    { spend: 0, impressions: 0, clicks: 0 },
  );
}

// ---------------------------------------------------------------------------
// Load CRM campaign totals over the window
// ---------------------------------------------------------------------------

async function loadCrmTotals(opts: {
  clientAccountId: string;
  windowStart:     string;
  windowEnd:       string;
}): Promise<{ orders: number; revenue: number }> {
  const rows = await prisma.cRMPerformanceRow.findMany({
    where: {
      clientAccountId: opts.clientAccountId,
      date: { gte: opts.windowStart, lte: opts.windowEnd },
    },
    select: { orders: true, revenue: true },
  });

  return rows.reduce(
    (acc, r) => ({ orders: acc.orders + r.orders, revenue: acc.revenue + r.revenue }),
    { orders: 0, revenue: 0 },
  );
}

// ---------------------------------------------------------------------------
// Allocate CRM proportionally by Meta spend ratio (simultaneous mode)
// ---------------------------------------------------------------------------

function allocateCrmBySpend(
  total: { orders: number; revenue: number },
  variantSpend: number,
  totalSpend:   number,
): { orders: number; revenue: number } {
  if (totalSpend <= 0) return { orders: 0, revenue: 0 };
  const ratio = variantSpend / totalSpend;
  return {
    orders:  Math.round(total.orders * ratio),
    revenue: total.revenue * ratio,
  };
}

// ---------------------------------------------------------------------------
// Public API: ingestExperimentResults
// Loads performance data for both variants and returns assembled snapshots.
// ---------------------------------------------------------------------------

export async function ingestExperimentResults(plan: ExperimentPlan): Promise<{
  controlSnapshot:    ExperimentMetricSnapshot;
  challengerSnapshot: ExperimentMetricSnapshot;
}> {
  const { windowStart, windowEnd } = buildWindowDates(plan);

  // Load Meta delivery for both variants
  const [controlMeta, challengerMeta] = await Promise.all([
    loadMetaDelivery({
      externalAdAccountId: plan.externalAdAccountId,
      externalAdId:        plan.controlAdExternalId,
      externalAdSetId:     plan.controlAdSetExternalId,
      externalCampaignId:  plan.controlCampaignExternalId,
      windowStart,
      windowEnd,
    }),
    loadMetaDelivery({
      externalAdAccountId: plan.externalAdAccountId,
      externalAdId:        plan.challengerAdExternalId,
      externalAdSetId:     plan.challengerAdSetExternalId,
      externalCampaignId:  plan.challengerCampaignExternalId,
      windowStart,
      windowEnd,
    }),
  ]);

  // Load CRM campaign totals
  const crmTotals = await loadCrmTotals({
    clientAccountId: plan.clientAccountId,
    windowStart,
    windowEnd,
  });

  // Allocate CRM by spend ratio (simultaneous mode)
  // In sequential mode, the caller should use separate date windows.
  const totalSpend   = controlMeta.spend + challengerMeta.spend;
  const controlCrm   = allocateCrmBySpend(crmTotals, controlMeta.spend,    totalSpend);
  const challengerCrm = allocateCrmBySpend(crmTotals, challengerMeta.spend, totalSpend);

  const controlSnapshot = finaliseSnapshot({
    variantLabel: plan.controlLabel,
    variantType:  "control",
    windowStart,
    windowEnd,
    spend:       controlMeta.spend,
    impressions: controlMeta.impressions,
    clicks:      controlMeta.clicks,
    orders:      controlCrm.orders,
    revenue:     controlCrm.revenue,
  });

  const challengerSnapshot = finaliseSnapshot({
    variantLabel: plan.challengerLabel,
    variantType:  "challenger",
    windowStart,
    windowEnd,
    spend:       challengerMeta.spend,
    impressions: challengerMeta.impressions,
    clicks:      challengerMeta.clicks,
    orders:      challengerCrm.orders,
    revenue:     challengerCrm.revenue,
  });

  return { controlSnapshot, challengerSnapshot };
}
