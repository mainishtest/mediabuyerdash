# Alerting and Anomaly Detection

## What it is

The Alerts page (`/alerts`) detects meaningful changes in campaign performance,
spend patterns, sync health, and goal adherence — and surfaces them as actionable
alerts. Detection runs every time the page loads (server-side). Results are persisted
so the Operations page can show the top open alerts without re-running detection.

---

## Alert types

| Alert Type | Description | Source |
|---|---|---|
| `roas_drop` | ROAS dropped >30% vs prior 7-day window | reconciled |
| `cpa_spike` | CPA increased >30% vs prior 7-day window | reconciled |
| `spend_drop` | Spend dropped >40% vs prior 7-day window | meta |
| `spend_spike` | Spend increased >60% vs prior 7-day window | meta |
| `stale_sync` | Last completed sync >48h ago (or failed) | system |
| `no_data` | No active Shopify connection for client | shopify |
| `campaign_below_goal` | Reconciled ROAS below MetaCampaignGoal target | reconciled |
| `campaign_above_goal` | Reconciled ROAS >20% above goal — scaling candidate | reconciled |
| `integration_failure` | No Meta ad account mapped for client | system |

## Alert severity

| Severity | Examples |
|---|---|
| `high` | ROAS drop, CPA spike, campaign below goal, sync failed, no Meta mapping |
| `medium` | Spend drop/spike, stale sync (2–7d), no Shopify |
| `low` | Campaign above goal |

## Alert status flow

```
detected → open → acknowledged → resolved
```

- **open**: freshly detected, needs attention
- **acknowledged**: seen but not yet actioned (user clicks "Acknowledge")
- **resolved**: closed by user (user clicks "Resolve")

Re-detection after resolution creates a fresh `open` alert — so conditions that
recur after being resolved will re-appear.

---

## How anomalies are detected

### Time-series anomalies (ROAS drop, CPA spike, spend drop/spike)

The detection window is 14 days split into two 7-day windows:
- **Recent window**: last 7 days
- **Baseline window**: days 8–14

Data sources:
- `MetaSyncedInsight` (campaign level, daily `spend`)
- `ShopifyOrder` (daily `totalPrice`, `utmCampaign`)

ROAS is computed per campaign as `crmRevenue / metaSpend`. Revenue is attributed
to campaigns by matching `ShopifyOrder.utmCampaign` (normalized) to the Meta
campaign name (normalized). This is the same UTM bridging used by the
reconciliation engine.

**Minimum data thresholds** — below these, detection is skipped:
- Spend: $50 in each 7-day window
- Orders (CPA spike only): 3 orders in each window

### Goal adherence alerts

Uses `ReconciledCampaignPerformance.calculatedRoas` (CRM-verified) compared to
`MetaCampaignGoal.roasGoalValue`. Does not use Meta's reported conversions or
revenue.

### Stale sync / integration failure

Uses `ClientSyncRun.completedAt` and `MetaSelectedAdAccount` / `ShopifyConnection`
table presence.

---

## Detection thresholds (v1)

| Check | Threshold |
|---|---|
| ROAS drop | >30% decline from baseline |
| CPA spike | >30% increase from baseline |
| Spend drop | >40% decline from baseline (>70% → high severity) |
| Spend spike | >60% increase from baseline |
| Stale sync | >48h (medium), >7d (high) |
| Above goal | ROAS > goalValue × 1.20 |

---

## Deduplication

Each alert has a `deduplicationKey = "{clientId}:{alertType}:{entityId}"`. On each
detection run:
- If an **open or acknowledged** alert with the same key exists → update
  `lastDetectedAt` (don't create a duplicate)
- If **no active alert** with that key exists → create a new `open` alert

This means:
- A resolved alert will re-open if the condition is re-detected
- An acknowledged alert will NOT be duplicated while still active

---

## Architecture

```
lib/alerts/
  types.ts       — AlertType, AlertSeverity, AlertStatus, AlertSource, AlertEventRow, etc.
  detectors.ts   — loadDetectionInput() + 7 detectX() functions + runAllDetectors()
  persist.ts     — upsertAlerts(), loadAlerts(), loadTopOpenAlerts(),
                   acknowledgeAlert(), resolveAlert()
  summary.ts     — buildAlertSummary()
  index.ts       — public re-exports

app/alerts/
  page.tsx       — server component: runs detection → upserts → loads → renders
  AlertsView.tsx — client component: filters (client, type, severity, status),
                   alert cards, acknowledge/resolve actions

app/api/alerts/[alertId]/
  acknowledge/route.ts
  resolve/route.ts
```

---

## Current limitations (v1)

- **No email or Slack delivery.** All alerts are in-app only. Email/Slack delivery
  is the next step.
- **No scheduled detection.** Detection runs only when the Alerts page is loaded.
  A cron route (`/api/cron/detect-alerts`) can be added to run detection on a
  schedule without user action.
- **UTM attribution noise.** ROAS/CPA anomalies use the same UTM bridging as the
  reconciliation engine. iOS 14+ traffic with no UTM params will under-report
  CRM revenue, potentially generating false-positive ROAS drop alerts.
- **No multi-touch.** Last-touch attribution only — same limitation as the
  reconciliation engine.
- **14-day detection window only.** No longer historical baselines yet. A
  campaign that has only been running for <7 days will not trigger time-series
  anomalies (below the minimum spend threshold).
- **Goal adherence uses reconciled period data.** If reconciliation has not been
  run recently, goal alerts may be stale.

---

## Extending for scheduled delivery (next phase)

To add scheduled detection + email/Slack delivery:

1. Create `/api/cron/detect-alerts/route.ts`
2. Call `loadDetectionInput()` + `runAllDetectors()` + `upsertAlerts()`
3. Query newly-created alerts (detectedAt = now, status = "open")
4. Filter by severity threshold (e.g. high only)
5. Send via Resend (already wired) — group by client

No changes to `detectors.ts` or `persist.ts` required.
