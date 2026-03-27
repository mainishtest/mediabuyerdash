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
  loadAdCreatives,
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
        adCreatives={{}}
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

  // Load ad creative data (image, copy, CTA) for the detail panel.
  const adIds      = ads.map((a) => a.id);
  const adCreatives = await loadAdCreatives(adIds);

  // Fan out campaign-level rows to per-ad-set rows when ReconciliationMatch
  // rows don't carry metaAdSetId (the common case). Each campaign row is split
  // evenly across its ad sets so the ad set evaluator has something to work with.
  const adSetRows = rawRows.flatMap((row) => {
    if (row.adSetId) return [row];
    const campaignAdSets = adSets.filter((as) => as.campaignId === row.campaignId);
    if (campaignAdSets.length === 0) return [];
    const n = campaignAdSets.length;
    return campaignAdSets.map((as) => ({
      ...row,
      adSetId:   as.id,
      adSetName: as.name,
      metaSpend:       row.metaSpend / n,
      metaClicks:      row.metaClicks / n,
      metaImpressions: row.metaImpressions / n,
      crmOrders:       row.crmOrders / n,
      crmRevenue:      row.crmRevenue / n,
    }));
  });

  // Fan out ad-set rows to per-ad rows when no metaAdId is present.
  const adRows = adSetRows.flatMap((row) => {
    if (row.adId) return [row];
    const adSetAds = ads.filter((ad) => ad.adSetId === row.adSetId);
    if (adSetAds.length === 0) return [];
    const n = adSetAds.length;
    return adSetAds.map((ad) => ({
      ...row,
      adId:   ad.id,
      adName: ad.name,
      metaSpend:       row.metaSpend / n,
      metaClicks:      row.metaClicks / n,
      metaImpressions: row.metaImpressions / n,
      crmOrders:       row.crmOrders / n,
      crmRevenue:      row.crmRevenue / n,
    }));
  });

  // Run goal-aware evaluations (pure functions — no DB access).
  const campaignOutput = evaluateCampaignsFromReconciledMetrics(
    rawRows,
    campaigns,
    dateFrom,
    dateTo
  );

  const adSetOutput = evaluateAdSetsFromReconciledMetrics(
    adSetRows,
    adSets,
    campaigns,
    dateFrom,
    dateTo
  );

  const adOutput = evaluateAdsFromReconciledMetrics(
    adRows,
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
      adCreatives={adCreatives}
    />
  );
}
