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

  await prisma.$transaction(
    rows.map((row) =>
      prisma.reconciliationMatch.upsert({
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
      })
    )
  );
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
