# Image Variation Results Ingestion and Asset-Level Outcome Tracking

## Overview

This layer ingests performance data for launched image variation experiments, evaluates outcomes, and tracks results at the asset level. It reuses the existing experiment evaluation pipeline (ingestor, comparator, detector) adapted for image variation launch plans.

## How Image Variation Test Results Are Ingested

### Flow

1. **Launch plan** exists at `/creative-lab/image-variations/launch` with `launched` state
2. Navigate to `/creative-lab/image-variations/results`
3. Click "Refresh Results" to ingest latest data
4. For each launched plan:
   - Load Meta delivery data (spend, impressions, clicks) from `MetaSyncedInsight`
   - Load CRM outcomes (orders, revenue) from `CRMPerformanceRow`
   - In simultaneous mode, CRM split proportionally by Meta spend
   - Build metric snapshots for control and challenger
   - Compare variants (primary + secondary deltas, guardrail checks)
   - Detect winner using 7-step evaluation logic
   - Return structured result with outcome, confidence, and recommendations

### Data Sources

| Data | Source | Used For |
|------|--------|----------|
| Spend, impressions, clicks | `MetaSyncedInsight` (Meta API) | Delivery metrics, CTR, CPM |
| Orders, revenue | `CRMPerformanceRow` (Shopify) | ROAS, CPA — source of truth |
| Success criteria | Launch plan | Thresholds, minimums |
| Evaluation window | Launch plan | Time-based progress |

## How Outcomes Are Evaluated

### 7-Step Detection Sequence

1. **Data quality** — Both variants have non-zero spend?
2. **Insufficient data** — Spend and conversions above minimums?
3. **Guardrail breaches** — Any safety metrics violated?
4. **Window completion** — Is the 7-day evaluation window complete?
5. **Primary metric lift** — Does lift exceed the success threshold?
6. **Mixed signals** — Do secondary metrics oppose the primary result?
7. **Winner declaration** — Challenger wins, control holds, or no clear winner

### Outcome Values

| Outcome | Meaning |
|---------|---------|
| `in_progress` | Test is running, window not complete |
| `insufficient_data` | Not enough spend or conversions for reliable evaluation |
| `challenger_wins` | Challenger beats control on primary metric |
| `control_holds` | Control maintains advantage |
| `no_clear_winner` | Metrics within threshold — no meaningful difference |
| `mixed_result` | Primary and secondary metrics disagree |
| `failed_test` | Data quality failure |
| `archived` | Manually archived |

### Tracking States

| State | Meaning |
|-------|---------|
| `pending_launch` | Plan exists but not yet launched |
| `active` | Test running, collecting data |
| `evaluating` | Window complete, evaluating results |
| `completed` | Outcome determined |
| `stale` | Data not refreshing |
| `blocked` | Data quality failure |

## What Confidence Means

Confidence is a magnitude-based proxy (0–1) indicating how reliable the outcome is:

| Level | Range | Meaning |
|-------|-------|---------|
| High | ≥ 0.7 | Strong signal, sufficient data |
| Medium | 0.4–0.7 | Moderate signal, may need more data |
| Low | < 0.4 | Weak signal, insufficient for action |

Confidence factors:
- Evaluation window completion percentage
- Spend and conversion volume vs minimums
- Guardrail breach count
- Magnitude of primary metric lift

## How Results Attach to the Image Variation Lifecycle

Each result links back to:
- **Source candidate** via `sourceCandidateId` (the approved image variation)
- **Source request** via `sourceRequestId` (the generation request)
- **Source creative** via `sourceCreativeId` (the control creative)
- **Launch plan** via `planId`
- **Client** via `clientAccountId`
- **Campaign** via `campaignId`
- **Variation intent** via `variationIntent`

The `buildImageVariationLifecycleLink()` function creates a structured link record connecting the result back to the candidate lifecycle.

## Current Limitations

1. **No persistent result storage** — results computed at query time from synced data
2. **No autonomous actions** — no auto-scaling winners or pausing losers
3. **CRM allocation is proportional** — in simultaneous mode, CRM is split by Meta spend ratio (not exact per-ad attribution)
4. **No cross-experiment aggregation** — each test evaluated independently
5. **7-day window enforced** — cannot change evaluation window (matches CRM attribution)
6. **No asset-level learning extraction** — that comes in the next step

## File Structure

```
lib/imageVariation/
  ├── resultsTypes.ts  — Outcome, tracking state, snapshot, comparison, confidence types
  ├── results.ts       — Ingestion, evaluation, comparison, lifecycle linkage
  └── index.ts         — Exports results types and functions

app/creative-lab/image-variations/
  ├── actions.ts       — Extended with ingestResultsForPlanAction, ingestAllResultsAction
  └── results/
      ├── page.tsx                          — Server component
      └── ImageVariationResultsView.tsx     — Client results view
```

## Next Steps

- Image variation learning memory and reuse layer
- Persistent result storage for historical tracking
- Per-asset outcome history aggregation
- Winner/loser routing recommendations
