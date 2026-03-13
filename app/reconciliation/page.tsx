import { utmPerformanceRows }  from "../../lib/data/utmReporting";
import { sampleCRMOrders }     from "../../lib/data/crmReporting";
import {
  groupCRMOrdersToRows,
  buildReconciliationResults,
  summarizeReconciliation
} from "../../lib/reconciliationUtils";
import { ReconciliationView } from "./ReconciliationView";

export const metadata = {
  title: "Reconciliation — Media Buying Dashboard"
};

export default function ReconciliationPage() {
  // Build from source data so the same pipeline will work when real ingested
  // data replaces the sample arrays.
  const crmRows    = groupCRMOrdersToRows(sampleCRMOrders);
  const results    = buildReconciliationResults(utmPerformanceRows, crmRows);
  const summary    = summarizeReconciliation(results);

  return (
    <ReconciliationView
      results={results}
      summary={summary}
    />
  );
}
