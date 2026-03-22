# Executive Summary & Account Status Layer

## How the Executive Summary Is Populated

`buildDailyExecutiveSummary(workspaceId)` in `lib/dailySummary/aggregator.ts` runs parallel Prisma queries:

| Query | Source | Purpose |
|-------|--------|---------|
| Active clients | `ClientAccount` | List of accounts to evaluate |
| Yesterday reconciliation | `ReconciliationSummary` | Spend, CRM revenue, CRM orders for T-1 |
| 3-day trend reconciliation | `ReconciliationSummary` | ROAS values for T-3, T-2, T-1 |
| Open alerts | `AlertEvent` | Alert count per client |
| Goal defaults | `ClientGoalDefaults` | ROAS/CPA targets for comparison |
| Sync runs | `ClientSyncRun` | Freshness check (>48h = stale) |

### Per-Client Metrics

- **Spend**: `totalMetaSpend` from reconciliation summary (Meta = delivery source)
- **Revenue**: `totalCrmRevenue` from reconciliation summary (CRM = source of truth)
- **ROAS**: `revenue / spend` (null if spend <= 0)
- **CPA**: `spend / orders` (null if orders <= 0)
- **Trend**: 3-day ROAS change (>10% = up, <-10% = down, else flat)

### Portfolio Totals

- `totalSpend` / `totalRevenue` / `totalOrders`: sums across clients
- `blendedRoas`: `totalRevenue / totalSpend`
- `blendedCpa`: `totalSpend / totalOrders`

## How Status Is Computed

`computeClientPerformanceStatus()` in `lib/dailySummary/status.ts`:

| Status | Condition |
|--------|-----------|
| `insufficient_data` | No spend AND no revenue for this client yesterday |
| `critical` | Alert count >= 2, OR ROAS < 70% of goal |
| `at_risk` | ROAS 70-85% of goal, OR CPA > 130% of goal, OR trend down with ROAS below goal |
| `scaling` | ROAS >= 115% of goal AND trend up or flat |
| `stable` | Everything else (default for unknown goal states) |

### Risk Level

| Status | Risk |
|--------|------|
| critical | critical |
| at_risk | high |
| stable | low |
| scaling | none |
| insufficient_data | none |

### Scale Readiness

- `ready`: scaling status + fresh sync
- `possible`: stable + trend up + fresh sync
- `not_ready`: everything else

## How Trust State Affects Display

Trust state is computed inline in the aggregator from data quality signals:

| Trust State | Trigger | Display |
|-------------|---------|---------|
| `healthy` | All good | No banner |
| `unverified` | No data at all | Gray banner with "Run syncs" message |
| `warning` | Stale sync OR partial CRM | Amber banner with specific message |
| `suspect` | Both stale AND partial | Orange banner + "View Health Check" link |
| `blocked` | (reserved for health page) | Red banner |

When trust state is not `healthy`, a prominent `TrustBanner` component appears above the alerts banner, linking to `/health` for detailed validation.

Accounts with `insufficient_data` status:
- Show a sky-blue left border (distinct from other statuses)
- Display "No Data" badge
- Primary action: "Review Health" → `/health`
- Secondary action: "View Account" → client decision page

## Where Drill-Downs Route

| Action | Route | When |
|--------|-------|------|
| Scale | `/clients/{id}/decision` | Scaling accounts |
| Monitor | `/clients/{id}/decision` | Stable accounts |
| Investigate | `/clients/{id}/decision` | At-risk accounts |
| Fix Now | `/clients/{id}/decision` | Critical accounts |
| Create Test | `/creative-lab/launch?clientId={id}` | At-risk (secondary) |
| Review Health | `/health` | Insufficient data accounts |
| View Health Check | `/health` | Trust banner CTA |

## Current Limitations

1. **Yesterday only** — no date range selection for the summary
2. **No portfolio-level CPA target** — `cpaVsTarget` always null
3. **Trust state is heuristic** — based on data signals, not full health check evaluation
4. **No real-time refresh** — page loads once from server
5. **Attribution window fixed** — 7 days, not configurable per-dashboard
6. **Status requires goals** — accounts without goals default to "stable" even if performing poorly
7. **Trend requires 2+ valid days** — sparse data defaults to "flat"

## Key Files

| File | Purpose |
|------|---------|
| `types/dailySummary.ts` | All type definitions |
| `lib/dailySummary/aggregator.ts` | Server-side data aggregation |
| `lib/dailySummary/status.ts` | Pure status/trend/risk computation |
| `app/home/page.tsx` | Server component, loads summary |
| `app/DailyDashboardView.tsx` | Client component, renders dashboard |
