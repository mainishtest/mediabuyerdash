# Launched Creative/Image Results Ingestion & Test Outcome Tracking

## Overview

This system closes the loop from creative launch → performance measurement → outcome determination → learning extraction → Creative Lab feedback.

## How Launched Assets Are Tracked

### Auto-Creation Flow
```
executeMetaLaunch() succeeds
  → autoCreateExperiment() — creates ExperimentRecord with control/challenger mapping
  → createTestResultFromLaunch() — creates CreativeTestResultRecord (status: active)
  → Cron: ingestAllActiveResults() — periodically ingests Meta + CRM data
  → Outcome evaluated automatically when evaluation window completes
```

### Tracking States (CreativeTestTrackingState)
| State | Meaning |
|-------|---------|
| `pending_launch` | Test created but launch not yet active |
| `active` | Launch running, evaluation window open |
| `evaluating` | Window complete, outcome being computed |
| `completed` | Final outcome recorded |
| `stale` | No update in 14+ days past window end |
| `blocked` | Missing ad mapping or data prerequisites |

### Test Outcomes (CreativeTestOutcome)
| Outcome | Meaning |
|---------|---------|
| `in_progress` | Evaluation window not yet complete |
| `insufficient_data` | Not enough spend/conversions to evaluate |
| `no_clear_winner` | Metrics within threshold — no meaningful difference |
| `challenger_wins` | Challenger creative outperforms control |
| `control_holds` | Control maintains advantage over challenger |
| `mixed_result` | Primary and secondary metrics disagree |
| `failed_test` | Technical or data failure |
| `archived` | Manually closed |

## How Outcomes Are Computed

### Data Sources
- **Meta delivery**: spend, impressions, clicks, CTR, CPM — from `MetaSyncedInsight`
- **CRM revenue**: orders, revenue — from Shopify order data (7-day attribution)
- **Derived metrics**: ROAS = revenue/spend, CPA = spend/orders

### Evaluation Pipeline
```
1. ingestExperimentResults() — loads Meta + CRM data for both variants
2. compareExperimentVariants() — computes deltas and lifts
3. detectWinner() — sequential checks:
   a. Data quality (both variants have delivery?)
   b. Volume thresholds (spend ≥ $50, conversions ≥ 5)
   c. Guardrail checks
   d. Window completion
   e. Primary metric lift vs threshold (default: 10%)
   f. Mixed signal detection (opposing secondaries)
4. computeCreativeTestConfidence() — magnitude-based confidence
5. deriveTrackingState() — determines new tracking state
```

### Confidence Scoring
| Level | Score Range | Meaning |
|-------|------------|---------|
| `very_high` | ≥ 0.80 | Strong signal, high lift |
| `high` | ≥ 0.60 | Clear directional signal |
| `medium` | ≥ 0.35 | Moderate signal |
| `low` | < 0.35 | Weak or early signal |

Formula: `min(0.95, |lift| / (threshold × 2))`
Reduced by 20% if evaluation window not yet complete.

## How Results Link Back Into Creative Lab

### Lifecycle Linkage
Each test result creates a `CreativeLifecycleResultLinkRecord` connecting:
- `testResultId` → the outcome record
- `prepItemId` → the publish prep item (source creative)
- `briefId` → the creative brief that generated the variant
- `launchPlanId` → the experiment launch plan
- `experimentId` → the experiment tracking both variants

### Learning Extraction
When a test completes with a decisive outcome:
1. `summarizeExperimentLearnings()` creates human-readable insights
2. `ExperimentLearningRecord` stored with:
   - `briefIntent` + `draftType` tags for cross-workflow reuse
   - `winningPattern` (e.g., "high_roas_angle", "high_ctr_hook")
   - `usableForBriefs` / `usableForScoring` flags
3. Creative Lab brief generation can query these learnings

### Recommended Next Steps
| Outcome | Recommended Action |
|---------|-------------------|
| `challenger_wins` | Mark winner for review, return loser to Creative Lab |
| `control_holds` | Archive challenger, generate new angle in Creative Lab |
| `no_clear_winner` | Extend test duration or increase budget |
| `mixed_result` | Review raw data for attribution issues |
| `insufficient_data` | Rerun with higher budget/longer window |
| `failed_test` | Verify Meta sync and external IDs |

## Batch Ingestion (Cron)

### Endpoint
`GET /api/cron/ingest-launched-results`
- Auth: `Bearer CRON_SECRET`
- Schedule: Every 30 minutes (recommended)
- Processes up to 100 active/evaluating tests per run

### Stale Detection
Tests are marked `stale` when:
- Evaluation window ended 14+ days ago with no update
- No window dates set and last update > (windowDays + 14 days) ago

## Manual Ingestion

### Single Test
```
POST /api/creative-lab/results/{id}/ingest
```
Triggers immediate ingestion for one test result.

### Single Experiment
```
POST /api/experiments/{id}/ingest
```
Triggers ingestion at the experiment level (syncs to test result if linked).

## Stored Data

### Per Test Result (CreativeTestResultRecord)
| Category | Fields |
|----------|--------|
| Identity | id, clientAccountId, name |
| Tracking | trackingState, outcome |
| Source links | launchPlanId, experimentId, prepItemId, briefId |
| Control | controlCreativeId, controlCreativeName, controlAdExternalId |
| Challenger | challengerVariantTitle, challengerAdExternalId |
| Metrics | controlSnapshotJson, challengerSnapshotJson |
| Comparison | primaryMetricDelta, primaryMetricLift, guardrailBreaches |
| Confidence | confidence (0–1), winningVariant |
| Window | windowStartedAt, windowEndsAt, isWindowComplete |
| Action | recommendedNextStep, markedForReview, archivedAt |

### Per Lifecycle Link (CreativeLifecycleResultLinkRecord)
- Back-references to source creative entities
- Outcome + confidence snapshot at time of attachment

## Key Files

| File | Purpose |
|------|---------|
| `lib/launchedAssetResults/bridge.ts` | Launch → test result auto-creation |
| `lib/launchedAssetResults/batchIngestor.ts` | Batch ingestion + stale detection |
| `lib/creativeTestResults/ingestor.ts` | Single-test ingestion orchestrator |
| `lib/creativeTestResults/evaluator.ts` | Outcome evaluation + confidence |
| `lib/creativeTestResults/lifecycle.ts` | Lifecycle linking + next steps |
| `lib/creativeTestResults/db.ts` | CreativeTestResultRecord CRUD |
| `lib/experiments/ingestor.ts` | Meta + CRM data loading |
| `lib/experiments/comparator.ts` | Variant comparison |
| `lib/experiments/detector.ts` | Winner detection |
| `lib/experiments/learnings.ts` | Learning extraction |
| `app/api/cron/ingest-launched-results/route.ts` | Cron batch endpoint |
| `app/api/creative-lab/results/[id]/ingest/route.ts` | Manual single ingestion |

## Future: Winner/Loser Routing

This architecture prepares for the next step by:
- Storing `recommendedNextStep` on every completed test
- Linking outcomes back to source creatives via lifecycle links
- Tagging learnings with `briefIntent` + `winningPattern` for reuse
- Existing `CreativeOutcomeRouteRecord` model handles routing decisions
- `lib/creativeOutcomeRouting/` module already implements routing logic

## Current Limitations

1. **CRM allocation** — Simultaneous tests split CRM revenue proportionally by Meta spend. This is an approximation.
2. **7-day attribution only** — Attribution window is fixed at 7 days (not configurable per-test).
3. **No statistical significance** — Confidence is magnitude-based, not a proper statistical test.
4. **Batch limit** — Cron processes max 100 tests per run.
5. **Manual trigger needed** — No webhook-based auto-ingestion when Meta data arrives.
