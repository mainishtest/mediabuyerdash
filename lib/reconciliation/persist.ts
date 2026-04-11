// lib/reconciliation/persist.ts
// DB write helpers for the reconciliation engine.
//
// These functions are READY but not yet called by any page or API route.
// They will be wired up in the next step when goal-aware optimization
// needs persisted reconciliation data as its source-of-truth input.
//
// Architecture note:
//   DB writes are kept in this file and intentionally separated from:
//     - matching logic   (matchEngine.ts)
//     - summary calc     (summarize.ts)
//     - UI components    (app/reconciliation/)
//   This allows the engine to be used in memory without touching the DB,
//   and allows the DB layer to be swapped/extended independently.

import { prisma } from "../db";
import type { ReconciliationMatchRow, ReconciliationComputedSummary } from "../../types/reconciliation";
import type { CampaignPerformanceRow } from "./campaignPerformance";

/**
 * Upsert a set of ReconciliationMatchRows into the database.
 *
 * Uses upsert on (clientAccountId, matchKey) so re-running reconciliation
 * for the same date range updates existing rows rather than duplicating them.
 *
 * Runs all upserts in a single transaction for atomicity.
 */
export async function persistReconciliationMatches(
  rows: ReconciliationMatchRow[]
): Promise<void> {
  if (rows.length === 0) return;

  // Process in chunks of 50 to keep each transaction well under the timeout.
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await prisma.$transaction(
      async (tx) => {
        for (const row of chunk) {
          await tx.reconciliationMatch.upsert({
            where: {
              clientAccountId_matchKey: {
                clientAccountId: row.clientAccountId,
                matchKey:        row.matchKey,
              },
            },
            update: {
              date:                  row.date,
              attributionWindowDays: row.attributionWindowDays,
              metaCampaignId:        row.metaCampaignId  ?? null,
              metaAdSetId:           row.metaAdSetId     ?? null,
              metaAdId:              row.metaAdId        ?? null,
              utmCampaign:           row.utmCampaign     ?? null,
              utmContent:            row.utmContent      ?? null,
              utmTerm:               row.utmTerm         ?? null,
              metaSpend:             row.metaSpend,
              metaClicks:            row.metaClicks      ?? null,
              metaImpressions:       row.metaImpressions ?? null,
              crmOrders:             row.crmOrders,
              crmRevenue:            row.crmRevenue,
              evaluatedCpa:          row.evaluatedCpa    ?? null,
              evaluatedRoas:         row.evaluatedRoas   ?? null,
              matchStatus:           row.matchStatus,
            },
            create: {
              clientAccountId:       row.clientAccountId,
              matchKey:              row.matchKey,
              date:                  row.date,
              attributionWindowDays: row.attributionWindowDays,
              metaCampaignId:        row.metaCampaignId  ?? null,
              metaAdSetId:           row.metaAdSetId     ?? null,
              metaAdId:              row.metaAdId        ?? null,
              utmCampaign:           row.utmCampaign     ?? null,
              utmContent:            row.utmContent      ?? null,
              utmTerm:               row.utmTerm         ?? null,
              metaSpend:             row.metaSpend,
              metaClicks:            row.metaClicks      ?? null,
              metaImpressions:       row.metaImpressions ?? null,
              crmOrders:             row.crmOrders,
              crmRevenue:            row.crmRevenue,
              evaluatedCpa:          row.evaluatedCpa    ?? null,
              evaluatedRoas:         row.evaluatedRoas   ?? null,
              matchStatus:           row.matchStatus,
            },
          });
        }
      },
      {
        timeout: 30000, // 30s per chunk of 50
      }
    );
  }
}

/**
 * Upsert a ReconciliationComputedSummary into the database.
 *
 * Uses upsert on (clientAccountId, dateFrom, dateTo) so re-running
 * reconciliation for the same window updates the existing summary row.
 */
export async function persistReconciliationSummary(
  summary: ReconciliationComputedSummary
): Promise<void> {
  await prisma.reconciliationSummary.upsert({
    where: {
      clientAccountId_dateFrom_dateTo: {
        clientAccountId: summary.clientAccountId,
        dateFrom:        summary.dateFrom,
        dateTo:          summary.dateTo,
      },
    },
    update: {
      totalMetaSpend:  summary.totalMetaSpend,
      totalCrmRevenue: summary.totalCrmRevenue,
      totalCrmOrders:  summary.totalCrmOrders,
      evaluatedCpa:    summary.evaluatedCpa    ?? null,
      evaluatedRoas:   summary.evaluatedRoas   ?? null,
      matchedRows:     summary.matchedRows,
      unmatchedRows:   summary.unmatchedRows,
    },
    create: {
      clientAccountId: summary.clientAccountId,
      dateFrom:        summary.dateFrom,
      dateTo:          summary.dateTo,
      totalMetaSpend:  summary.totalMetaSpend,
      totalCrmRevenue: summary.totalCrmRevenue,
      totalCrmOrders:  summary.totalCrmOrders,
      evaluatedCpa:    summary.evaluatedCpa    ?? null,
      evaluatedRoas:   summary.evaluatedRoas   ?? null,
      matchedRows:     summary.matchedRows,
      unmatchedRows:   summary.unmatchedRows,
    },
  });
}

// ---------------------------------------------------------------------------
// ReconciledCampaignPerformance
// ---------------------------------------------------------------------------

/**
 * Upsert per-campaign reconciliation rollup rows.
 * Keyed on (clientAccountId, externalCampaignId, dateFrom, dateTo).
 */
export async function persistCampaignPerformance(
  clientAccountId: string,
  dateFrom:         string,
  dateTo:           string,
  rows:             CampaignPerformanceRow[]
): Promise<void> {
  if (rows.length === 0) return;

  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await prisma.$transaction(
      async (tx) => {
        for (const row of chunk) {
          await tx.reconciledCampaignPerformance.upsert({
            where: {
              clientAccountId_externalCampaignId_dateFrom_dateTo: {
                clientAccountId,
                externalCampaignId: row.externalCampaignId,
                dateFrom,
                dateTo,
              },
            },
            update: {
              campaignName:          row.campaignName,
              metaSpend:             row.metaSpend,
              attributedRevenue:     row.attributedRevenue,
              attributedOrders:      row.attributedOrders,
              calculatedRoas:        row.calculatedRoas    ?? null,
              calculatedCpa:         row.calculatedCpa     ?? null,
              utmMatchedOrders:      row.utmMatchedOrders,
              windowMatchedOrders:   row.windowMatchedOrders,
              attributionWindowDays: row.attributionWindowDays,
            },
            create: {
              clientAccountId,
              externalCampaignId:    row.externalCampaignId,
              campaignName:          row.campaignName,
              dateFrom,
              dateTo,
              metaSpend:             row.metaSpend,
              attributedRevenue:     row.attributedRevenue,
              attributedOrders:      row.attributedOrders,
              calculatedRoas:        row.calculatedRoas    ?? null,
              calculatedCpa:         row.calculatedCpa     ?? null,
              utmMatchedOrders:      row.utmMatchedOrders,
              windowMatchedOrders:   row.windowMatchedOrders,
              attributionWindowDays: row.attributionWindowDays,
            },
          });
        }
      },
      {
        timeout: 30000, // 30s per chunk of 50
      }
    );
  }
}

/**
 * Load the most recent per-campaign performance rows for a client.
 * Returns the rows from the latest run (most recent dateTo).
 */
export async function loadCampaignPerformance(
  clientAccountId: string
): Promise<import("@prisma/client").ReconciledCampaignPerformance[]> {
  // Find the most recent dateTo for this client.
  const latest = await prisma.reconciledCampaignPerformance.findFirst({
    where:   { clientAccountId },
    orderBy: { dateTo: "desc" },
    select:  { dateTo: true },
  });
  if (!latest) return [];

  return prisma.reconciledCampaignPerformance.findMany({
    where:   { clientAccountId, dateTo: latest.dateTo },
    orderBy: { metaSpend: "desc" },
  });
}
