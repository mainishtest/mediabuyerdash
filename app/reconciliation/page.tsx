// app/reconciliation/page.tsx
// Server component — loads reconciliation data from the DB for the selected client
// and passes it to the client view.
//
// URL: /reconciliation?clientId=<id>&dateFrom=<YYYY-MM-DD>&dateTo=<YYYY-MM-DD>
//
// dateFrom/dateTo are optional. When provided they filter the DB query so the
// overview stats and table only cover that period. ReconciliationView renders
// the active range and allows the buyer to change it via an Apply button that
// navigates back here with updated date params.
//
// If no clientId is provided, the view shows a client selector and empty state.
// If clientId is provided, loads the most recent persisted reconciliation results.
// The "Refresh" button in the view calls POST /api/clients/[clientId]/reconciliation/run
// which rebuilds from live Meta + Shopify data and persists new results.

export const dynamic = "force-dynamic";

import { prisma }                            from "../../lib/db";
import {
  loadLatestReconciliationMatches,
  loadLatestReconciliationSummary,
}                                            from "../../lib/reconciliation/realDataService";
import { summarizeReconciliationResults }    from "../../lib/reconciliation/summarize";
import { ReconciliationView }                from "./ReconciliationView";
import type { ReconciliationMatchRow }       from "../../types/reconciliation";

export const metadata = {
  title: "Reconciliation — Media Buying Dashboard",
};

type PageProps = {
  searchParams: { clientId?: string; dateFrom?: string; dateTo?: string };
};

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const clientId = searchParams?.clientId ?? null;
  const dateFrom = searchParams?.dateFrom ?? undefined;
  const dateTo   = searchParams?.dateTo   ?? undefined;

  // Load all clients for the selector dropdown.
  const clients = await prisma.clientAccount.findMany({
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  }).catch(() => []);

  if (!clientId) {
    return (
      <ReconciliationView
        clients={clients}
        clientId={null}
        initialMatchRows={[]}
        initialSummary={null}
        initialDateFrom={dateFrom ?? ""}
        initialDateTo={dateTo ?? ""}
      />
    );
  }

  // Load persisted reconciliation results, filtered by date when provided.
  const [dbRows, dbSummary] = await Promise.all([
    loadLatestReconciliationMatches(clientId, dateFrom, dateTo).catch(() => []),
    loadLatestReconciliationSummary(clientId).catch(() => null),
  ]);

  // Map DB ReconciliationMatch rows to in-memory ReconciliationMatchRow type.
  const matchRows: ReconciliationMatchRow[] = dbRows.map((r) => ({
    id:                   r.id,
    clientAccountId:      r.clientAccountId,
    date:                 r.date,
    attributionWindowDays: r.attributionWindowDays,
    matchKey:             r.matchKey,
    metaCampaignId:       r.metaCampaignId  ?? undefined,
    metaAdSetId:          r.metaAdSetId     ?? undefined,
    metaAdId:             r.metaAdId        ?? undefined,
    utmCampaign:          r.utmCampaign     ?? undefined,
    utmContent:           r.utmContent      ?? undefined,
    utmTerm:              r.utmTerm         ?? undefined,
    metaSpend:            r.metaSpend       ?? 0,
    metaClicks:           r.metaClicks      ?? undefined,
    metaImpressions:      r.metaImpressions ?? undefined,
    crmOrders:            r.crmOrders       ?? 0,
    crmRevenue:           r.crmRevenue      ?? 0,
    evaluatedCpa:         r.evaluatedCpa    ?? null,
    evaluatedRoas:        r.evaluatedRoas   ?? null,
    matchStatus:          r.matchStatus as ReconciliationMatchRow["matchStatus"],
  }));

  // Re-derive summary from rows for freshness (or use DB summary if no rows).
  const summary =
    matchRows.length > 0
      ? summarizeReconciliationResults(matchRows, clientId)
      : dbSummary
      ? {
          clientAccountId: dbSummary.clientAccountId,
          dateFrom:        dateFrom ?? dbSummary.dateFrom,
          dateTo:          dateTo   ?? dbSummary.dateTo,
          totalMetaSpend:  dbSummary.totalMetaSpend,
          totalCrmRevenue: dbSummary.totalCrmRevenue,
          totalCrmOrders:  dbSummary.totalCrmOrders,
          evaluatedCpa:    dbSummary.evaluatedCpa    ?? null,
          evaluatedRoas:   dbSummary.evaluatedRoas   ?? null,
          total:           dbSummary.matchedRows + dbSummary.unmatchedRows,
          matchedRows:     dbSummary.matchedRows,
          partialRows:     0,
          unmatchedRows:   dbSummary.unmatchedRows,
          ambiguousRows:   0,
        }
      : null;

  return (
    <ReconciliationView
      clients={clients}
      clientId={clientId}
      initialMatchRows={matchRows}
      initialSummary={summary}
      initialDateFrom={dateFrom ?? ""}
      initialDateTo={dateTo ?? ""}
    />
  );
}
