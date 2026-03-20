# Automation Audit Log, Execution History & Rollback Readiness

Phase 6 — Safety Modes, Controlled Delegation, and Automation Governance

---

## What this layer provides

A unified, human-inspectable audit trail that covers every step in the automation lifecycle:
- What the system **recommended**
- What was **prepared** or **proposed**
- What entered the **approval queue**
- What was **approved, rejected, or deferred**
- What was **blocked** by policy, governance, or guardrails
- What was **executed** (success or failure)
- What the **rollback readiness state** is for every event

---

## What events are recorded

Every `AutomationAuditLog` row has one of these event types:

| Event type              | When it occurs |
|-------------------------|----------------|
| `recommended`           | Rule engine surfaced a recommendation |
| `prepared`              | System drafted an action (prepare_only mode) |
| `approval_requested`    | Action entered the governance approval queue |
| `approved`              | Operator explicitly approved the action |
| `rejected`              | Operator explicitly rejected the action |
| `deferred`              | Operator deferred the action to a later time |
| `blocked`               | Policy, governance stop, guardrail, or safety mode prevented the action |
| `execution_started`     | Auto-execution attempt began |
| `execution_succeeded`   | Auto-execution completed successfully |
| `execution_failed`      | Auto-execution failed with an error |
| `rollback_ready`        | A rollback snapshot is available |
| `rollback_not_available` | No rollback path exists for this action |
| `emergency_stopped`     | An emergency stop was applied to the action's scope |

---

## How execution history is stored

New audit entries are written to the `AutomationAuditLog` table via `lib/auditLog/persist.ts`.

The history page (`/automation/history`) merges **three data sources**:

1. **Native** `AutomationAuditLog` rows — written by `recordAutomationExecution()`, `recordAutomationApproval()`, and `recordAutomationBlock()`.
2. **Bridged** `AutoExecutionLog` rows — existing guarded-executor log entries synthesised into audit entry shape.
3. **Bridged** `ProposedAutomationAction` rows — action lifecycle events (approved, rejected, deferred, escalated, executed) synthesised from status fields.

Bridged entries are marked `source: "bridged_*"` and displayed with a `legacy` badge. They provide immediate coverage of all historical automation activity before the new audit table is populated.

---

## What rollback readiness means

Each audit entry carries a `rollback` field with one of three states:

| State                        | Meaning |
|------------------------------|---------|
| `rollback_available`         | A rollback action is prepared and ready to apply |
| `rollback_unavailable`       | No rollback path exists (idempotent actions, failed executions, unexecuted actions) |
| `rollback_requires_review`   | A rollback path exists but requires human review and a new approval cycle |

### Current rollback states by action type

| Action type       | After success                  | Notes |
|-------------------|-------------------------------|-------|
| `pause_campaign`  | `rollback_requires_review`    | Rollback = unpause. Requires new approved action. Does NOT auto-unpause. |
| `run_sync`        | `rollback_unavailable`        | Sync is idempotent. Re-run is the corrective action. |
| `reduce_budget`   | `rollback_requires_review`    | Requires new `increase_budget` action with approval. |
| `increase_budget` | `rollback_requires_review`    | Requires new `reduce_budget` action with approval. |
| Any blocked/failed | `rollback_unavailable`       | Nothing was executed; nothing to roll back. |

**Important:** This phase provides rollback *visibility* only. There is no automatic rollback execution. An operator must create and approve an opposing action to reverse any executed change.

---

## How to write new audit entries

Use the high-level helpers in `lib/auditLog`:

```typescript
import { recordAutomationExecution, recordAutomationApproval, recordAutomationBlock } from "@/lib/auditLog";

// After an execution
await recordAutomationExecution({
  workspaceId,
  clientAccountId,
  clientName,
  actionId:         "proposed_action_id",
  actionType:       "pause_campaign",
  scope:            { entityType: "campaign", entityId: "...", entityName: "My Campaign" },
  executionLogId:   "auto_exec_log_id",
  status:           "success",
  durationMs:       340,
  errorMessage:     null,
  guardrailResults: [...],
  decisionReason:   "All guardrails passed",
});

// After an approval decision
await recordAutomationApproval({
  workspaceId,
  clientAccountId,
  clientName,
  actionId:   "proposed_action_id",
  actionType: "pause_campaign",
  scope:      { entityType: "campaign", entityId: "...", entityName: "My Campaign" },
  decision:   "approved",
  decidedBy:  userId,
  reason:     null,
  routeType:  "standard_review",
});

// After a block
await recordAutomationBlock({
  workspaceId,
  clientAccountId,
  clientName,
  actionId:     "proposed_action_id",
  actionType:   "pause_campaign",
  scope:        { entityType: "campaign", entityId: "...", entityName: "My Campaign" },
  source:       "governance_stop",
  reason:       "Emergency stop is active for this client",
  policyReason: "explicit_block",
});
```

For custom entries, use `writeAuditEntry()` directly with a `BuildAuditEntryInput`.

---

## Database setup

The `AutomationAuditLog` table requires a migration:

```bash
# Add the table to your database
npx prisma migrate dev --name add_automation_audit_log

# Or in production
npx prisma migrate deploy
```

Until the migration runs, the history page degrades gracefully — native entries return empty and the bridged entries (from existing tables) remain fully functional.

---

## How this supports governance and operational trust

| Feature                           | How it helps |
|-----------------------------------|--------------|
| Every block recorded with source  | Operators can see exactly why an action was prevented |
| Policy decision on every entry    | Links each event to the `ActionSafetyPolicy` that governed it |
| `relatedActionId` links           | Every audit entry traces back to the `ProposedAutomationAction` |
| `relatedExecutionLogId` links     | Every execution event traces back to `AutoExecutionLog` |
| Rollback preview                  | Operators know before acting what reverting an action means |
| Emergency stop events             | Stop activations are recorded as `emergency_stopped` entries |
| Bridged historical data           | All past automation activity is visible immediately — no gaps |

---

## Current limitations

1. **No automatic rollback** — rollback is visibility-only. Full rollback orchestration is planned for the next phase (portfolio-level governance).
2. **No execution-initiated writes yet** — the executor (`lib/autoExecution/executor.ts`) does not yet call `recordAutomationExecution()`. Execution history is currently bridged from `AutoExecutionLog`. Adding native writes requires a one-line call in the executor after each log entry.
3. **No approval-initiated writes yet** — approval API routes do not yet call `recordAutomationApproval()`. Approval events are bridged from `ProposedAutomationAction` status.
4. **Legacy records lack full trace** — bridged entries do not carry guardrail details, policy decisions, or actor user IDs from the original source tables.
5. **Client-side filtering** — the history page loads up to 120 entries server-side and filters in JS. For high-volume workspaces, server-side pagination should be added.

---

## Architecture decisions

- `lib/auditLog/types.ts` — pure TypeScript types, no runtime code
- `lib/auditLog/builders.ts` — pure functions, no DB dependency, fully testable
- `lib/auditLog/persist.ts` — all DB I/O + bridge synthesis, separated from business logic
- `lib/auditLog/index.ts` — single public export surface
- Rollback readiness is computed from event state, not stored as a separate workflow
- JSON blobs for nested objects follow the established pattern in `AutoExecutionLog.guardrailJson` and `AutomationOverride.metadata`
