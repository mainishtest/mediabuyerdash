# Daily Executive Summary Dashboard

## Overview

The Daily Executive Summary is the default home page (`/`). It provides a decision-first view of yesterday's performance across all client accounts, with clear status indicators and immediate action buttons.

## How the Daily Summary Is Calculated

### Data Sources
- **CRM Revenue**: From `ReconciliationSummary` (Shopify/CRM — source of truth)
- **Spend**: From `ReconciliationSummary` (Meta spend data)
- **ROAS**: `revenue / spend` (CRM-sourced, 7-day attribution window)
- **CPA**: `spend / orders` (CRM orders)
- **Goals**: From `ClientGoalDefaults` (targetRoas, targetCpa)
- **Alerts**: From `AlertEvent` (open/acknowledged)
- **Sync State**: From `ClientSyncRun` (latest completed run)

### Date Window
- **Yesterday**: The dashboard focuses on the previous day's performance
- **3-day trend**: ROAS values from day-3, day-2, and day-1 are compared
- **Attribution**: All revenue figures use a 7-day attribution window from CRM

## How Status Is Determined

Each client receives one of four statuses based on these rules (evaluated in order):

| Status | Condition |
|--------|-----------|
| **Critical** | Alert count ≥ 2, OR ROAS < 70% of goal |
| **At Risk** | ROAS 70–85% of goal, OR CPA > 130% of goal, OR downward trend with ROAS below goal |
| **Scaling** | ROAS ≥ 115% of goal AND trend is up or flat |
| **Stable** | Default — ROAS within ±15% of goal, no major signals |

### Trend Direction
- **Up**: Day-1 ROAS ≥ 10% higher than Day-3 ROAS
- **Down**: Day-1 ROAS ≥ 10% lower than Day-3 ROAS
- **Flat**: Change within ±10%

## How Action Recommendations Are Generated

Actions are determined by client status:

| Status | Actions |
|--------|---------|
| **Scaling** | `Scale` (primary), `View Details` |
| **Stable** | `Monitor`, `View Details` |
| **At Risk** | `Investigate`, `Create Test` |
| **Critical** | `Fix Now` (danger), `Pause / Review` |

### Action Routing
- **Scale** → `/clients/{id}` (client dashboard)
- **Investigate** → `/clients/{id}` (client drill-down)
- **Create Test** → `/creative-lab/launch?clientId={id}` (experiment creation)
- **Fix Now** → `/clients/{id}` (issue-focused view)
- **View Details** → `/clients/{id}` (client dashboard)
- **Monitor** → `/clients/{id}` (client dashboard)

## Limitations

1. **Yesterday only**: The dashboard shows the previous day. Intra-day data is not displayed.
2. **Reconciliation dependency**: If reconciliation hasn't run for yesterday, the dashboard will show zero metrics and display a "No data" warning.
3. **Partial CRM data**: If Meta spend exists but no CRM revenue is recorded, ROAS will be null and status defaults to "stable."
4. **Missing goals**: Accounts without configured ROAS/CPA goals cannot be classified as "scaling" or "at_risk" based on goal performance — they default to "stable."
5. **No campaign-level breakdown**: This is a client-level summary. Campaign drill-down is planned for Phase 11.
6. **Trend requires 2+ days**: If fewer than 2 days of ROAS data exist, trend defaults to "flat."

## Architecture

```
types/dailySummary.ts           — Type definitions
lib/dailySummary/status.ts      — Pure decision logic (no DB)
lib/dailySummary/aggregator.ts  — DB aggregation layer
app/page.tsx                    — Server component (data fetch)
app/DailyDashboardView.tsx      — Client component (UI)
```

### Design Principles
- **Aggregation is separate from UI**: `aggregator.ts` handles all DB queries; `DailyDashboardView.tsx` handles all rendering
- **Decision logic is reusable**: `status.ts` contains pure functions that can be used in other contexts (API endpoints, notifications, etc.)
- **Existing workflows are reused**: Action buttons route to existing pages (`/clients/{id}`, `/creative-lab/launch`)
- **No duplicate data pipelines**: All data comes from existing `ReconciliationSummary`, `AlertEvent`, and `ClientGoalDefaults` tables
