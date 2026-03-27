# Governance Controls: Approval Routing, Overrides, and Emergency Stops

## Overview

The governance layer sits above the action safety policy layer and adds runtime
operator controls. It answers:

- **Who must approve what?** — approval routing
- **How can operators intervene right now?** — emergency stops and overrides
- **How are exceptions handled?** — defer, escalate, override_block
- **How is automation paused or stopped quickly?** — emergency stop with scope

All governance actions are explicit, scoped, require a reason, and create a
traceable record.

---

## Approval Routing

`buildApprovalRoute(actionId, actionType, context)` is the single entry point
for determining how to route any proposed action.

### Resolution order

```
1. Active emergency stops covering this action/scope → "blocked"
2. Policy evaluation (evaluateActionSafetyPolicy)
   → blocked/restricted → "blocked"
3. Active pause_scope or require_approval_all override on scope → "standard_review"
4. Action-specific escalation override → "elevated_review"
5. Action-specific defer override → "standard_review" (but surfaced as deferred)
6. Policy = guarded_auto_execute AND no active stops/overrides → "auto_approve"
7. Otherwise → "standard_review"
```

### Route types

| Route | Meaning |
|---|---|
| `auto_approve` | No human review needed; eligible for guarded auto-execution |
| `standard_review` | Normal operator review; approve or reject in the queue |
| `elevated_review` | Escalated; requires senior review; cannot auto-approve |
| `blocked` | Cannot be approved; policy or stop blocks the action |

---

## Emergency Stops

An emergency stop is a scoped record that immediately blocks guarded auto-execution
and surfaces as a governance flag in the approval routing layer.

### Scopes

| Scope | What it stops |
|---|---|
| `global` | All auto-execution workspace-wide |
| `client` | All auto-execution for a specific client |
| `ad_account` | All auto-execution for a specific ad account |
| `campaign` | All auto-execution for a specific campaign |
| `action_type` | All auto-execution of a specific action type (e.g. `pause_campaign`) |

### Behaviour

- Stops are **always explicit** — operators must provide a reason.
- Stops are **always explicitly cleared** — no automatic expiry (optional `expiresAt` supported).
- Stops **stack** — multiple stops can be active for the same scope; each must be cleared individually.
- The `governance_stop` guardrail in `lib/autoExecution/eligibility.ts` checks for active stops as **guardrail #0**, before any other check.
- Clearing a stop does not re-run pending actions; operators must trigger execution manually.

### API

```
POST   /api/governance/stops            → create stop
GET    /api/governance/stops            → list active stops
DELETE /api/governance/stops/:stopId    → clear stop
```

### Example: pause all auto-execution

```json
POST /api/governance/stops
{
  "scope":   "global",
  "scopeId": "global",
  "reason":  "Investigating ROAS anomaly across all clients"
}
```

---

## Overrides

An override is an explicit operator instruction that modifies the normal routing
or execution behaviour for a scope or specific action.

### Override types

| Type | What it does |
|---|---|
| `pause_scope` | Stops all auto-execution in the scope (similar to stop but surfaced differently) |
| `require_approval_all` | Forces approval for all actions in scope, even in guarded_auto_execute mode |
| `defer_action` | Defers a specific action (sets status=deferred, creates linked record) |
| `override_block` | Override a policy block (high-risk; requires explicit reason) |
| `resume_scope` | Explicitly resume a paused scope (creates an "all clear" record) |

### Behaviour

- Overrides are scoped to `(scope, scopeId)` or a specific `actionId`.
- Overrides stack — multiple overrides can be active; each cleared individually.
- `override_block` should only be used deliberately; it is flagged clearly in the approval route.
- Overrides surface as `GovernanceFlag` objects in `ApprovalRoute.governanceFlags`.

### API

```
POST   /api/governance/overrides                → create override
GET    /api/governance/overrides                → list active overrides
DELETE /api/governance/overrides/:overrideId    → clear override
```

---

## Defer and Escalate

Defer and escalate are action-level governance operations available for any
`proposed` action in the approval queue.

### Defer

Sets `status = "deferred"` on the action and creates a linked `AutomationOverride`
record (`overrideType = "defer_action"`). Deferred actions:
- Remain in the governance queue under the "Deferred" section
- Can be approved, rejected, or escalated at any time
- Are not automatically re-proposed (the action stays in deferred state)

```
POST /api/automation/:actionId/defer
{ "reason": "Waiting for client confirmation", "deferUntil": "2026-03-25T00:00:00Z" }
```

### Escalate

Sets `status = "escalated"` on the action and creates a linked `AutomationOverride`
record (`overrideType = "require_approval_all"`). Escalated actions:
- Surface in the "Escalated" section at the top of the governance queue
- Route type becomes `elevated_review`
- Cannot be auto-approved
- Require explicit approve or reject

```
POST /api/automation/:actionId/escalate
{ "escalationNote": "ROAS drop >50% — needs senior review before pausing" }
```

---

## Governance Summary

`summarizeGovernanceControls(workspaceId)` returns a workspace-level overview:

```ts
{
  automationPaused:   boolean,  // true if global stop active
  activeStopCount:    number,
  activeOverrideCount: number,
  pendingEscalations: number,
  pendingApprovals:   number,
  deferredActions:    number,
  activeStops:        EmergencyStopState[],
  activeOverrides:    AutomationOverrideRecord[],
}
```

Used by the governance UI, command center widget, and AI assistant context.

---

## Integration points

| Module | Integration |
|---|---|
| `lib/autoExecution/eligibility.ts` | `governance_stop` guardrail #0 blocks execution if any stop is active |
| `lib/governance/routing.ts` | Wraps `evaluateActionSafetyPolicy()` with governance state |
| Approval workflow (`/automation`) | `deferred` and `escalated` statuses surfaced in UI |
| Governance UI (`/automation/governance`) | Full management of stops, overrides, and approval queue |
| Command center | Can surface `GovernanceControlSummary.automationPaused` as status indicator |

---

## Supported scopes summary

| Scope | Where used | ScopeId value |
|---|---|---|
| `global` | Stops, Overrides | `"global"` |
| `client` | Stops, Overrides | `clientAccountId` |
| `ad_account` | Stops, Overrides | `externalAdAccountId` |
| `campaign` | Stops, Overrides | `externalCampaignId` |
| `action_type` | Stops | action type string (e.g. `"pause_campaign"`) |

---

## Current limitations

1. **No reviewer assignment.** The routing layer determines route type but does not yet
   assign specific reviewers. Planned for the next step (audit log + role-based routing).

2. **No push notifications on escalation.** Escalated actions are visible in the
   governance UI but do not yet trigger email notifications. The notification system
   can be extended to watch for `status = "escalated"`.

3. **override_block is not validated against NEVER_AUTO_EXECUTE.** The API accepts
   any `override_block` with a reason. A future step should add a check against the
   `NEVER_AUTO_EXECUTE` set from `lib/policy/defaults.ts`.

4. **No expiry auto-cleanup.** Stops and overrides with `expiresAt` in the past are
   excluded from queries but not removed from the DB. A cron job can clean them up.

5. **Governance stop guardrail only covers guarded auto-execution.** Manual approval
   and execution of actions via the UI is not blocked by governance stops — only the
   automated execution path is blocked. This is intentional.

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/governance/stops` | List active stops |
| POST | `/api/governance/stops` | Create emergency stop |
| DELETE | `/api/governance/stops/:id` | Clear stop |
| GET | `/api/governance/overrides` | List active overrides |
| POST | `/api/governance/overrides` | Apply override |
| DELETE | `/api/governance/overrides/:id` | Clear override |
| GET | `/api/governance/summary` | Workspace governance summary |
| POST | `/api/automation/:id/defer` | Defer action |
| POST | `/api/automation/:id/escalate` | Escalate action |
