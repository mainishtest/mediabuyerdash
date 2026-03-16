# Goal-Aware Optimization on Reconciled Metrics

## Overview

The goal-aware optimization layer evaluates campaign, ad set, and ad performance
against configured ROAS and CPA goals using **reconciled CRM-backed metrics** as
the single source of truth.

Meta delivery data (spend, clicks, impressions) is used for **delivery diagnostics
only**. Meta-reported conversions and revenue are **never** used for optimization
decisions.

---

## How Reconciled Metrics Are Used

### Source of Truth

| Metric         | Source          | Used For                        |
|----------------|-----------------|----------------------------------|
| Spend          | Meta Ads        | Delivery analysis, CPA/ROAS base |
| Clicks         | Meta Ads        | CTR calculation (diagnostic)     |
| Impressions    | Meta Ads        | CPM, frequency (diagnostic)      |
| Orders         | Shopify / CRM   | evaluatedCpa, volume tracking    |
| Revenue        | Shopify / CRM   | evaluatedRoas, business outcomes |

### Evaluated Metrics (always CRM-backed)

```
evaluatedCpa  = metaSpend / crmOrders     (null if crmOrders = 0)
evaluatedRoas = crmRevenue / metaSpend    (null if metaSpend = 0)
```

These evaluated metrics flow from:

1. **Reconciliation Engine** (`lib/reconciliation/`) — matches Meta UTM rows to
   Shopify/CRM orders using exact and fallback UTM key strategies.
2. **Snapshot Builder** (`lib/goalAwareOptimization/snapshot.ts`) — groups
   reconciled rows by entity level (campaign / ad set / ad) and aggregates
   spend + CRM outcomes into `ReconciledPerformanceSnapshot`.
3. **Evaluation Layer** (`lib/goalAwareOptimization/evaluate.ts`) — compares
   evaluatedCpa and evaluatedRoas against campaign goals.

---

## How Goals Are Evaluated

### Goal Inheritance

- **Campaigns** — evaluated against their own `roasGoalValue` and `cpaGoalValue`.
- **Ad Sets** — inherit goals from their parent campaign.
- **Ads** — inherit goals from their grandparent campaign (ad → adSet → campaign).

### Threshold Model (v1)

| Condition       | ROAS threshold              | CPA threshold                |
|-----------------|-----------------------------|-------------------------------|
| Strong          | ≥ goal × 1.10               | ≤ goal × 0.90                |
| Near (on track) | ≥ goal × 0.90               | ≤ goal × 1.10                |
| Weak            | < goal × 0.80               | > goal × 1.30                |

### Status Decision Tree

```
ROAS strong AND CPA strong          → "strong"
ROAS near AND CPA near              → "on_track"
ROAS weak AND CPA weak              → "critical"
ROAS weak OR CPA weak (not both)    → "underperforming"
Mixed signals / partial             → "watch"
No spend or CRM outcomes            → "no_data"
```

---

## Current Recommendation Rules (v1)

Recommendations are **deterministic** — no ML or probabilistic scoring.

| Status          | Action               | Condition                              |
|-----------------|----------------------|----------------------------------------|
| strong          | scale                | —                                      |
| on_track        | maintain             | —                                      |
| underperforming | reduce_spend         | ROAS below goal AND CRM orders > 0     |
| underperforming | review_creative      | ROAS below goal AND CRM orders = 0     |
| critical        | pause                | CRM orders ≥ 3                         |
| critical        | review_creative      | CRM orders < 3 (creative resonance)    |
| watch / no_data | watch                | —                                      |

All recommendations in v1 are **read-only suggestions**. No Meta write actions
(budget changes, pauses) are executed automatically.

---

## Data Flow

```
UTMPerformanceRow[]   CRMOrderRecord[]
        │                    │
        └────── Reconciliation Engine ──────┐
                                            ↓
                              ReconciliationMatchRow[]
                                            │
                                            ↓  (map to RawPerformanceInput)
                             buildReconciledPerformanceSnapshot()
                                            │
                                            ↓
                           ReconciledPerformanceSnapshot[]
                                            │
                                            ↓
                             evaluateEntityAgainstGoals()
                                            │
                                            ↓
                            GoalAwareEvaluationResult[]
                                            │
                                            ↓
                             buildGoalAwareRecommendation()
                                            │
                                            ↓
                            GoalAwareRecommendation[]
```

---

## Architecture Notes

### Separation of Concerns

- **Reconciliation matching** (`lib/reconciliation/`) — matches Meta UTM rows to
  CRM orders. Completely separate from the evaluation layer.
- **Snapshot building** (`lib/goalAwareOptimization/snapshot.ts`) — aggregates
  matched data by entity. Input is a `RawPerformanceInput[]` that can be sourced
  from UTM rows, match rows, or DB queries.
- **Evaluation** (`lib/goalAwareOptimization/evaluate.ts`) — pure function,
  deterministic, no side effects.
- **Recommendation** (`lib/goalAwareOptimization/recommend.ts`) — pure function,
  maps evaluation status to action type.
- **UI** (`app/optimization/`) — server component runs evaluation, client
  component handles filters and display.

### v1 Limitations

1. **Same-day attribution only** — Reconciliation currently matches on the same
   calendar day. The 7-day attribution window will be expanded in a future step.
2. **No ML scoring** — All evaluation logic is threshold-based. AI-driven
   diagnosis (e.g. creative underperformance root cause) is planned for the
   next step.
3. **No Meta write actions** — Recommendations are read-only. Budget execution
   and automated pausing are deferred to a future step.
4. **Single client account** — v1 assumes all campaigns belong to `act_1`.
   Multi-account support is planned.
5. **Sample data** — The `/optimization` page uses `lib/data/optimizationSample.ts`
   in v1. When real reconciliation DB data is available, replace the sample rows
   with a DB query mapped to `RawPerformanceInput`.

---

## Next Steps

The goal-aware optimization layer is designed to feed the next major step:

> **AI Diagnosis and Creative Recommendations** — driven by live reconciled
> underperformance signals from this layer.

The `GoalAwareEvaluationResult[]` and `GoalAwareRecommendation[]` types will
serve as structured inputs to the AI diagnosis engine, providing:
- Entity identity and hierarchy
- Actual vs goal deltas (ROAS, CPA)
- Reason codes as semantic signals
- Priority ranking for triage
