// lib/goalAwareOptimization/snapshot.ts
// buildReconciledPerformanceSnapshot() — aggregates raw performance rows into
// entity-level reconciled snapshots.
//
// Product rule: evaluatedCpa and evaluatedRoas are always computed from
// CRM-backed crmOrders and crmRevenue. Meta-reported conversions/revenue
// are NOT used for evaluated metrics.
//
// The RawPerformanceInput interface is intentionally flexible so callers can
// map from UTMPerformanceRow, ReconciliationMatchRow, or DB query results
// without this layer having a hard dependency on either data model.

import type { ReconciledPerformanceSnapshot } from "../../types/goalAwareOptimization";

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Flexible input row for the snapshot builder.
 * Callers map their source data (UTM rows, match rows, DB queries) to this shape.
 *
 * Key product rule: crmOrders and crmRevenue must come from Shopify/CRM,
 * not from Meta-reported conversions/revenue.
 */
export interface RawPerformanceInput {
  clientAccountId: string;
  campaignId?:     string;
  campaignName?:   string;
  adSetId?:        string;
  adSetName?:      string;
  adId?:           string;
  adName?:         string;
  date:            string;   // ISO date YYYY-MM-DD

  // Meta delivery (source: Meta Ads)
  metaSpend:       number;
  metaClicks:      number;
  metaImpressions: number;

  // CRM source-of-truth (source: Shopify / CRM via reconciliation engine)
  crmOrders:       number;
  crmRevenue:      number;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Groups RawPerformanceInput rows by entity level, aggregates delivery and
 * CRM metrics, and computes evaluated CPA/ROAS from CRM totals.
 *
 * @param rows            Raw performance rows (any source)
 * @param groupBy         Entity level to group by
 * @param clientAccountId Filter to a specific client account
 * @param dateFrom        Start of date range (inclusive, YYYY-MM-DD)
 * @param dateTo          End of date range (inclusive, YYYY-MM-DD)
 */
export function buildReconciledPerformanceSnapshot(
  rows:            RawPerformanceInput[],
  groupBy:         "campaign" | "adset" | "ad",
  clientAccountId: string,
  dateFrom:        string,
  dateTo:          string
): ReconciledPerformanceSnapshot[] {
  // Filter to the requested client account and date range.
  const scoped = rows.filter(
    (r) =>
      r.clientAccountId === clientAccountId &&
      r.date >= dateFrom &&
      r.date <= dateTo
  );

  // Group rows by entity ID.
  type GroupEntry = { id: string; name: string; rows: RawPerformanceInput[] };
  const groups = new Map<string, GroupEntry>();

  for (const row of scoped) {
    const { entityId, entityName } = resolveEntity(row, groupBy);
    if (!entityId) continue;

    if (!groups.has(entityId)) {
      groups.set(entityId, {
        id:   entityId,
        name: entityName ?? entityId,
        rows: [],
      });
    }
    groups.get(entityId)!.rows.push(row);
  }

  // Aggregate each group into a snapshot.
  const snapshots: ReconciledPerformanceSnapshot[] = [];

  for (const [entityId, group] of groups) {
    const metaSpend       = sum(group.rows, (r) => r.metaSpend);
    const metaClicks      = sum(group.rows, (r) => r.metaClicks);
    const metaImpressions = sum(group.rows, (r) => r.metaImpressions);
    const crmOrders       = sum(group.rows, (r) => r.crmOrders);
    const crmRevenue      = sum(group.rows, (r) => r.crmRevenue);

    // Evaluated metrics — CRM is always the source of truth.
    const evaluatedCpa  = crmOrders  > 0 ? round2(metaSpend / crmOrders)   : null;
    const evaluatedRoas = metaSpend  > 0 ? round2(crmRevenue / metaSpend)  : null;

    // Delivery diagnostics.
    const ctr = metaImpressions > 0 ? round4(metaClicks / metaImpressions) : undefined;
    const cpm = metaImpressions > 0 ? round2((metaSpend / metaImpressions) * 1000) : undefined;

    const snapshot: ReconciledPerformanceSnapshot = {
      clientAccountId,
      dateRange: { from: dateFrom, to: dateTo },
      metaSpend,
      metaClicks,
      metaImpressions,
      crmOrders,
      crmRevenue,
      evaluatedCpa,
      evaluatedRoas,
      ctr,
      cpm,
    };

    if (groupBy === "campaign") snapshot.campaignId = entityId;
    if (groupBy === "adset")    snapshot.adSetId    = entityId;
    if (groupBy === "ad")       snapshot.adId       = entityId;

    snapshots.push(snapshot);
  }

  return snapshots;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveEntity(
  row:     RawPerformanceInput,
  groupBy: "campaign" | "adset" | "ad"
): { entityId: string | undefined; entityName: string | undefined } {
  if (groupBy === "campaign") return { entityId: row.campaignId, entityName: row.campaignName };
  if (groupBy === "adset")    return { entityId: row.adSetId,    entityName: row.adSetName    };
  return                             { entityId: row.adId,       entityName: row.adName       };
}

function sum(rows: RawPerformanceInput[], fn: (r: RawPerformanceInput) => number): number {
  return rows.reduce((acc, r) => acc + fn(r), 0);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
