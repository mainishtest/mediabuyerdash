import {
  getMeasurementPolicy,
  buildEvaluationMetricSet,
  getMetricOwnershipMap,
} from "../../lib/measurementPolicy";
import { MeasurementPolicyView } from "./MeasurementPolicyView";

export const dynamic = "force-dynamic";

// Sample figures that demonstrate why CRM differs from Meta.
// Meta over-attributes conversions vs CRM-verified orders — a realistic scenario.
const SAMPLE_META_SPEND        = 2000;
const SAMPLE_META_IMPRESSIONS  = 85000;
const SAMPLE_META_CLICKS       = 2400;
const SAMPLE_META_FREQUENCY    = 3.2;
const SAMPLE_META_REVENUE      = 4800;  // Meta-reported (over-attributed)
const SAMPLE_META_CONVERSIONS  = 96;    // Meta-reported
const SAMPLE_CRM_REVENUE       = 3200;  // CRM-verified (source of truth)
const SAMPLE_CRM_CONVERSIONS   = 58;    // CRM-verified

export default function MeasurementPolicyPage() {
  const policy    = getMeasurementPolicy();
  const ownership = getMetricOwnershipMap();

  const evaluatedMetrics = buildEvaluationMetricSet({
    spend:           SAMPLE_META_SPEND,
    impressions:     SAMPLE_META_IMPRESSIONS,
    clicks:          SAMPLE_META_CLICKS,
    frequency:       SAMPLE_META_FREQUENCY,
    crmRevenue:      SAMPLE_CRM_REVENUE,
    crmConversions:  SAMPLE_CRM_CONVERSIONS,
    metaRevenue:     SAMPLE_META_REVENUE,
    metaConversions: SAMPLE_META_CONVERSIONS,
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Measurement Policy</h1>
          <p className="mt-1 text-sm text-slate-400">
            The product rules that govern how performance is measured across every
            evaluation, recommendation, and reporting workflow.
          </p>
        </div>

        <MeasurementPolicyView
          policy={policy}
          ownership={ownership}
          evaluatedMetrics={evaluatedMetrics}
        />
      </div>
    </main>
  );
}
