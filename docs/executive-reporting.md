# Executive Reporting & Client Summary Layer

## What It Is

The Executive Report (`/reports/executive`) is the business-clarity layer of the dashboard. It is designed for owners, operators, and clients who need to understand **what happened, what changed, what worked, and what is next** — without requiring deep product knowledge.

It does **not** replicate the operator Command Center. It has no action buttons, no approval queues, and no priority queues. Everything here is read-only and summarised for a business audience.

---

## How It Differs from the Command Center

| | Command Center | Executive Report |
|---|---|---|
| Audience | Operator | Owner / exec / client |
| Time horizon | Right now | Period summary |
| Primary question | What do I do next? | What happened? |
| Actions | Approve / reject / review | None — read only |
| Priority queue | Yes | No |
| Narrative | No | Yes — 7-question summary |
| Comparison period | No | Yes — delta vs prior period |
| Trend charts | No | Yes — spend / revenue / ROAS |

---

## What Data Feeds It

| Section | Data Source |
|---|---|
| KPI Cards | `ReconciliationSummary` (CRM source of truth) + `UTMPerformanceRow` fallback |
| Trend Charts | `UTMPerformanceRow` (daily spend) + `CRMPerformanceRow` (daily revenue) |
| Experiments | `ExperimentRecord` + `ExperimentResultRecord` |
| Creative Activity | `CreativeBriefRecord` + `PublishPrepRecord` |
| Approvals | `ProposedAutomationAction` (all statuses in period) |
| Auto-Executions | `AutoExecutionLog` |
| Alerts | `AlertEvent` (high + medium severity, open) |
| Pacing | `BudgetPacingTarget` + `UTMPerformanceRow` (current month spend) |

All ROAS and CPA metrics use **CRM revenue** as the source of truth with a **7-day attribution window**.

---

## How Summaries Are Constructed

### KPI Cards
`buildExecutiveKpiCards()` is a pure function that takes pre-fetched trend, experiment, creative, and approval data and returns 8 formatted `ExecutiveKpiCard` objects. Each card includes:
- Formatted display value
- Optional comparison delta (if prior-period data is available)
- Delta direction and semantic colour (success / warning / danger / neutral)
- Sparkline data for the mini inline chart

### Trend Summary
`fetchTrendSummary()` groups `UTMPerformanceRow` by date for daily spend, and `CRMPerformanceRow` by date for daily revenue. These are merged into a unified day array. Overall ROAS/CPA come from `ReconciliationSummary` (rolled-up, higher accuracy). If no reconciliation data exists, UTM row data is used as a fallback.

### Narrative Section
`buildExecutiveNarrative()` is a **pure function** — no AI, no DB calls. It takes the fully assembled summary data and generates 7 sentence-form answers:
1. **What happened** — spend, revenue, ROAS, CPA, orders summary
2. **What changed** — deltas vs comparison period (requires `compare=1` filter)
3. **What worked** — experiment winners, creative launches, executed automations
4. **What underperformed** — open alerts, pacing risks, no-winner experiments, below-breakeven ROAS
5. **Actions taken** — approved/rejected proposals, auto-executions, creative approvals
6. **What's next** — pending approvals, active experiments, ready-to-launch creatives

Upgrade path: this function can be swapped for an LLM call without touching the aggregation layer.

---

## Filters

| Filter | Behaviour |
|---|---|
| Client | URL param (`?clientId=`) — triggers server re-fetch |
| Date from / to | URL params (`?from=` `?to=`) — triggers server re-fetch |
| Compare to prior period | URL param (`?compare=1`) — adds a second fetch for the shifted date range |

All filters are applied in the browser's filter bar and navigate to a new URL. The page is `force-dynamic` so every load fetches fresh data.

---

## Current Limitations

- **KPI data requires reconciliation to have run.** If no `ReconciliationSummary` rows exist for the period, KPIs fall back to UTM row data (Meta-reported, not CRM-sourced).
- **Trend chart revenue** is from `CRMPerformanceRow`. If Shopify sync has not run, daily revenue will be zero even if reconciliation summaries exist.
- **Comparison period** is a simple backward shift of the same number of days. It is not calendar-month-aware.
- **No campaign-level filter UI** for this release. Pass `?campaignId=` manually if needed.
- **No auto-refresh.** The page requires a manual reload or filter apply to fetch new data.
- **Creative briefs vs variants.** `briefsCreated` counts `CreativeBriefRecord` rows. `variantsGenerated` counts `PublishPrepRecord` rows (variants that have reached the publish-prep stage). Early-stage Creative Lab items (queued, in_progress) are not counted.
- **Auto-execution log** only counts logs with an `executedAt` timestamp within the date range. Logs from guarded execution outside the range are excluded.

---

## Architecture

```
lib/executiveReporting/
  types.ts      — Pure type definitions (no logic)
  kpis.ts       — buildExecutiveKpiCards() — pure function, no DB
  narrative.ts  — buildExecutiveNarrative() — pure function, no DB, no AI
  aggregator.ts — buildExecutiveSummary() — all Prisma queries

app/reports/executive/
  page.tsx                 — Server component: auth guard + aggregator call
  ExecutiveReportView.tsx  — Client root: filter bar, layout, URL navigation
  sections/
    KpiSection.tsx         — 8 KPI cards with inline sparklines
    NarrativeSection.tsx   — 7-question executive summary block
    TrendSection.tsx       — Spend/Revenue area chart + ROAS line (recharts)
    ExperimentsSection.tsx — Test outcomes with winner highlighting
    CreativeSection.tsx    — Creative activity and launch status
    ApprovalsSection.tsx   — Automation proposals and workflow status
    ImpactSection.tsx      — Alerts, pacing, auto-execution, data warnings
```

## Preparation for Next Step

The `buildExecutiveNarrative()` function is isolated as a pure function precisely to make it easy to feed into a learning memory or insight-generation system in the next phase. The `ExecutiveNarrativeSection` type can be extended with confidence scores, source citations, or LLM-generated alternatives without touching the aggregation or rendering layers.
