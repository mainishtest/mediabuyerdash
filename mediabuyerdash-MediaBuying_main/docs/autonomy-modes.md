# Autonomy Modes & Action Safety Policy

## Overview

The Action Safety Policy layer defines exactly what the system is allowed to do,
where it is allowed to do it, and under what safety conditions. It is the central
governance model that every automated, recommended, and approved action passes through.

---

## Autonomy Modes

An **autonomy mode** defines the ceiling of what the system can do within a scope.
Modes are assigned per scope (client, ad account, or campaign) and inherit from
more general scopes when no specific policy is set.

| Mode | What it means |
|---|---|
| `restricted` | No automated activity. All actions are blocked. Manual-only operation. |
| `recommend_only` | System surfaces recommendations in the UI. No proposals or executions occur. |
| `prepare_only` | System may draft and prepare actions but cannot formally propose them for approval. |
| `approval_required` | System proposes actions. A human must approve each one before any execution. **This is the system default.** |
| `guarded_auto_execute` | Eligible low-risk actions may execute automatically under guardrails. High-risk actions still require approval. |

### Choosing a mode

- Start with `approval_required` (the default) for all new clients.
- Upgrade to `guarded_auto_execute` only after the approval workflow has built trust for a client.
- Use `restricted` for paused clients or clients under review.
- `recommend_only` is appropriate when the system is still learning a client's patterns.

---

## Action Types

Every automated action the system can take maps to one of these governance types:

| Action Type | Risk | Auto-Execute Eligible |
|---|---|---|
| `budget_increase` | High | Never |
| `budget_decrease` | Medium | Yes (with guardrails) |
| `pause_entity` | Medium | Yes (with 24h cooldown + spend floor) |
| `unpause_entity` | High | Never |
| `publish_creative` | High | Never |
| `duplicate_winner` | High | Never |
| `launch_experiment` | High | Never |
| `apply_schedule_change` | Medium | Never |
| `refresh_creative_candidate` | Low | Yes |
| `send_to_creative_lab` | Low | Yes |

### Why some actions never auto-execute

Actions in the "Never" category involve irreversible or high-visibility changes:
- **`budget_increase`** — increasing spend cannot be taken back within a billing cycle.
- **`publish_creative`** — live creative changes must be human-reviewed.
- **`launch_experiment`** — A/B tests require intentional design.
- **`duplicate_winner`** — clones ad structure + spend commitments.

---

## Policy Inheritance

Policies are resolved in specificity order:

```
Campaign Override → Ad Account Policy → Client Policy → System Default
```

**Rules:**

1. **Most specific scope provides the effective mode.** If a campaign has its own policy,
   that mode governs — not the client-level mode.

2. **Blocking is additive.** If a client policy blocks `publish_creative`, a campaign-level
   policy cannot un-block it. Any scope that blocks an action makes it blocked.

3. **System default applies when no explicit policy exists.** The system default is
   `approval_required` with `publish_creative` and `launch_experiment` explicitly blocked.

### Example

```
Client A:   approval_required
  └─ Campaign X:  guarded_auto_execute  ← wins for Campaign X
  └─ Campaign Y:  (no override)         ← inherits approval_required from Client A
```

---

## Effective Permission Resolution

For a given `(context, actionType)` pair:

1. Load all active policies for the scope chain (campaign → ad_account → client).
2. Check if `actionType` is in `blockedActionTypes` at any scope → **blocked**.
3. Check if any scope has `autonomyMode = restricted` → **blocked**.
4. Use the most specific active policy for permission resolution:
   - If in `approvalRequired` → `approval_required`
   - If in `allowedActionTypes` + mode is `guarded_auto_execute` + action is auto-eligible → `guarded_auto_execute`
   - If mode is `approval_required` (default) → `approval_required`
5. Fall back to system default if no explicit policy found.

---

## How This Links to Approvals and Execution

The `evaluateActionSafetyPolicy()` function is the single entry point used across all workflow modules:

| Module | How it uses policy evaluation |
|---|---|
| Recommendation engine | Checks if action type is at least `approval_required` before surfacing |
| AI Assistant suggestions | Checks permission before including in action suggestions |
| Approval workflow | Uses `requiresApproval` flag to determine if human sign-off is needed |
| Guarded auto-execution | Uses `eligibleForAutoExecution` flag as the first gate; existing guardrails run after |
| Publish preparation | Checks if `publish_creative` is permitted before allowing publish prep to proceed |
| Outcome action routing | Determines which actions to include in outcome recommendations |

---

## Constraints

In addition to the mode and permission lists, policies can carry `ActionConstraint` objects
that add numerical limits to permitted actions:

```ts
interface ActionConstraint {
  field:       string;   // e.g. "max_decrease_pct"
  operator:    "lte" | "gte" | "eq" | "neq" | "in" | "not_in";
  value:       unknown;  // threshold value
  description: string;   // human-readable explanation shown in UI
}
```

Constraints from all scope levels are collected (additive). They are surfaced in the UI
and passed to the recommendation engine and execution guardrails as additional context.

### Built-in default constraints

- `budget_decrease`: max 30% decrease per action; campaign must have spent ≥ $200.
- `pause_entity`: 24-hour cooldown between pause actions on the same entity; spend ≥ $200.

---

## Conflict Resolution

| Conflict | Resolution |
|---|---|
| Both client and campaign policies exist | Campaign wins (more specific) |
| Action in both `allowed` and `blocked` | `blocked` wins (safe defaults to most restrictive) |
| Scope policy is inactive (`isActive: false`) | Treated as absent; next scope in chain applies |
| Missing scope record | Transparent fallthrough to system default |
| Invalid autonomyMode value | API rejects the write; existing policy unchanged |
| `guarded_auto_execute` mode but action is in `NEVER_AUTO_EXECUTE` | Permission returned as `approval_required` |

---

## Current Limitations

1. **Ad account and campaign policies are not yet configurable from the UI.** The policy
   evaluation engine fully supports them, but the UI currently only exposes client-level
   mode selection. Campaign/ad account overrides can be set via the API (`PUT /api/policies/campaign/:id`).

2. **Policy evaluation does not yet feed back into approval routing.** The `requiresApproval`
   flag is computed but the approval workflow (`lib/automation/`) does not yet read it.
   This is the planned next step (approval routing & override layer).

3. **`publish_creative` and `launch_experiment` remain explicitly blocked** at the system
   default level. Clients must have an explicit policy record that removes them from
   `blockedActionTypes` to unlock these action types.

4. **No emergency stop controls in this step.** Emergency stop (workspace-wide kill switch)
   is planned for the next phase.

5. **No full audit log UX.** Policy change history is stored in the DB via `updatedAt` but
   a dedicated audit history page is out of scope for this step.

---

## API Reference

### GET `/api/policies`
Returns all active policies for the current workspace.

### GET `/api/policies/:scope/:scopeId`
Returns the policy record and full permission summary for a specific scope.
`scope` must be `client`, `ad_account`, or `campaign`.
Falls back to system default if no explicit record exists.

### PUT `/api/policies/:scope/:scopeId`
Create or update the policy record for the given scope.

```json
{
  "autonomyMode": "approval_required",
  "allowedActionTypes": [],
  "blockedActionTypes": ["publish_creative"],
  "approvalRequired": ["budget_increase", "budget_decrease"],
  "constraints": [],
  "notes": "Optional human note"
}
```
