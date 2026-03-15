// app/reconciliation/page.tsx
// Server component — computes reconciliation data and passes it to the client view.
//
// Data sourcing (v1 — sample data):
//   Meta side:  lib/data/utmReporting.ts  (UTMPerformanceRow[])
//   CRM side:   lib/data/crmReporting.ts  (CRMOrderRecord[])
//
// When real Meta sync and Shopify sync are fully wired up, replace the sample
// data imports with DB queries against MetaSyncedInsight / ShopifyOrder tables
// and pass the results through the same engine functions below.
//
// Safe error handling:
//   - Empty metaRows → all CRM rows become "unmatched_crm"
//   - Empty shopifyOrders → all Meta rows become "unmatched_meta"
//   - Both empty → summary shows zeros; table shows EmptyState
//   - Engine never throws for missing UTMs — they produce "partial" or "unmatched_*"

import { utmPerformanceRows } from "../../lib/data/utmReporting";
import { sampleCRMOrders }    from "../../lib/data/crmReporting";
import {
  reconcileMetaRowsWithShopifyOrders,
  summarizeReconciliationResults,
} from "../../lib/reconciliation";
import { ReconciliationView } from "./ReconciliationView";

export const metadata = {
  title: "Reconciliation — Media Buying Dashboard",
};

// The client account scope for v1 sample data.
const SAMPLE_CLIENT_ACCOUNT_ID = "act_1";

export default function ReconciliationPage() {
  // Step 1: Match Meta rows to CRM orders using the reconciliation engine.
  const matchRows = reconcileMetaRowsWithShopifyOrders(
    utmPerformanceRows,
    sampleCRMOrders,
    SAMPLE_CLIENT_ACCOUNT_ID
  );

  // Step 2: Roll up aggregate summary from match rows.
  const summary = summarizeReconciliationResults(matchRows, SAMPLE_CLIENT_ACCOUNT_ID);

  return <ReconciliationView matchRows={matchRows} summary={summary} />;
}
