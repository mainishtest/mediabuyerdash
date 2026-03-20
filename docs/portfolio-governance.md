# Portfolio Governance Layer — Setup & Reference

## Overview

The Portfolio Governance layer (`/portfolio/governance`) is a cross-account decision support tool.
It surfaces **ranked opportunities**, **ranked risks**, and **budget governance guidance** across
all active client accounts.

**This layer does not perform automated budget reallocation.** No capital is moved silently.
All guidance is advisory and requires explicit operator review before any action is taken.

---

## How Opportunity and Risk Are Ranked

### Priority Score (0–100)

Each opportunity and risk receives a composite priority score with four components:

| Component | Max Points | What It Measures |
|---|---|---|
| `riskWeight` | 40 | Severity of governance state, goal miss, or pacing risk |
| `opportunityWeight` | 30 | Strength of upside signal (experiment winner, ROAS above goal, etc.) |
| `urgencyBonus` | 20 | Time pressure: overdue approvals, critical pacing, emergency stops |
| `confidencePenalty` | −10 | Deducted for stale data, missing goals, or sparse activity |

**Score → Tier mapping:**

| Score | Tier |
|---|---|
| 75–100 | Critical |
| 50–74 | High |
| 25–49 | Medium |
| 0–24 | Low |

### Opportunity Categories

| Category | Description |
|---|---|
| `winning_experiment_expansion` | Experiment has a declared winner ready to deploy or scale |
| `account_scaling_candidate` | Strong ROAS + under-budget — eligible for budget increase consideration |
| `creative_refresh_opportunity` | Approved creative variants ready to launch to Meta |
| `goal_outperformance` | Account significantly exceeding ROAS or CPA goals |
| `strong_launch_candidate` | Auto-execution enabled, performance near or above goal |

### Risk Categories

| Category | Description |
|---|---|
| `governance_blocker` | Emergency stop or restricted mode is active |
| `goal_risk` | ROAS is significantly (>30%) below target |
| `pacing_risk` | Spend is critically over or under the expected monthly rate |
| `approval_bottleneck` | Pending approval is overdue (>48 hours) |
| `automation_restriction` | Automation policy is in restricted mode |
| `performance_decline` | Multiple high-severity alerts indicate systemic issues |
| `fatigue_risk` | Stale data sync — creative and performance signals may be outdated |

---

## What Priority Score Means

The priority score answers: **"Where should an operator focus attention first?"**

- A **critical** score means: immediate review is warranted — a governance blocker, severe goal
  miss, or major opportunity is present.
- A **high** score means: act within the current work session.
- A **medium** score means: review during normal workflow.
- A **low** score means: monitor; no urgent action needed.

The score is **explainable** — each item shows `supportingReasons` that describe exactly which
signals contributed to the score. The `explainPortfolioPriority()` function produces a
human-readable summary of each score's components.

---

## How Governance Guidance Should Be Used

1. **Review ranked risks first** — Critical and high-priority risks represent active blockers or
   goal misses that need immediate operator attention.

2. **Review ranked opportunities second** — Items marked `ready` have no active blockers and can
   be acted on. Items marked `needs_review` or `blocked` require resolving a prerequisite first.

3. **Review budget governance summaries** — Budget recommendations (`increase_candidate`, `hold`,
   `reduce_candidate`, etc.) are advisory labels based on pacing + goal performance. They do
   not automatically change any budgets.

4. **Use action buttons to navigate** — Each item has direct links to the relevant workflow:
   Command Center, Approval Queue, Governance Controls, Experiment view, Creative Lab.

5. **Resolve blockers before acting** — If an item shows blockers (emergency stop, stale sync,
   missing goals), resolve those first. The governance layer surfaces what is preventing action.

---

## How This Differs From Automated Reallocation

| This layer | Automated reallocation (not present) |
|---|---|
| Surfaces ranked signals | Moves budget between accounts silently |
| Provides advisory budget labels | Issues direct API calls to adjust spend |
| Requires operator action for any change | Executes changes without review |
| Links to existing approval workflows | Bypasses approval workflows |
| Scores are visible and explainable | Allocation is opaque |

The governance layer prepares operators to make informed decisions. It does not execute those
decisions. Budget increases, pauses, or reductions must go through the normal automation approval
flow or be applied manually via the platform.

---

## Data Sources

- **ROAS and CPA**: CRM (Shopify) is the source of truth, with a 7-day attribution window.
- **Spend and delivery**: Meta (Facebook) is used for delivery analysis.
- **Pacing**: Computed from `BudgetPacingTarget` against UTM spend rows.
- **Experiment signals**: From `ExperimentRecord` and `ExperimentResultRecord`.
- **Creative signals**: From `PublishPrepRecord` (items awaiting launch).
- **Approval signals**: From `ProposedAutomationAction` (status: proposed).
- **Governance state**: From `GovernanceStop` and `ActionSafetyPolicy`.
- **Sync health**: From `ClientSyncRun` (most recent completed run per client).

---

## Architecture Notes

The governance layer is implemented in `lib/portfolioGovernance/`:

```
lib/portfolioGovernance/
  types.ts          — all typed models (pure)
  scoring.ts        — priority scoring and display helpers (pure)
  opportunities.ts  — buildPortfolioOpportunities()
  risks.ts          — buildPortfolioRisks()
  budgetGovernance.ts — buildPortfolioBudgetGovernanceItems()
  aggregator.ts     — summarizePortfolioGovernance() (entry point)
```

The aggregator accepts `PortfolioPayload` as input — it does **not** make additional DB calls.
It layers on top of `buildPortfolioPayload()` without duplicating queries.

---

## Current Limitations

- **No ad account level granularity** — signals are currently aggregated at the client level.
  Ad account level breakdown will be added in a future step.
- **Experiment signals are limited** — only completed experiments with declared winners are
  surfaced. In-progress experiments are not ranked.
- **Creative fatigue scoring** — the current layer detects stale sync as a fatigue proxy.
  Direct creative fatigue scores from `lib/creativeFatigue` will be integrated in a future step.
- **Budget governance does not use monthly budget amounts** — the `monthlyBudget` field in
  `PortfolioBudgetGovernanceItem` is `null` until a direct query or join is added. Pacing
  percentages are used as a proxy.
- **Confidence scoring is conservative** — items with stale data or missing goals are downgraded
  in confidence. This is intentional to avoid false high-priority signals.

---

## Next Steps

The next phase will add:
- Portfolio approval, automation status, and governance control board
- Ad account level risk and opportunity granularity
- Direct creative fatigue signal integration
- Experiment-level priority scoring
