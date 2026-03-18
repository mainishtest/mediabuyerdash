// app/reconciliation/page.tsx
// Server component — loads reconciliation data from the DB for the selected client
// and passes it to the client view.
//
// URL: /reconciliation?clientId=<id>
//
// If no clientId is provided, the view shows a client selector and empty state.
// If clientId is provided, loads the most recent persisted reconciliation results.
// The "Run Reconciliation" button in the view calls
//   POST /api/clients/[clientId]/reconciliation/run
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
  searchParams: { clientId?: string };
};

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const clientId = searchParams?.clientId ?? null;

  // Load all clients for the selector dropdown.
  const clients = await prisma.clientAccount.findMany({
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (!clientId) {
    return (
      <ReconciliationView
        clients={clients}
        clientId={null}
        initialMatchRows={[]}
        initialSummary={null}
      />
    );
  }

  // Load most recent persisted reconciliation results for this client.
  const [dbRows, dbSummary] = await Promise.all([
    loadLatestReconciliationMatches(clientId),
    loadLatestReconciliationSummary(clientId),
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
          dateFrom:        dbSummary.dateFrom,
          dateTo:          dbSummary.dateTo,
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
    />
  );
}
