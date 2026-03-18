# Automation Rules and Approval Workflow

## What it is

The Automation page (`/automation`) evaluates deterministic rules against existing
system state and proposes actionable recommendations. These are **proposals only** —
approval does not yet write back to Meta or execute any external action.

Detection runs every time the page loads (server-side). Results are persisted so the
Operations page can show the top proposed actions without re-running evaluation.

---

## Action types

| Action Type | Description |
|---|---|
| `pause_campaign` | Propose pausing a campaign (not yet wired to Meta) |
| `reduce_budget` | Recommend reducing campaign budget to limit losses |
| `increase_budget` | Recommend increasing budget for a high-performing campaign |
| `review_creative` | Flag a campaign for creative review (fatigue signal) |
| `refresh_creative` | Propose generating new creative variants |
| `run_sync` | Prompt user to trigger a Meta data sync |
| `investigate_client` | Flag a client for general investigation |
| `set_goals` | Campaign has spend but no ROAS/CPA goals — configure goals first |
| `review_pacing` | Client is materially over- or under-pacing their monthly budget |

## Action status flow

```
proposed → approved | rejected
approved → executed | expired
```

- **proposed**: freshly created by rule evaluation, awaiting review
- **approved**: user clicked "Approve" — intent confirmed, not yet executed
- **rejected**: user clicked "Reject" — dismissed
- **executed**: (future) action was carried out
- **expired**: action is no longer relevant (past its expiry date)

**Note:** In v1, approval has no side effects. It records the decision for
audit purposes. Meta write-back will be added in a future phase.

---

## Built-in rules (v1)

| Rule function | Trigger | Action Type | Priority |
|---|---|---|---|
| `evaluateReduceBudgetRule` | ROAS < goal × 0.60 + spend ≥ $200/wk | `reduce_budget` | high |
| `evaluateIncreaseBudgetRule` | ROAS > goal × 1.40 + spend < $2000/wk | `increase_budget` | medium |
| `evaluateRunSyncRule` | No sync or last sync >48h ago, or failed | `run_sync` | medium/high |
| `evaluateMissingIntegrationRule` | No Meta or no Shopify connection | `investigate_client` | high |
| `evaluateWeakRoasRule` | Reconciled ROAS < 1.0 (losing money) | `investigate_client` | high |
| `evaluateCreativeFatigueRule` | Spend +30% but orders −20% vs prior 7d | `review_creative` | medium |
| `evaluateSetGoalsRule` | Campaign has spend but no ROAS/CPA goal | `set_goals` | medium |
| `evaluateReviewPacingRule` | Client over- or under-pacing > 10% this month | `review_pacing` | medium/high |

---

## Deduplication

Each proposed action has a `deduplicationKey = "{clientId}:{actionType}:{entityId}"`.

On each evaluation run:
- If a **proposed** action with the same key already exists → skip (no duplicate)
- If the key is not currently in **proposed** status → create a new proposal

This means:
- A rejected action will re-appear if the triggering condition persists
- An approved action will not be duplicated while still in `approved` status

---

## Architecture

```
lib/automation/
  types.ts    — AutomationActionType (9 types), AutomationActionStatus (5),
                AutomationPriority, ProposedAutomationActionDraft,
                ProposedAutomationActionRow, AutomationSummary
  rules.ts    — evaluateReduceBudgetRule(), evaluateIncreaseBudgetRule(),
                evaluateRunSyncRule(), evaluateMissingIntegrationRule(),
                evaluateWeakRoasRule(), evaluateCreativeFatigueRule(),
                evaluateSetGoalsRule(), evaluateReviewPacingRule(),
                evaluateAutomationRules() (pure, runs all except pacing),
                buildProposedAutomationActions() (async, runs ALL rules incl. pacing),
                loadDetectionInput() (re-exported from alerts/detectors)
  persist.ts  — upsertProposedActions(), loadProposedActions(),
                loadTopProposedActions(), approveAutomationAction(),
                rejectAutomationAction(), buildAutomationSummary()
                  (= summarizeAutomationQueue())
  index.ts    — public re-exports

app/automation/
  page.tsx           — server component: runs evaluation → upserts → loads → renders
  AutomationView.tsx — client component: filters (client, action type, priority, status),
                       action cards, approve/reject actions

app/api/automation/[actionId]/
  approve/route.ts
  reject/route.ts

app/operations/
  page.tsx           — also loads loadTopProposedActions(workspaceId, 5)
  OperationsView.tsx — TopProposedActionsSection shows high-priority proposed actions

prisma/
  schema.prisma                     — AutomationRule + ProposedAutomationAction models
  migrations/add_automation.sql     — SQL to apply manually in Neon console
```

---

## Prisma models

### AutomationRule

Named rule definitions (v1: built-in rule types only).

| Field | Type | Notes |
|---|---|---|
| `id` | String | cuid |
| `workspaceId` | String? | nullable |
| `name` | String | human-readable name |
| `description` | String | what the rule detects |
| `ruleType` | String | rule type identifier |
| `isActive` | Boolean | default true |
| `priority` | String | low \| medium \| high |
| `conditions` | String | JSON condition parameters |

### ProposedAutomationAction

| Field | Type | Notes |
|---|---|---|
| `id` | String | cuid |
| `workspaceId` | String? | nullable |
| `clientAccountId` | String | FK → ClientAccount |
| `actionType` | String | see action types table |
| `status` | String | proposed \| approved \| rejected \| executed \| expired |
| `priority` | String | low \| medium \| high |
| `entityType` | String | campaign \| client \| integration |
| `entityId` | String | campaign ID or client ID |
| `entityName` | String | human-readable name |
| `rationale` | String | explanation shown to user |
| `supportingData` | String | JSON metrics that triggered the rule |
| `deduplicationKey` | String | `{clientId}:{actionType}:{entityId}` |
| `proposedAt` | DateTime | when proposed |
| `expiresAt` | DateTime? | optional expiry |
| `approvedAt` | DateTime? | set on approval |
| `rejectedAt` | DateTime? | set on rejection |
| `rejectionReason` | String? | optional user note |

---

## Current limitations (v1)

- **No Meta write-back.** Approval records the decision but does not execute
  anything. Budget changes, campaign pauses, and creative refreshes must be
  done manually in Meta Ads Manager.
- **No scheduled evaluation.** Rules are evaluated only when the Automation
  page is loaded. A cron route can be added to evaluate on a schedule.
- **No user-defined rules.** All rules are hard-coded in `lib/automation/rules.ts`.
  A rule builder UI is a future phase.
- **No email/Slack delivery.** Approved actions are in-app only.

---

## Extending for Meta write-back (next phase)

To add actual execution of approved actions:

1. Query `ProposedAutomationAction` where `status = "approved"`
2. For each action, call the appropriate Meta API endpoint:
   - `reduce_budget` / `increase_budget` → `PATCH /campaigns/{id}` with new `daily_budget`
   - `pause_campaign` → `PATCH /campaigns/{id}` with `status: PAUSED`
3. Update `status` to `"executed"` on success
4. Handle errors and set status to `"failed"` (add `failedAt`, `errorMessage` fields)

No changes to `rules.ts` or `persist.ts` are required — only a new execution layer.
