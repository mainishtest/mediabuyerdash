// app/optimization/page.tsx
// Server component — evaluates reconciled performance against campaign goals
// using real data from ReconciliationMatch + MetaCampaignGoal.
//
// URL: /optimization?clientId=<id>
//
// If no clientId, shows a client selector and empty state.
// If clientId is provided:
//   1. Load persisted ReconciliationMatch rows for the last 30 days → RawPerformanceInput[]
//   2. Load MetaSyncedCampaign + MetaCampaignGoal → Campaign[] with goal values
//   3. Load MetaSyncedAdSet → AdSet[]
//   4. Load MetaSyncedAd → Ad[]
//   5. Run the goal-aware evaluation engine (server-side)
//   6. Pass typed results to OptimizationView

export const dynamic = "force-dynamic";

import { prisma }                from "../../lib/db";
import {
  loadCampaignsWithGoals,
  loadAdSetsForCampaigns,
  loadAdsForAdSets,
  loadRawPerformanceInputs,
}                                from "../../lib/optimization/realDataService";
import {
  evaluateCampaignsFromReconciledMetrics,
  evaluateAdSetsFromReconciledMetrics,
  evaluateAdsFromReconciledMetrics,
}                                from "../../lib/goalAwareOptimization";
import { OptimizationView }      from "./OptimizationView";

export const metadata = {
  title: "Optimization — Media Buying Dashboard",
};

type PageProps = {
  searchParams: { clientId?: string };
};

function defaultDateRange() {
  const now  = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo:   now.toISOString().slice(0, 10),
  };
}

export default async function OptimizationPage({ searchParams }: PageProps) {
  const clientId = searchParams?.clientId ?? null;

  // Load all clients for the selector dropdown.
  const clients = await prisma.clientAccount.findMany({
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (!clientId) {
    return (
      <OptimizationView
        clients={clients}
        clientId={null}
        campaignEvaluations={[]}
        adSetEvaluations={[]}
        adEvaluations={[]}
        recommendations={[]}
        totalSpend={0}
        totalCrmRevenue={0}
        totalCrmOrders={0}
        evaluatedCpa={null}
        evaluatedRoas={null}
        dateFrom=""
        dateTo=""
      />
    );
  }

  const { dateFrom, dateTo } = defaultDateRange();

  // Load all data in parallel.
  const [campaigns, rawRows] = await Promise.all([
    loadCampaignsWithGoals(clientId),
    loadRawPerformanceInputs(clientId, dateFrom, dateTo),
  ]);

  const campaignIds = campaigns.map((c) => c.id);
  const [adSets, ads] = await Promise.all([
    loadAdSetsForCampaigns(campaignIds),
    (async () => {
      const adSetIds = (await prisma.metaSyncedAdSet.findMany({
        where:  { externalCampaignId: { in: campaignIds } },
        select: { externalAdSetId: true },
      })).map((as) => as.externalAdSetId);
      return loadAdsForAdSets(adSetIds);
    })(),
  ]);

  // Run goal-aware evaluations (pure functions — no DB access).
  const campaignOutput = evaluateCampaignsFromReconciledMetrics(
    rawRows,
    campaigns,
    dateFrom,
    dateTo
  );

  const adSetOutput = evaluateAdSetsFromReconciledMetrics(
    rawRows,
    adSets,
    campaigns,
    dateFrom,
    dateTo
  );

  const adOutput = evaluateAdsFromReconciledMetrics(
    rawRows,
    ads,
    adSets,
    campaigns,
    dateFrom,
    dateTo
  );

  const allRecommendations = [
    ...campaignOutput.recommendations,
    ...adSetOutput.recommendations,
    ...adOutput.recommendations,
  ];

  // Compute global summary totals.
  const totalSpend      = rawRows.reduce((s, r) => s + r.metaSpend,   0);
  const totalCrmOrders  = rawRows.reduce((s, r) => s + r.crmOrders,   0);
  const totalCrmRevenue = rawRows.reduce((s, r) => s + r.crmRevenue,  0);
  const evaluatedCpa    = totalCrmOrders  > 0 ? Math.round((totalSpend / totalCrmOrders) * 100) / 100 : null;
  const evaluatedRoas   = totalSpend      > 0 ? Math.round((totalCrmRevenue / totalSpend) * 100) / 100 : null;

  return (
    <OptimizationView
      clients={clients}
      clientId={clientId}
      campaignEvaluations={campaignOutput.evaluations}
      adSetEvaluations={adSetOutput.evaluations}
      adEvaluations={adOutput.evaluations}
      recommendations={allRecommendations}
      totalSpend={totalSpend}
      totalCrmRevenue={totalCrmRevenue}
      totalCrmOrders={totalCrmOrders}
      evaluatedCpa={evaluatedCpa}
      evaluatedRoas={evaluatedRoas}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  );
}
