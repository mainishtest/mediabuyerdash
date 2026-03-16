// app/optimization/page.tsx
// Server component — evaluates reconciled performance against campaign goals
// and passes typed results to the client view.
//
// Data sourcing (v1 — sample data):
//   Performance: lib/data/optimizationSample.ts (RawPerformanceInput[])
//   Campaigns:   lib/data/campaigns.ts
//   Ad sets:     lib/data/adSets.ts
//   Ads:         lib/data/ads.ts
//
// When real reconciliation data is available, replace sampleOptimizationRows
// with rows derived from ReconciliationMatch DB queries mapped to
// RawPerformanceInput. The evaluation functions below remain unchanged.
//
// Safe handling:
//   - Empty rows → evaluations are empty; view shows EmptyState
//   - Missing campaign goals → entity is skipped (not matched in evaluator)
//   - Partial data → evaluatedCpa/Roas may be null; view handles gracefully

import { campaigns } from "../../lib/data/campaigns";
import { adSets }    from "../../lib/data/adSets";
import { ads }       from "../../lib/data/ads";
import { sampleOptimizationRows } from "../../lib/data/optimizationSample";
import {
  evaluateCampaignsFromReconciledMetrics,
  evaluateAdSetsFromReconciledMetrics,
  evaluateAdsFromReconciledMetrics,
} from "../../lib/goalAwareOptimization";
import { OptimizationView } from "./OptimizationView";

export const metadata = {
  title: "Optimization — Media Buying Dashboard",
};

// v1 sample date range — replace with dynamic range or user-selected filter.
const DATE_FROM = "2024-03-01";
const DATE_TO   = "2024-03-05";

export default function OptimizationPage() {
  // Run entity-level evaluations using CRM-backed reconciled metrics.
  const campaignOutput = evaluateCampaignsFromReconciledMetrics(
    sampleOptimizationRows,
    campaigns,
    DATE_FROM,
    DATE_TO
  );

  const adSetOutput = evaluateAdSetsFromReconciledMetrics(
    sampleOptimizationRows,
    adSets,
    campaigns,
    DATE_FROM,
    DATE_TO
  );

  const adOutput = evaluateAdsFromReconciledMetrics(
    sampleOptimizationRows,
    ads,
    adSets,
    campaigns,
    DATE_FROM,
    DATE_TO
  );

  // Combine all recommendations — sorted by priority (high → medium → low) in the view.
  const allRecommendations = [
    ...campaignOutput.recommendations,
    ...adSetOutput.recommendations,
    ...adOutput.recommendations,
  ];

  // Compute global summary totals from the raw performance rows.
  const totalSpend      = sampleOptimizationRows.reduce((s, r) => s + r.metaSpend, 0);
  const totalCrmOrders  = sampleOptimizationRows.reduce((s, r) => s + r.crmOrders, 0);
  const totalCrmRevenue = sampleOptimizationRows.reduce((s, r) => s + r.crmRevenue, 0);
  const evaluatedCpa    = totalCrmOrders  > 0 ? Math.round((totalSpend / totalCrmOrders) * 100) / 100 : null;
  const evaluatedRoas   = totalSpend      > 0 ? Math.round((totalCrmRevenue / totalSpend) * 100) / 100 : null;

  return (
    <OptimizationView
      campaignEvaluations={campaignOutput.evaluations}
      adSetEvaluations={adSetOutput.evaluations}
      adEvaluations={adOutput.evaluations}
      recommendations={allRecommendations}
      totalSpend={totalSpend}
      totalCrmRevenue={totalCrmRevenue}
      totalCrmOrders={totalCrmOrders}
      evaluatedCpa={evaluatedCpa}
      evaluatedRoas={evaluatedRoas}
      dateFrom={DATE_FROM}
      dateTo={DATE_TO}
    />
  );
}
