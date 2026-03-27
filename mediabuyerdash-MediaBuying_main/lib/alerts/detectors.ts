// lib/alerts/detectors.ts
// Anomaly detection functions for the alerting system.
//
// All functions are pure — they receive pre-loaded DetectionInput and return
// AlertEventDraft[]. No DB access here.
//
// Detection thresholds (v1):
//   ROAS drop:    >30% decline vs 7-day baseline     (min $50 spend in both windows)
//   CPA spike:    >30% increase vs 7-day baseline    (min $50 spend + 3 orders)
//   Spend drop:   >40% decline vs 7-day baseline     (min $50 baseline spend)
//   Spend spike:  >60% increase vs 7-day baseline    (min $50 baseline spend)
//   Stale sync:   >48h since last completed sync
//   Integration:  no Meta mapping or no Shopify for a live client
//   Goal:         calculatedRoas vs MetaCampaignGoal

import { prisma }            from "../db";
import { normalizeUtmValue } from "../reconciliation/utils";
import type { AlertEventDraft, AlertSeverity } from "./types";

// ---------------------------------------------------------------------------
// Detection thresholds
// ---------------------------------------------------------------------------

const ROAS_DROP_THRESHOLD    = 0.30;
const CPA_SPIKE_THRESHOLD    = 0.30;
const SPEND_DROP_THRESHOLD   = 0.40;
const SPEND_SPIKE_THRESHOLD  = 0.60;
const ABOVE_GOAL_FACTOR      = 1.20;
const MIN_SPEND_THRESHOLD    = 50;
const MIN_ORDERS_THRESHOLD   = 3;
const STALE_HOURS            = 48;
const HIGH_STALE_HOURS       = 7 * 24;
const DETECTION_WINDOW_DAYS  = 14;  // split into two 7-day windows

// ---------------------------------------------------------------------------
// Data types for pre-loaded input
// ---------------------------------------------------------------------------

export type InsightRow = {
  externalAdAccountId: string;
  externalCampaignId:  string;
  dateStart:           string;
  spend:               number;
};

export type OrderRow = {
  clientAccountId: string;
  utmCampaign:     string | null;
  orderCreatedAt:  Date;
  totalPrice:      number;
};

export type CampaignWithGoal = {
  externalCampaignId:  string;
  externalAdAccountId: string;
  name:                string;
  goal: {
    roasGoalType:  string;
    roasGoalValue: number;
    cpaGoalType:   string;
    cpaGoalValue:  number;
  } | null;
};

export type ClientInfo = {
  id:          string;
  name:        string;
  workspaceId: string | null;
};

export type DetectionInput = {
  workspaceId:          string | null;
  clients:              ClientInfo[];
  clientsWithMeta:      Set<string>;
  clientsWithShopify:   Set<string>;
  adAccountToClient:    Map<string, string>;    // externalAdAccountId → clientAccountId
  clientCampaigns:      Map<string, CampaignWithGoal[]>;
  latestSyncByClient:   Map<string, { completedAt: Date | null; status: string }>;
  insightRows:          InsightRow[];
  orderRows:            OrderRow[];
  latestReconciledByClient: Map<string, {
    externalCampaignId: string;
    campaignName:       string;
    calculatedRoas:     number | null;
    calculatedCpa:      number | null;
    metaSpend:          number;
  }[]>;
};

// ---------------------------------------------------------------------------
// DB loader — fetches all data needed for detection
// ---------------------------------------------------------------------------

export async function loadDetectionInput(
  workspaceId: string | null
): Promise<DetectionInput> {
  const now             = new Date();
  const windowStart     = new Date(now);
  windowStart.setDate(now.getDate() - DETECTION_WINDOW_DAYS);
  const windowStartStr  = windowStart.toISOString().slice(0, 10);
  const windowStartDate = new Date(windowStart.getTime());

  const clientWhere = workspaceId ? { workspaceId } : {};

  // Phase 1: parallel batch queries
  const [
    clients,
    metaAccounts,
    shopifyConns,
    syncRuns,
    reconciledRows,
  ] = await Promise.all([
    prisma.clientAccount.findMany({
      where:  clientWhere,
      select: { id: true, name: true, workspaceId: true },
    }),
    prisma.metaSelectedAdAccount.findMany({
      where:  { clientAccountId: { not: null } },
      select: {
        clientAccountId: true,
        accessibleAdAccount: { select: { externalAdAccountId: true } },
      },
    }),
    prisma.shopifyConnection.findMany({
      where:  { clientAccountId: { not: null }, connectionStatus: "active" },
      select: { clientAccountId: true },
    }),
    prisma.clientSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take:    2000,
      select:  { clientAccountId: true, status: true, completedAt: true },
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
        metaSpend:          true,
        dateTo:             true,
      },
    }),
  ]);

  // Build adAccount → client map
  const adAccountToClient = new Map<string, string>();
  for (const ma of metaAccounts) {
    if (ma.clientAccountId && ma.accessibleAdAccount?.externalAdAccountId) {
      adAccountToClient.set(
        ma.accessibleAdAccount.externalAdAccountId,
        ma.clientAccountId
      );
    }
  }

  const adAccountIds = Array.from(adAccountToClient.keys());
  const clientIds    = clients.map((c) => c.id);

  // Phase 2: time-series data + campaigns (needs adAccountIds)
  const [insightRows, orderRows, campaignRows] = await Promise.all([
    adAccountIds.length > 0
      ? prisma.metaSyncedInsight.findMany({
          where: {
            externalAdAccountId: { in: adAccountIds },
            level:               "campaign",
            dateStart:           { gte: windowStartStr },
            externalCampaignId:  { not: "" },
          },
          select: {
            externalAdAccountId: true,
            externalCampaignId:  true,
            dateStart:           true,
            spend:               true,
          },
        })
      : Promise.resolve([]),
    clientIds.length > 0
      ? prisma.shopifyOrder.findMany({
          where: {
            clientAccountId: { in: clientIds },
            orderCreatedAt:  { gte: windowStartDate },
          },
          select: {
            clientAccountId: true,
            utmCampaign:     true,
            orderCreatedAt:  true,
            totalPrice:      true,
          },
        })
      : Promise.resolve([]),
    adAccountIds.length > 0
      ? prisma.metaSyncedCampaign.findMany({
          where:  { externalAdAccountId: { in: adAccountIds } },
          select: {
            externalCampaignId:  true,
            externalAdAccountId: true,
            name:                true,
            goal: {
              select: {
                roasGoalType:  true,
                roasGoalValue: true,
                cpaGoalType:   true,
                cpaGoalValue:  true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  // Index: client → campaigns
  const clientCampaigns = new Map<string, CampaignWithGoal[]>();
  for (const c of campaignRows) {
    const clientId = adAccountToClient.get(c.externalAdAccountId);
    if (!clientId) continue;
    const list = clientCampaigns.get(clientId) ?? [];
    list.push(c);
    clientCampaigns.set(clientId, list);
  }

  // Index: client → latest sync
  const latestSyncByClient = new Map<string, { completedAt: Date | null; status: string }>();
  for (const run of syncRuns) {
    if (!latestSyncByClient.has(run.clientAccountId)) {
      latestSyncByClient.set(run.clientAccountId, {
        completedAt: run.completedAt,
        status:      run.status,
      });
    }
  }

  // Index: client → latest reconciled rows
  const latestDateToByClient = new Map<string, string>();
  for (const row of reconciledRows) {
    const cur = latestDateToByClient.get(row.clientAccountId);
    if (!cur || row.dateTo > cur) latestDateToByClient.set(row.clientAccountId, row.dateTo);
  }
  const latestReconciledByClient = new Map<string, typeof reconciledRows>();
  for (const row of reconciledRows) {
    if (row.dateTo !== latestDateToByClient.get(row.clientAccountId)) continue;
    const list = latestReconciledByClient.get(row.clientAccountId) ?? [];
    list.push(row);
    latestReconciledByClient.set(row.clientAccountId, list);
  }

  return {
    workspaceId,
    clients:              clients as ClientInfo[],
    clientsWithMeta:      new Set(metaAccounts.filter((m) => m.clientAccountId).map((m) => m.clientAccountId as string)),
    clientsWithShopify:   new Set(shopifyConns.filter((c) => c.clientAccountId).map((c) => c.clientAccountId as string)),
    adAccountToClient,
    clientCampaigns,
    latestSyncByClient,
    insightRows:          insightRows as InsightRow[],
    orderRows:            orderRows as OrderRow[],
    latestReconciledByClient,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupKey(clientId: string, alertType: string, entityId: string): string {
  return `${clientId}:${alertType}:${entityId}`;
}

function fmtRoas(v: number): string { return `${v.toFixed(2)}x`; }
function fmtDollar(v: number): string {
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPct(v: number): string { return `${(v * 100).toFixed(0)}%`; }

// Build 7d window boundaries relative to today
function windowBoundaries(): { recentCutoff: string; baselineCutoff: string } {
  const now           = new Date();
  const sevenDaysAgo  = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenAgo   = new Date(now); fourteenAgo.setDate(now.getDate() - 14);
  return {
    recentCutoff:   sevenDaysAgo.toISOString().slice(0, 10),
    baselineCutoff: fourteenAgo.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// 1. detectRoasDropAlerts
// ---------------------------------------------------------------------------

export function detectRoasDropAlerts(input: DetectionInput): AlertEventDraft[] {
  const drafts: AlertEventDraft[] = [];
  const { recentCutoff, baselineCutoff } = windowBoundaries();

  for (const [clientId, campaigns] of input.clientCampaigns) {
    const client      = input.clients.find((c) => c.id === clientId);
    if (!client)      continue;
    const clientOrders = input.orderRows.filter((o) => o.clientAccountId === clientId);

    for (const campaign of campaigns) {
      const cInsights   = input.insightRows.filter((r) => r.externalCampaignId === campaign.externalCampaignId);
      const recentIns   = cInsights.filter((r) => r.dateStart >= recentCutoff);
      const baselineIns = cInsights.filter((r) => r.dateStart >= baselineCutoff && r.dateStart < recentCutoff);

      const recentSpend   = recentIns.reduce((s, r) => s + r.spend, 0);
      const baselineSpend = baselineIns.reduce((s, r) => s + r.spend, 0);
      if (recentSpend < MIN_SPEND_THRESHOLD || baselineSpend < MIN_SPEND_THRESHOLD) continue;

      const normName      = normalizeUtmValue(campaign.name);
      const recentRev     = clientOrders
        .filter((o) => o.orderCreatedAt.toISOString().slice(0, 10) >= recentCutoff && normalizeUtmValue(o.utmCampaign ?? "") === normName)
        .reduce((s, o) => s + o.totalPrice, 0);
      const baselineRev   = clientOrders
        .filter((o) => { const d = o.orderCreatedAt.toISOString().slice(0, 10); return d >= baselineCutoff && d < recentCutoff && normalizeUtmValue(o.utmCampaign ?? "") === normName; })
        .reduce((s, o) => s + o.totalPrice, 0);

      const recentRoas   = recentRev   / recentSpend;
      const baselineRoas = baselineRev / baselineSpend;
      if (baselineRoas < 0.5) continue; // too low to be meaningful baseline

      const dropPct = (recentRoas - baselineRoas) / baselineRoas;
      if (dropPct < -ROAS_DROP_THRESHOLD) {
        drafts.push({
          clientAccountId:  clientId,
          clientName:       client.name,
          workspaceId:      client.workspaceId,
          alertType:        "roas_drop",
          severity:         "high",
          source:           "reconciled",
          entityType:       "campaign",
          entityId:         campaign.externalCampaignId,
          entityName:       campaign.name,
          summary:          `ROAS dropped ${fmtPct(Math.abs(dropPct))} vs prior 7 days (${fmtRoas(recentRoas)} vs ${fmtRoas(baselineRoas)}).`,
          supportingMetrics: {
            recentRoas:    fmtRoas(recentRoas),
            baselineRoas:  fmtRoas(baselineRoas),
            dropPct:       fmtPct(Math.abs(dropPct)),
            recentSpend:   fmtDollar(recentSpend),
          },
          deduplicationKey: dedupKey(clientId, "roas_drop", campaign.externalCampaignId),
        });
      }
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// 2. detectCpaSpikeAlerts
// ---------------------------------------------------------------------------

export function detectCpaSpikeAlerts(input: DetectionInput): AlertEventDraft[] {
  const drafts: AlertEventDraft[] = [];
  const { recentCutoff, baselineCutoff } = windowBoundaries();

  for (const [clientId, campaigns] of input.clientCampaigns) {
    const client      = input.clients.find((c) => c.id === clientId);
    if (!client)      continue;
    const clientOrders = input.orderRows.filter((o) => o.clientAccountId === clientId);

    for (const campaign of campaigns) {
      const cInsights    = input.insightRows.filter((r) => r.externalCampaignId === campaign.externalCampaignId);
      const recentSpend  = cInsights.filter((r) => r.dateStart >= recentCutoff).reduce((s, r) => s + r.spend, 0);
      const baselineSpend = cInsights.filter((r) => r.dateStart >= baselineCutoff && r.dateStart < recentCutoff).reduce((s, r) => s + r.spend, 0);
      if (recentSpend < MIN_SPEND_THRESHOLD || baselineSpend < MIN_SPEND_THRESHOLD) continue;

      const normName      = normalizeUtmValue(campaign.name);
      const recentOrders  = clientOrders.filter((o) => o.orderCreatedAt.toISOString().slice(0, 10) >= recentCutoff && normalizeUtmValue(o.utmCampaign ?? "") === normName).length;
      const baselineOrders = clientOrders.filter((o) => { const d = o.orderCreatedAt.toISOString().slice(0, 10); return d >= baselineCutoff && d < recentCutoff && normalizeUtmValue(o.utmCampaign ?? "") === normName; }).length;

      if (recentOrders < MIN_ORDERS_THRESHOLD || baselineOrders < MIN_ORDERS_THRESHOLD) continue;

      const recentCpa   = recentSpend   / recentOrders;
      const baselineCpa = baselineSpend / baselineOrders;
      const spikePct    = (recentCpa - baselineCpa) / baselineCpa;

      if (spikePct > CPA_SPIKE_THRESHOLD) {
        drafts.push({
          clientAccountId:  clientId,
          clientName:       client.name,
          workspaceId:      client.workspaceId,
          alertType:        "cpa_spike",
          severity:         "high",
          source:           "reconciled",
          entityType:       "campaign",
          entityId:         campaign.externalCampaignId,
          entityName:       campaign.name,
          summary:          `CPA increased ${fmtPct(spikePct)} vs prior 7 days (${fmtDollar(recentCpa)} vs ${fmtDollar(baselineCpa)}).`,
          supportingMetrics: {
            recentCpa:    fmtDollar(recentCpa),
            baselineCpa:  fmtDollar(baselineCpa),
            spikePct:     fmtPct(spikePct),
            recentSpend:  fmtDollar(recentSpend),
          },
          deduplicationKey: dedupKey(clientId, "cpa_spike", campaign.externalCampaignId),
        });
      }
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// 3. detectSpendDropAlerts
// ---------------------------------------------------------------------------

export function detectSpendDropAlerts(input: DetectionInput): AlertEventDraft[] {
  const drafts: AlertEventDraft[] = [];
  const { recentCutoff, baselineCutoff } = windowBoundaries();

  for (const [clientId, campaigns] of input.clientCampaigns) {
    const client = input.clients.find((c) => c.id === clientId);
    if (!client) continue;

    for (const campaign of campaigns) {
      const cInsights     = input.insightRows.filter((r) => r.externalCampaignId === campaign.externalCampaignId);
      const recentSpend   = cInsights.filter((r) => r.dateStart >= recentCutoff).reduce((s, r) => s + r.spend, 0);
      const baselineSpend = cInsights.filter((r) => r.dateStart >= baselineCutoff && r.dateStart < recentCutoff).reduce((s, r) => s + r.spend, 0);

      if (baselineSpend < MIN_SPEND_THRESHOLD) continue;
      const dropPct = (recentSpend - baselineSpend) / baselineSpend;

      if (dropPct < -SPEND_DROP_THRESHOLD) {
        const severity: AlertSeverity = dropPct < -0.70 ? "high" : "medium";
        drafts.push({
          clientAccountId:  clientId,
          clientName:       client.name,
          workspaceId:      client.workspaceId,
          alertType:        "spend_drop",
          severity,
          source:           "meta",
          entityType:       "campaign",
          entityId:         campaign.externalCampaignId,
          entityName:       campaign.name,
          summary:          `Spend dropped ${fmtPct(Math.abs(dropPct))} vs prior 7 days (${fmtDollar(recentSpend)} vs ${fmtDollar(baselineSpend)}).`,
          supportingMetrics: {
            recentSpend:   fmtDollar(recentSpend),
            baselineSpend: fmtDollar(baselineSpend),
            dropPct:       fmtPct(Math.abs(dropPct)),
          },
          deduplicationKey: dedupKey(clientId, "spend_drop", campaign.externalCampaignId),
        });
      }
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// 4. detectSpendSpikeAlerts
// ---------------------------------------------------------------------------

export function detectSpendSpikeAlerts(input: DetectionInput): AlertEventDraft[] {
  const drafts: AlertEventDraft[] = [];
  const { recentCutoff, baselineCutoff } = windowBoundaries();

  for (const [clientId, campaigns] of input.clientCampaigns) {
    const client = input.clients.find((c) => c.id === clientId);
    if (!client) continue;

    for (const campaign of campaigns) {
      const cInsights     = input.insightRows.filter((r) => r.externalCampaignId === campaign.externalCampaignId);
      const recentSpend   = cInsights.filter((r) => r.dateStart >= recentCutoff).reduce((s, r) => s + r.spend, 0);
      const baselineSpend = cInsights.filter((r) => r.dateStart >= baselineCutoff && r.dateStart < recentCutoff).reduce((s, r) => s + r.spend, 0);

      if (baselineSpend < MIN_SPEND_THRESHOLD) continue;
      const spikePct = (recentSpend - baselineSpend) / baselineSpend;

      if (spikePct > SPEND_SPIKE_THRESHOLD) {
        drafts.push({
          clientAccountId:  clientId,
          clientName:       client.name,
          workspaceId:      client.workspaceId,
          alertType:        "spend_spike",
          severity:         "medium",
          source:           "meta",
          entityType:       "campaign",
          entityId:         campaign.externalCampaignId,
          entityName:       campaign.name,
          summary:          `Spend increased ${fmtPct(spikePct)} vs prior 7 days (${fmtDollar(recentSpend)} vs ${fmtDollar(baselineSpend)}).`,
          supportingMetrics: {
            recentSpend:   fmtDollar(recentSpend),
            baselineSpend: fmtDollar(baselineSpend),
            spikePct:      fmtPct(spikePct),
          },
          deduplicationKey: dedupKey(clientId, "spend_spike", campaign.externalCampaignId),
        });
      }
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// 5. detectStaleSyncAlerts
// ---------------------------------------------------------------------------

export function detectStaleSyncAlerts(input: DetectionInput): AlertEventDraft[] {
  const drafts: AlertEventDraft[] = [];

  for (const client of input.clients) {
    if (!input.clientsWithMeta.has(client.id)) continue; // only flag if they have Meta

    const sync   = input.latestSyncByClient.get(client.id);
    const hours  = sync?.completedAt
      ? (Date.now() - sync.completedAt.getTime()) / 3600000
      : Infinity;

    if (sync?.status === "failed") {
      drafts.push({
        clientAccountId:  client.id,
        clientName:       client.name,
        workspaceId:      client.workspaceId,
        alertType:        "stale_sync",
        severity:         "high",
        source:           "system",
        entityType:       "client",
        entityId:         client.id,
        entityName:       client.name,
        summary:          `Sync failed for ${client.name}. Data may be out of date.`,
        supportingMetrics: { status: "failed" },
        deduplicationKey: dedupKey(client.id, "stale_sync", client.id),
      });
    } else if (hours > STALE_HOURS) {
      const days      = Math.round(hours / 24);
      const severity: AlertSeverity = hours > HIGH_STALE_HOURS ? "high" : "medium";
      drafts.push({
        clientAccountId:  client.id,
        clientName:       client.name,
        workspaceId:      client.workspaceId,
        alertType:        "stale_sync",
        severity,
        source:           "system",
        entityType:       "client",
        entityId:         client.id,
        entityName:       client.name,
        summary:          `${client.name} data is ${days}d old. Run a sync to refresh campaign metrics.`,
        supportingMetrics: { staleDays: days },
        deduplicationKey: dedupKey(client.id, "stale_sync", client.id),
      });
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// 6. detectIntegrationFailureAlerts
// ---------------------------------------------------------------------------

export function detectIntegrationFailureAlerts(input: DetectionInput): AlertEventDraft[] {
  const drafts: AlertEventDraft[] = [];

  for (const client of input.clients) {
    if (!input.clientsWithMeta.has(client.id)) {
      drafts.push({
        clientAccountId:  client.id,
        clientName:       client.name,
        workspaceId:      client.workspaceId,
        alertType:        "integration_failure",
        severity:         "high",
        source:           "system",
        entityType:       "integration",
        entityId:         `${client.id}:meta`,
        entityName:       "Meta Ads",
        summary:          `${client.name} has no Meta ad account mapped. Campaign data cannot sync.`,
        supportingMetrics: { integration: "Meta" },
        deduplicationKey: dedupKey(client.id, "integration_failure", "meta"),
      });
    }

    if (!input.clientsWithShopify.has(client.id)) {
      drafts.push({
        clientAccountId:  client.id,
        clientName:       client.name,
        workspaceId:      client.workspaceId,
        alertType:        "no_data",
        severity:         "medium",
        source:           "shopify",
        entityType:       "integration",
        entityId:         `${client.id}:shopify`,
        entityName:       "Shopify",
        summary:          `${client.name} has no Shopify connected. CRM revenue data is unavailable.`,
        supportingMetrics: { integration: "Shopify" },
        deduplicationKey: dedupKey(client.id, "no_data", "shopify"),
      });
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// 7. detectCampaignGoalAlerts
// ---------------------------------------------------------------------------

export function detectCampaignGoalAlerts(input: DetectionInput): AlertEventDraft[] {
  const drafts: AlertEventDraft[] = [];

  for (const [clientId, reconciledRows] of input.latestReconciledByClient) {
    const client    = input.clients.find((c) => c.id === clientId);
    if (!client)    continue;
    const campaigns = input.clientCampaigns.get(clientId) ?? [];
    const goalMap   = new Map(
      campaigns.filter((c) => c.goal).map((c) => [c.externalCampaignId, c.goal!])
    );

    for (const row of reconciledRows) {
      const goal = goalMap.get(row.externalCampaignId);
      if (!goal || row.calculatedRoas == null) continue;

      if (goal.roasGoalType === "high" && row.calculatedRoas < goal.roasGoalValue) {
        const missBy = ((goal.roasGoalValue - row.calculatedRoas) / goal.roasGoalValue);
        drafts.push({
          clientAccountId:  clientId,
          clientName:       client.name,
          workspaceId:      client.workspaceId,
          alertType:        "campaign_below_goal",
          severity:         "high",
          source:           "reconciled",
          entityType:       "campaign",
          entityId:         row.externalCampaignId,
          entityName:       row.campaignName,
          summary:          `${row.campaignName} ROAS ${fmtRoas(row.calculatedRoas)} is ${fmtPct(missBy)} below goal of ${fmtRoas(goal.roasGoalValue)}.`,
          supportingMetrics: {
            roas:      fmtRoas(row.calculatedRoas),
            goalRoas:  fmtRoas(goal.roasGoalValue),
            missBy:    fmtPct(missBy),
            spend:     fmtDollar(row.metaSpend),
          },
          deduplicationKey: dedupKey(clientId, "campaign_below_goal", row.externalCampaignId),
        });
      } else if (goal.roasGoalType === "high" && row.calculatedRoas > goal.roasGoalValue * ABOVE_GOAL_FACTOR) {
        drafts.push({
          clientAccountId:  clientId,
          clientName:       client.name,
          workspaceId:      client.workspaceId,
          alertType:        "campaign_above_goal",
          severity:         "low",
          source:           "reconciled",
          entityType:       "campaign",
          entityId:         row.externalCampaignId,
          entityName:       row.campaignName,
          summary:          `${row.campaignName} ROAS ${fmtRoas(row.calculatedRoas)} is ${fmtPct((row.calculatedRoas - goal.roasGoalValue) / goal.roasGoalValue)} above goal. Scaling candidate.`,
          supportingMetrics: {
            roas:     fmtRoas(row.calculatedRoas),
            goalRoas: fmtRoas(goal.roasGoalValue),
            spend:    fmtDollar(row.metaSpend),
          },
          deduplicationKey: dedupKey(clientId, "campaign_above_goal", row.externalCampaignId),
        });
      }
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// Run all detectors and return combined drafts
// ---------------------------------------------------------------------------

export function runAllDetectors(input: DetectionInput): AlertEventDraft[] {
  return [
    ...detectRoasDropAlerts(input),
    ...detectCpaSpikeAlerts(input),
    ...detectSpendDropAlerts(input),
    ...detectSpendSpikeAlerts(input),
    ...detectStaleSyncAlerts(input),
    ...detectIntegrationFailureAlerts(input),
    ...detectCampaignGoalAlerts(input),
  ];
}
