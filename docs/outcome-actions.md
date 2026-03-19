# Outcome Action Recommendations

## Overview

The outcome action layer converts experiment results into structured, guardrailed next-step
recommendations for media buyers. Recommendations are computed on-the-fly from experiment
data — no separate database table is required.

---

## How Recommendations Are Generated

When an experiment has been evaluated, `buildOutcomeActionRecommendations(experiment)` in
`lib/outcomeActions/recommender.ts` maps each outcome type to a set of typed action
recommendations:

| Outcome | Actions generated |
|---|---|
| `challenger_wins` (confidence ≥ 0.5) | Scale winner budget, reduce/pause loser, duplicate to new test |
| `challenger_wins` (confidence < 0.5) | Keep winner running (monitor), reduce/pause loser |
| `control_holds` | Keep control running, send challenger to Creative Lab, plan follow-up |
| `no_clear_winner` | Monitor only, plan bolder follow-up test |
| `mixed_result` | Investigate mixed signals, plan sequential follow-up |
| `insufficient_data` | Monitor and wait; reduce loser budget if material spend + poor ROAS |
| `failed_test` | Return to Creative Lab to fix tracking, check sync status |
| No result yet | Monitor only ("Evaluate Experiment First") |

Each call is pure and deterministic: given the same `ExperimentWithResult`, the same
recommendations are always returned. This means recommendations can be safely recomputed at
read time without storing them.

---

## Supported Action Types

| Action type | Description |
|---|---|
| `scale_winner_budget` | Propose a budget increase for the winning variant |
| `duplicate_winner_to_new_test` | Lock in the winner as the new control and start a fresh test |
| `keep_winner_running` | No change — continue monitoring the current winner |
| `pause_loser_candidate` | Flag the losing variant for pause review |
| `reduce_loser_budget` | Propose a budget reduction for the underperforming variant |
| `send_loser_to_creative_lab` | Route the losing creative back through Creative Lab |
| `launch_follow_up_experiment` | Plan a new experiment using learnings from this one |
| `monitor_only` | Informational — no action required yet |

---

## Priority Levels

| Priority | When assigned |
|---|---|
| `urgent` | scale_winner_budget with confidence ≥ 0.75; pause_loser with ROAS < 0.5 |
| `high` | scale_winner_budget with confidence ≥ 0.5; reduce_loser_budget; send_loser if failed_test |
| `medium` | Lower-confidence scale; duplicate/follow-up actions; monitor on mixed result |
| `low` | keep_winner_running; monitor_only on non-mixed outcomes |

---

## Readiness and Blockers

Each recommendation has a `readiness` state computed by `computeActionReadiness()`:

| State | Meaning |
|---|---|
| `not_ready` | No outcome exists or confidence is below 15% — cannot act yet |
| `review_required` | Evaluation window is still open — action is premature but possible |
| `ready_for_approval` | All conditions met — operator can approve through the workflow |
| `approval_blocked` | Blockers present (e.g. missing Meta external ID) — resolve before approving |
| `ready_for_execution` | Reserved for future autonomous execution (not yet used) |

### Common blockers

- No experiment outcome — evaluation has not been run yet
- Confidence below 15% — insufficient statistical signal
- Missing Meta external ID on winner or loser variant
- Evaluation window not yet complete (for budget-change actions)
- No client account ID (for follow-up experiment planning)

Blockers are shown inline on each recommendation card and gate the approve button in the UI.

---

## Scale Plan Structure

When a `scale_winner_budget` recommendation is generated, a `ScalePlan` is attached:

```ts
type ScalePlan = {
  targetVariant: "control" | "challenger";
  currentSpend: number;
  suggestedBudgetMultiplier: number;   // 1.1 / 1.25 / 1.5 depending on confidence
  suggestedDailyBudgetNote: string;
  scaleRationale: string;
  safetyChecks: string[];
  requiredApprovals: string[];
  automationActionType: string;        // "increase_budget"
};
```

Multiplier rules:
- confidence ≥ 0.70 → ×1.5
- confidence ≥ 0.50 → ×1.25
- confidence < 0.50 → ×1.10

---

## Loser Handling Plan Structure

Attached to `pause_loser_candidate`, `reduce_loser_budget`, and `send_loser_to_creative_lab`
recommendations:

```ts
type LoserHandlingPlan = {
  targetVariant: "control" | "challenger";
  currentSpend: number;
  currentRoas: number;
  suggestedAction: "pause_review" | "reduce_budget" | "send_to_lab";
  actionRationale: string;
  safeguards: string[];
  briefLabLink: string | null;
};
```

Action selection:
- ROAS < 1.0 **and** spend ≥ `minSpendPerVariant` → `pause_review`
- spend ≥ `minSpendPerVariant` → `reduce_budget`
- otherwise → `send_to_lab`

---

## Follow-Up Experiment Plan Structure

Attached to `launch_follow_up_experiment` and `duplicate_winner_to_new_test`:

```ts
type FollowUpExperimentPlan = {
  suggestedDirection: string;
  suggestedBriefIntent: string;
  suggestedDraftType: string;
  controlVariantChoice: "keep_current_winner" | "use_challenger" | "start_fresh";
  rationale: string;
};
```

---

## Connecting to Approvals and Automation

When an operator clicks **Approve Action** on a recommendation:

1. `POST /api/experiments/[id]/actions` is called with `{ recommendationId }`.
2. The API recomputes recommendations server-side and verifies the recommendation is still
   valid and its readiness allows approval.
3. A `ProposedAutomationActionDraft` is built from the recommendation and passed to
   `upsertProposedActions()` in `lib/automation/persist.ts`.
4. The proposal enters the existing **automation approval workflow** — operators must approve
   it there before any campaign change executes.
5. Informational actions (`monitor_only`, `keep_winner_running`) return early with a note —
   no automation proposal is created.

**No campaign mutation happens at approval time.** Approval only queues a proposal.

Deduplication key: `${experimentId}:${automationActionType}:${entityId}` — re-approving the
same action upserts rather than duplicates.

Proposals expire after 7 days.

---

## UI Entry Points

| Location | Description |
|---|---|
| `/experiments/actions` | Standalone page listing all completed experiments with their action recommendations, sorted by top priority |
| Experiment detail panel | `OutcomeActionsPanel` embedded in `ExperimentResultDetail`, loaded client-side via `GET /api/experiments/[id]/actions` |

---

## Architecture Summary

```
lib/outcomeActions/
  recommender.ts    — pure computation: priority, readiness, blockers, recommendation set
  plans.ts          — pure builders: ScalePlan, LoserHandlingPlan, FollowUpExperimentPlan
  index.ts          — public re-exports

types/
  outcomeActions.ts — all types, action type/priority/readiness constants and label maps

app/api/experiments/[id]/actions/route.ts
                    — GET: compute + return; POST: approve → upsertProposedActions()

app/experiments/
  OutcomeActionsPanel.tsx     — "use client" component with approve flow
  actions/page.tsx            — server component, all-experiments action dashboard
  ExperimentResultDetail.tsx  — loads recommendations client-side, renders OutcomeActionsPanel
```

---

## Current Limitations

- Recommendations are recomputed on every request — no caching or persistence.
- Scale multipliers are heuristic (confidence-tier-based), not computed from spend curves or
  historical scaling data.
- Campaign state (current budget, delivery status) is not yet pulled from Meta at recommendation
  time — the recommender works from experiment snapshot data only.
- `ready_for_execution` readiness state is defined but not yet used — autonomous execution
  is out of scope for this phase.
- Client safety restrictions (per-account budget caps, dayparting rules) are not yet wired
  into blocker computation.
- Recommendation history is not stored — approving and then revisiting the page regenerates
  fresh recommendations without memory of prior approvals.
