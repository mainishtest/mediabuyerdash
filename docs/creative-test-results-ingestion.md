# Creative Performance Results Ingestion and Test Outcome Tracking

## Overview

The Creative Test Results layer tracks launched creative A/B tests end-to-end:
- Ingests Meta delivery data and CRM outcome data for both control and challenger
- Compares performance on the primary metric and secondary metrics
- Evaluates a test outcome using the same winner-detection logic as Experiments
- Maintains a trackable `CreativeTestResult` record with lifecycle links back through the Creative Lab chain (Brief → Scoring → Publish Prep → Launch Plan → Test Result → Experiment)

**Route:** `/creative-lab/results`
**API base:** `/api/creative-lab/results`

---

## Workflow

```
Launch Plan (readyForLaunch → launched)
        ↓
  Create Test Result  (POST /api/creative-lab/results)
        ↓
  Run Ingestion       (POST /api/creative-lab/results/[id]/ingest)
        ↓
  Review Outcome      (manual — no autonomous winner scaling or loser pausing)
        ↓
  Archive or Forward  (PATCH /api/creative-lab/results/[id])
```

---

## Test Tracking States

| State           | Meaning                                                      |
|-----------------|--------------------------------------------------------------|
| `pending_launch` | Created but ads are not yet live                            |
| `active`        | Ads running, evaluation window not yet reached               |
| `evaluating`    | Evaluation window reached, awaiting outcome decision         |
| `completed`     | Outcome recorded and actioned (winner scaled or test closed) |
| `stale`         | Window passed but no ingestion/action taken                  |
| `blocked`       | Missing creative mapping, ad IDs, or CRM data               |

State is computed by `deriveTrackingState()` on every ingest — it is never manually set except by operator override via PATCH.

---

## Ingestion

### What Ingestion Does

`ingestCreativeTestResults(testResultId)` in `lib/creativeTestResults/ingestor.ts`:

1. **Loads** the `CreativeTestResult` from DB
2. **Resolves an ExperimentPlan** — either from a linked `ExperimentRecord` (via `loadExperimentById()`) or from a proxy built from the test result's own fields (`buildExperimentPlanProxy()`)
3. **Calls** `ingestExperimentResults(plan)` from `lib/experiments/ingestor.ts` — reuses all Meta + CRM loading logic
4. **Adapts** snapshots from `ExperimentMetricSnapshot` → `CreativeTestMetricSnapshot`
5. **Compares** variants by delegating to `compareExperimentVariants()` (no math duplication)
6. **Evaluates** outcome by delegating to `detectWinner()`, then mapping to `CreativeTestOutcome`
7. **Computes** confidence score and level
8. **Derives** new tracking state
9. **Persists** updated result to DB
10. **Syncs back** to `upsertExperimentResult()` + `saveExperimentLearnings()` (non-blocking, best-effort)
11. **Creates** a `CreativeLifecycleResultLink` if one does not yet exist

### Data Sources

| Data Type           | Source                          | Notes                              |
|---------------------|---------------------------------|------------------------------------|
| Impressions, CPM, Spend, CTR | `MetaSyncedInsight`    | Via Meta Insights API              |
| ROAS, CPA, Orders, Revenue   | `CRMPerformanceRow`    | 7-day attribution window enforced  |
| CRM allocation      | Proportional by Meta spend      | Campaign-level CRM split by spend ratio |

**CRM is always the source of truth for ROAS and CPA.** Meta self-reported conversions are never used for outcome determination.

### Attribution Window

The `evaluationWindowDays` field on the test result (default: 7) controls:
- When the evaluation window is considered complete
- Which CRM rows qualify (7-day window enforced at the CRM query level)

---

## Outcome Evaluation

### Outcome Values

| Outcome              | Meaning                                                    |
|----------------------|------------------------------------------------------------|
| `in_progress`        | Window not complete — preliminary data only                |
| `insufficient_data`  | Window complete but not enough spend or conversions        |
| `no_clear_winner`    | Both variants performed similarly within threshold         |
| `challenger_wins`    | Challenger exceeded control by ≥ success threshold         |
| `control_holds`      | Control beat challenger — challenger did not meet bar      |
| `mixed_result`       | Primary metric inconclusive; secondary metrics diverge     |
| `failed_test`        | Guardrail breaches (budget burn, delivery issue, etc.)     |
| `archived`           | Test manually closed without a definitive outcome          |

`in_progress` is unique to the Creative Test Results layer — it maps from `insufficient_data` when the evaluation window is not yet complete, providing a more intuitive UX for in-flight tests.

### Success Threshold

Set on the test result via `successThreshold` (default: 0.10 = 10% lift on primary metric).

The challenger wins only if:
```
(challengerPrimary - controlPrimary) / controlPrimary  ≥  successThreshold
```

### Guardrail Breaches

The following guardrail breaches from `compareExperimentVariants()` are surfaced in the UI:
- Budget burn imbalance (one variant spending disproportionately)
- Delivery failure (one variant receiving < 10% of expected impressions)
- CPM spike (cost inflation masking CRM performance)
- CRM data missing for one or both variants

---

## Confidence

`computeCreativeTestConfidence()` maps a 0–1 raw confidence score to a level:

| Level       | Score Range | Meaning                                      |
|-------------|-------------|----------------------------------------------|
| `low`       | 0 – 0.39    | Preliminary — do not act on this yet          |
| `medium`    | 0.40 – 0.64 | Directional signal — monitor closely          |
| `high`      | 0.65 – 0.84 | Reliable signal — consider acting             |
| `very_high` | 0.85 – 1.0  | High confidence — ready to scale or close     |

The confidence score factors in:
- Evaluation window completeness
- Absolute spend per variant vs. `minSpendPerVariant`
- Conversion count per variant vs. `minConversionsPerVariant`
- Whether CRM data is available for both variants
- Absence of guardrail breaches

---

## Lifecycle Attachment

Every ingestion that produces a definitive outcome automatically creates (or updates) a `CreativeLifecycleResultLink`:

```
CreativeLifecycleResultLink {
  testResultId       → CreativeTestResult
  prepItemId         → PublishPrepRecord (the publish-prep item)
  briefId            → CreativeBriefRecord
  variantId          → CreativeBriefVariant (challenger)
  launchPlanId       → ExperimentLaunchPlanRecord
  experimentId       → ExperimentRecord (if linked)

  outcome            → final CreativeTestOutcome
  winningRole        → "challenger" | "control" | null
  confidence         → "low" | "medium" | "high" | "very_high"
  primaryLift        → numeric lift (e.g. 0.12 = +12%)
  attachedAt         → timestamp
}
```

This link is the single source of truth for "what happened to this creative test" across the full Creative Lab → Experiments lifecycle.

---

## Architecture

```
app/creative-lab/results/
├── page.tsx                    Server component (loads results + summary)
├── CreativeTestResultsView.tsx Client orchestrator (filter, select, update)
├── CreativeTestResultCard.tsx  Compact list card (outcome badge, lift, confidence)
└── CreativeTestResultDetail.tsx Full detail panel (metrics, window, actions)

app/api/creative-lab/results/
├── route.ts                    GET (list + summary) | POST (create)
└── [id]/
    ├── route.ts                GET (single) | PATCH (update fields)
    └── ingest/route.ts         POST (trigger ingestion)

lib/creativeTestResults/
├── ingestor.ts                 Main ingestion orchestrator
├── evaluator.ts                Adapts + delegates to lib/experiments/*
├── lifecycle.ts                Lifecycle link builders + summary helpers
├── db.ts                       DB persistence (CreativeTestResultRecord)
└── index.ts                    Public exports

types/creativeTestResults.ts    Pure TypeScript types (no lib imports)

prisma/
├── schema.prisma               CreativeTestResultRecord + CreativeLifecycleResultLinkRecord
└── migrations/add_creative_test_results.sql
```

### Reuse Contract

The Creative Test Results layer **delegates** to existing experiment infrastructure — it never duplicates math:

| Function Called                     | From                          |
|--------------------------------------|-------------------------------|
| `ingestExperimentResults(plan)`      | `lib/experiments/ingestor.ts`  |
| `compareExperimentVariants()`        | `lib/experiments/comparator.ts`|
| `detectWinner()`                     | `lib/experiments/detector.ts`  |
| `saveExperimentLearnings()`          | `lib/experiments/learnings.ts` |
| `upsertExperimentResult()`           | `lib/experiments/db.ts`        |
| `buildEvaluationWindow()`            | `lib/experiments/evaluator.ts` |

---

## DB Migration

Run the migration before deploying:

```sql
-- prisma/migrations/add_creative_test_results.sql
-- Creates:
--   CreativeTestResultRecord
--   CreativeLifecycleResultLinkRecord (with FK cascade to CreativeTestResultRecord)
```

```bash
psql $DATABASE_URL -f prisma/migrations/add_creative_test_results.sql
```

Then regenerate the Prisma client:

```bash
npx prisma generate
```

**Note:** The DB layer uses `(prisma as any).creativeTestResultRecord` until `prisma generate` is run in the deployment environment.

---

## API Reference

### `GET /api/creative-lab/results`

Query params: `?clientAccountId=xxx` (optional)

Returns:
```json
{
  "ok": true,
  "results": [...],
  "summary": {
    "total": 12,
    "pendingLaunch": 2,
    "active": 4,
    "evaluating": 2,
    "completed": 3,
    "stale": 1,
    "blocked": 0,
    "challengerWins": 2,
    "controlHolds": 1,
    "noWinner": 0
  }
}
```

### `POST /api/creative-lab/results`

Body:
```json
{
  "clientAccountId": "acc_123",
  "name": "Holiday Banner v2 vs Control",
  "challengerVariantTitle": "Holiday Banner v2",
  "controlCreativeName": "Control — Static Blue",
  "primaryMetric": "roas_7d",
  "launchPlanId": "lp_xxx",
  "experimentId": "exp_xxx"
}
```

### `POST /api/creative-lab/results/[id]/ingest`

Triggers ingestion. No body required.

Returns the updated `CreativeTestResult` with all metric snapshots, comparison, outcome, and confidence populated.

### `PATCH /api/creative-lab/results/[id]`

Accepted fields:
```json
{
  "markForReview": true,
  "archive": true,
  "unarchive": true,
  "linkExperiment": "exp_xxx",
  "linkLaunchPlan": "lp_xxx",
  "trackingState": "evaluating",
  "outcome": "challenger_wins"
}
```

---

## Current Limitations

1. **No autonomous winner scaling** — The system identifies a winner but never automatically scales spend, adjusts budgets, or pauses the loser. All actions are operator-initiated.

2. **No real-time streaming** — Ingestion is on-demand only (triggered by operator via "Run Ingestion" button). Automated scheduling is out of scope.

3. **CRM is campaign-level** — CRM performance rows are split proportionally by Meta spend ratio between variants. True ad-level CRM attribution requires pixel/UTM enrichment upstream.

4. **Single challenger** — Each test result tracks one control vs. one challenger. Multi-variant (A/B/C/n) tests must be tracked as separate test results.

5. **No statistical significance testing** — Confidence scoring is heuristic (spend + conversions + window completeness). True p-value / Bayesian significance is not computed.

6. **Attribution window is fixed** — The 7-day CRM attribution window is enforced at the query level and cannot be changed per-test without schema migration.

---

## Next Steps

- Wire "Create Test Result" button in Launch Plan Detail UI
- Add scheduled ingestion cron (daily refresh for all `active` tests)
- Expose per-variant ad external ID editing in the UI
- Add CRM UTM enrichment to enable true ad-level attribution
- Surface test result outcomes in Creative Lab hub scorecard
