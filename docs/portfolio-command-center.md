# Portfolio Command Center

**Route:** `/portfolio`
**Phase:** 7 — Portfolio Orchestration and Multi-Account Optimization Governance

---

## What It Is

The Portfolio Command Center is the top-level operating surface for managing many clients and ad accounts together. It lets operators:

- See the health of every client account at a glance
- Identify which accounts need attention first (worst health surfaced first)
- Spot risks, opportunities, overdue approvals, and governance issues across the whole portfolio
- Navigate quickly into the right lower-level workflow for each account

This is a **visibility, prioritization, and navigation surface**. It does not execute automation, reallocate budgets, or replace the lower-level Command Center, Approvals, or Governance workflows.

---

## Data Sources

The portfolio aggregator pulls from the following Prisma models on each page load:

| Data | Source | Purpose |
|------|--------|---------|
| Financials (spend, revenue, orders) | `ReconciliationSummary` | ROAS, CPA, and revenue. CRM is source of truth. 7-day attribution. |
| Alert signals | `AlertEvent` | High-severity alerts drive health score down |
| Pending approvals | `ProposedAutomationAction` | Count per client, oldest pending timestamp |
| Emergency stops | `GovernanceStop` (scope=client) | Detected and surfaced as critical risk |
| Autonomy mode | `ActionSafetyPolicy` (scope=client) | Shown per client; restricted mode penalizes health |
| Auto-execution settings | `AutoExecutionSettings` | Whether guarded auto-execution is enabled |
| Budget pacing | `BudgetPacingTarget` + `UTMPerformanceRow` | Month-to-date pacing vs expected |
| Experiments | `ExperimentRecord` + `ExperimentResultRecord` | Active count, winners awaiting action |
| Sync health | `ClientSyncRun` | Stale sync (no successful sync > 48 h) |
| Goal defaults | `ClientGoalDefaults` | ROAS and CPA targets for health scoring |
| Recent auto-exec logs | `AutoExecutionLog` | Execution count over last 7 days |
| Ready creatives | `PublishPrepRecord` | Approved creatives awaiting launch |

---

## Health Scoring

Each client receives a **health score from 0–100** computed by `lib/portfolio/health.ts` (pure functions, no DB).

**Baseline: 75** (falls in the "healthy" tier before any signals apply)

| Signal | Adjustment |
|--------|-----------|
| Emergency stop active | −40 |
| Restricted autonomy mode | −15 |
| 3+ high-severity alerts | −20 |
| 1–2 high-severity alerts | −10 |
| Approval overdue > 48 h | −15 |
| Stale sync (> 48 h) | −12 |
| Pacing extreme (< 60% or > 130%) | −15 |
| Pacing off (< 85% or > 115%) | −8 |
| ROAS significantly below goal (< 70%) | −10 |
| ROAS above goal | +10 |
| ROAS significantly above goal (> 130%) | +15 |

**Health tiers:**

| Score | Label | Priority |
|-------|-------|---------|
| 0–35 | Critical | critical |
| 36–55 | At Risk | high |
| 56–70 | Needs Attention | medium |
| 71–85 | Healthy | low |
| 86–100 | Strong | low |

Health board is sorted worst-first by default. Operators can switch to sort by spend or name.

---

## Risks and Opportunities

**Risks** are extracted from health board items and surfaced as a ranked list:
- Emergency stops (critical)
- Multiple high-severity alerts (high/critical)
- Critical pacing deviation (< 60% or > 130%) (critical)
- Overdue approvals > 48 h (high)
- Stale sync (medium)
- ROAS < 70% of goal (high)
- Restricted automation mode (high)

**Opportunities** are extracted when positive signals are detected:
- Experiment winners with a recommended action (high)
- ROAS > 130% of goal (consider scaling budget) (medium)
- Approved creatives awaiting launch (medium)
- Under-spending with on-goal ROAS (consider budget increase) (medium)

Both lists are sorted by priority descending and capped at 20 items each.

---

## How Operators Should Use It Daily

**Morning review (5 min):**
1. Open `/portfolio` — scan the KPI summary bar for portfolio-level ROAS and spend
2. Review "Accounts at Risk" and "Emergency Stops" KPI cards
3. Scroll the health board — red/amber cards need attention today
4. Review the Risks panel — act on critical and high items first

**Triage flow:**
- Emergency stop → click "Governance" on the health card → clear the stop or escalate
- Overdue approval → click "Open Approvals" → review and approve/reject
- Stale sync → navigate to Integrations → trigger a manual sync
- Experiment winner → navigate to Experiments → deploy the winning variant

**Opportunity review (weekly):**
- Check Opportunities panel for accounts with strong ROAS or under-utilized budget
- Creative Ready opportunities → launch approved variants from Creative Lab

---

## Filters

| Filter | Scope | Triggers refetch? |
|--------|-------|------------------|
| Client | URL param | Yes |
| Date range | URL param | Yes |
| Risk level | Client-side (useState) | No |
| Automation mode | Client-side (useState) | No |
| Approval state | Client-side (useState) | No |
| Sort health board | Client-side (useState) | No |

Client and date filters are URL-driven so they survive page refresh and can be shared as links.

---

## Responsive Behaviour

**Mobile:**
- KPI cards: 2 columns
- Health board: 1 column, stacked cards
- Risks/Opportunities: single-column list (highest priority at top)
- Filters collapse naturally into rows

**Desktop:**
- KPI cards: 8 columns (full bar)
- Health board: 2–3 column grid
- Risks and Opportunities: side-by-side 2-column layout
- Approvals and Automation: side-by-side 2-column layout

---

## Architectural Notes

- **Aggregation lives in `lib/portfolio/aggregator.ts`** — server-only, direct Prisma queries
- **Health scoring lives in `lib/portfolio/health.ts`** — pure functions, no DB, safe to import anywhere
- **Types live in `lib/portfolio/types.ts`** — no business logic, safe to import in client components
- **`PortfolioView.tsx`** is `"use client"` — only imports types and display helpers, never the aggregator
- **Section components** are server-compatible (no `"use client"`) — they receive already-scored data as props
- The portfolio aggregator calls the same DB tables as the Command Center and other modules, but does not import from those modules (avoids circular dependencies)

---

## Current Limitations

- Health scores are computed from reconciliation summary data — accounts with no reconciliation run in the selected date range will show $0 spend/revenue
- Pacing is based on client-level targets only (campaign-level pacing targets are not aggregated here)
- Governance stop detection covers `scope=client` stops only; global or action-type stops are not per-client and are not surfaced in the health board
- The portfolio view does not yet implement cross-account budget reallocation logic (planned for Phase 8)
- Autonomy mode shows the policy for `scope=client` — more granular campaign-level policies are not aggregated at the portfolio level

---

## Planned Next Step (Phase 8)

Cross-account opportunity, risk, and budget governance layer:
- Portfolio-level budget allocation recommendations
- Cross-account ROAS benchmarking
- Automated risk escalation across accounts
- Portfolio-level experiment coordination
