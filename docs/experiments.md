# Closed-Loop Experiment Results and Winner Detection

This document covers how the experiment results layer ingests performance data, evaluates outcomes, detects winners, and feeds learnings back into the Creative Lab and brief generation workflows.

---

## Overview

The experiment layer sits between **Publish Prep** (where creatives launch) and the **next optimization cycle** (scale decisions, budget shifts). It does not mutate campaigns autonomously — it evaluates and recommends.

```
Challenger creative launched (via Publish Prep)
        ↓
Create experiment  ← POST /api/experiments
        ↓
Define: control, challenger, criteria, window
        ↓
Evaluation window runs (default: 7 days)
        ↓
Trigger evaluation ← POST /api/experiments/[id]/ingest
        ↓
ingestExperimentResults()   ← pulls MetaSyncedInsight + CRMPerformanceRow
compareExperimentVariants() ← computes deltas
detectWinner()              ← classifies outcome
summarizeExperimentLearnings() ← builds reusable insights
upsertExperimentResult()    ← persists result
saveExperimentLearnings()   ← persists learnings for reuse
        ↓
Display on /experiments — outcome, comparison, learnings, action controls
```

---

## Result Ingestion

Performance data is pulled from two sources:

| Source | Data | Used for |
|---|---|---|
| `MetaSyncedInsight` | spend, impressions, clicks, CTR, CPM | Delivery analysis |
| `CRMPerformanceRow` | orders, revenue | ROAS, CPA (source of truth) |

### Entity resolution

The system queries `MetaSyncedInsight` at the most specific level available:

```
externalAdId > externalAdSetId > externalCampaignId
```

If no Meta external IDs are set on the experiment, delivery data will be empty.

### CRM attribution in simultaneous mode

`CRMPerformanceRow` is campaign-level, not ad-level. In simultaneous mode (control and challenger run in parallel):
- Total campaign CRM (orders, revenue) is split between variants proportional to their Meta spend share.
- This is an approximation. For precise CRM attribution, use UTM tagging at the ad level.

In sequential mode, separate date windows isolate each variant's CRM data naturally.

---

## Winner Detection Logic

Detection runs in this order:

1. **Data quality check** — if both variants have zero spend → `failed_test`
2. **Volume check** — if spend or conversions below minimum thresholds → `insufficient_data`
3. **Primary metric evaluation** — compare control vs challenger on `primaryMetric`
4. **Threshold check** — if |lift| < `successThreshold` → `no_clear_winner`
5. **Mixed signal check** — if secondary metrics contradict primary → `mixed_result`
6. **Outcome declaration** — `challenger_wins` or `control_holds`

### Confidence score

Confidence is a magnitude-based proxy (not statistical significance):

```
confidence = min(0.95, |lift| / (successThreshold × 2))
```

If the evaluation window is not yet complete, confidence is multiplied by 0.8 to reflect preliminary status.

**This is not a formal p-value.** True A/B statistical significance requires randomized traffic split and sufficient sample size, which Meta's delivery algorithm does not guarantee.

---

## Outcome States

| State | Meaning |
|---|---|
| `insufficient_data` | Spend or conversion thresholds not met — cannot conclude |
| `no_clear_winner` | Both variants within threshold — difference is noise |
| `challenger_wins` | Challenger beats control on primary metric beyond threshold |
| `control_holds` | Control maintains advantage over challenger |
| `mixed_result` | Primary and secondary metrics disagree |
| `failed_test` | No delivery data found — verify Meta IDs and sync |
| `archived` | Experiment closed without conclusion |

---

## Success Criteria

| Parameter | Default | Description |
|---|---|---|
| `primaryMetric` | `roas_7d` | CRM ROAS over 7-day attribution window |
| `successThreshold` | `0.10` (10%) | Minimum relative lift to declare a winner |
| `minSpendPerVariant` | `$50` | Minimum spend per variant for reliable data |
| `minConversionsPerVariant` | `5` | Minimum orders per variant |
| `evaluationWindowDays` | `7` | Days to wait before evaluation |
| `secondaryMetrics` | `["cpa_7d", "ctr"]` | Additional metrics for mixed-signal detection |

---

## Learnings and Creative Lab Feedback

Each completed experiment generates an `ExperimentLearningRecord` tagged with:

- `clientAccountId` — scopes the learning to a client
- `briefIntent` — matches `CreativeBrief.intent` (e.g., `refresh_hook`, `new_angle`)
- `draftType` — matches `CreativeBrief.draftType`
- `winningPattern` — short label (e.g., `high_roas_angle`, `low_cpa_conversion`)
- `usableForBriefs` — true for `challenger_wins`, `control_holds`, `no_clear_winner`
- `usableForScoring` — true for `challenger_wins`, `control_holds`

### How learnings feed back:

1. **Brief generation** — query `loadExperimentLearnings({ clientAccountId, briefIntent })` before generating a new brief to surface relevant prior outcomes
2. **Recommendation logic** — winning patterns inform which creative directions to reinforce
3. **Future experiment planning** — learnings from losing challengers can redirect the next creative iteration

---

## API

### `GET /api/experiments`
List experiments. Optional: `clientAccountId`, `status`.

### `POST /api/experiments`
Create a new experiment plan.

**Required fields:** `name`, `clientAccountId`

**Optional fields:** `controlAdExternalId`, `controlAdSetExternalId`, `challengerPrepItemId`, `challengerAdExternalId`, `externalAdAccountId`, `evaluationWindowDays`, `primaryMetric`, `successThreshold`, `minSpendPerVariant`, `minConversionsPerVariant`

### `GET /api/experiments/[id]`
Load full experiment with result and learnings.

### `PATCH /api/experiments/[id]`
Actions: `archive`, `set_status`.

### `POST /api/experiments/[id]/ingest`
Trigger evaluation. Pulls live data, runs detection, persists result and learnings.

---

## Key Files

| File | Purpose |
|---|---|
| `types/experiment.ts` | All typed models |
| `lib/experiments/builder.ts` | `buildEvaluationWindow()`, `finaliseSnapshot()` |
| `lib/experiments/ingestor.ts` | `ingestExperimentResults()` — pulls Meta + CRM data |
| `lib/experiments/comparator.ts` | `compareExperimentVariants()` — pure delta computation |
| `lib/experiments/detector.ts` | `detectWinner()`, `buildExperimentOutcome()` |
| `lib/experiments/learnings.ts` | `summarizeExperimentLearnings()`, `attachOutcomeToCreativeHistory()` |
| `lib/experiments/db.ts` | All CRUD for experiment, result, learning records |
| `app/api/experiments/route.ts` | GET + POST |
| `app/api/experiments/[id]/route.ts` | GET + PATCH |
| `app/api/experiments/[id]/ingest/route.ts` | POST trigger evaluation |
| `app/experiments/page.tsx` | Server component |
| `app/experiments/ExperimentsView.tsx` | Client orchestrator |
| `app/experiments/ExperimentResultDetail.tsx` | Full detail panel |
| `app/experiments/ExperimentCard.tsx` | Compact list card |

---

## DB Setup Required

Three new models were added to the Prisma schema. Run when the Neon database is reachable:

```bash
npx prisma db push
```

Models added:
- `ExperimentRecord` — experiment plan
- `ExperimentResultRecord` — evaluation result (1 per experiment, upserted)
- `ExperimentLearningRecord` — reusable learnings, tagged for Creative Lab reuse

---

## Current Limitations

1. **CRM is campaign-level** — Ad-level CRM attribution requires UTM tagging at ad granularity. Current implementation splits campaign CRM by Meta spend ratio, which is an approximation.
2. **No statistical significance testing** — Confidence score is magnitude-based, not a p-value. For formal significance, a minimum sample size (e.g., 100+ conversions per variant) and proper test design are required.
3. **Simultaneous mode only** — Sequential (before/after) mode uses the same ingestion but requires manually setting the evaluation window dates to cover distinct time periods.
4. **No automated scale execution** — "Mark winner for scale review" links to the publish prep page. Actual budget scaling or ad pausing requires a separate approval step (next workflow phase).
5. **No traffic split enforcement** — Meta's delivery algorithm may not split traffic evenly. The system reports on observed delivery without controlling it.

---

## Next Step: Automated Scale and Loser Handling

The experiment results layer is designed to feed the next phase:

- Winning challengers flagged for scale review can trigger budget increase proposals via the automation rules layer
- Losing challengers can generate `review_creative` or `refresh_creative` automation actions
- Learning records inform the confidence score weighting in future scoring runs
