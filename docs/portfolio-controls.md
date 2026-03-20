# Portfolio Control Board — Setup & Reference

## What the Portfolio Control Board Is For

The Portfolio Control Board (`/portfolio/controls`) gives operators a single, centralized view of:

- **Approval queue state** — all pending, deferred, and escalated automation actions across all
  client accounts, with aging classification
- **Automation state** — per-account automation readiness, autonomy mode, auto-execution
  settings, and emergency stop status
- **Governance controls** — active emergency stops and overrides, with scope and reason
- **Governance blockers** — accounts that require operator intervention before automation can
  function normally

This board is a **visibility and control surface**. It does not introduce new optimization logic,
perform autonomous mutations, or move budget. All actions surface to existing approval and
governance API endpoints.

---

## What Data Feeds It

The control board is assembled by `buildPortfolioControlsPayload()` in
`lib/portfolioControls/aggregator.ts`, which runs parallel Prisma queries for:

| Data | Source |
|---|---|
| Client accounts | `ClientAccount` (status: active) |
| Actionable approvals | `ProposedAutomationAction` (status: proposed, deferred, escalated) |
| Emergency stops | `GovernanceStop` (isActive: true) |
| Active overrides | `AutomationOverride` (isActive: true) |
| Autonomy modes | `ActionSafetyPolicy` (scope: client, isActive: true) |
| Auto-exec settings | `AutoExecutionSettings` (per client) |
| Recent executions | `AutoExecutionLog` (status: success, last 7 days) |

Unlike the governance scoring layer (`/portfolio/governance`), this board queries the DB
directly rather than reusing `PortfolioPayload`. This ensures approval and governance state
is always fresh and authoritative.

---

## How Operators Should Use It

### Daily review flow

1. **Check the summary bar** — look for non-zero values in "Pending Approvals", "Active Stops",
   and "Accounts w/ Blockers".

2. **Review the approval queue** — sort by aging bucket. Critical (>48h) approvals should be
   acted on first. For each:
   - **Approve** — marks the action approved and records the decision in the audit log.
   - **Reject** — marks the action rejected. Optionally provide a reason.
   - **Open Approval Queue** — navigates to the per-account approval queue for full context.

3. **Review automation state** — check for accounts in "Emergency Stop" or "Restricted" state.
   Accounts in "No Policy" state have no safety policy configured and should be reviewed.

4. **Review governance controls** — global emergency stops affect all accounts. Client-scoped
   stops affect one account. Review the reason and age of each stop before lifting it.

5. **Resolve governance blockers** — accounts listed under "Accounts Requiring Intervention"
   have active blockers. Follow the recommended intervention for each.

### Approve/Reject from the board

Approve and Reject buttons on the control board call the same API endpoints as the per-account
approval queue:

- `POST /api/automation/{actionId}/approve`
- `POST /api/automation/{actionId}/reject`

The page refreshes automatically after each action. The audit log is updated server-side.

### Lifting emergency stops and overrides

Emergency stops and overrides can only be managed from the governance controls surface
(`/automation/governance`). The control board links directly there from each stop/override item.
The board does **not** provide a one-click clear-stop button — operators must confirm the intent
in the governance controls UI.

---

## How It Links Into Lower-Level Governance Workflows

Every approval board item, automation state item, and governance control item carries navigation
links to:

| Destination | Path |
|---|---|
| Account detail | `/clients/{clientId}` |
| Per-account approval queue | `/automation?clientId={clientId}` |
| Governance controls | `/automation/governance` |
| Safety policies | `/automation/policies` |
| Audit history | `/automation/history` |

The "Full approval queue →" link navigates to `/automation` for the complete queue view.
The "Manage policies →" link navigates to `/automation/policies`.
The "Manage governance →" link navigates to `/automation/governance`.

---

## Approval Aging Buckets

| Bucket | Age Range | Color |
|---|---|---|
| Fresh | < 4 hours | Gray |
| Aging | 4–24 hours | Sky blue |
| Overdue | 24–48 hours | Amber |
| Critical | > 48 hours | Rose/red |

Critical approvals trigger the "danger" variant on the summary bar and appear at the top of the
approval board regardless of action priority.

## Execution Readiness States

| State | Meaning |
|---|---|
| Ready | Auto-exec enabled, policy is guarded_auto_execute, no emergency stop |
| Restricted | Safety policy autonomy mode is "restricted" |
| Emergency Stop | An active emergency stop covers this account |
| Auto-Exec Off | Auto-execution is disabled in settings |
| No Policy | No ActionSafetyPolicy configured for this client |

---

## Architecture Notes

The control board is implemented in `lib/portfolioControls/`:

```
lib/portfolioControls/
  types.ts             — all typed models (pure)
  approvalBoard.ts     — buildPortfolioApprovalBoard(), aging helpers, display helpers
  automationState.ts   — buildPortfolioAutomationStateBoard(), summarizePortfolioAutonomyState()
  governanceControl.ts — buildPortfolioGovernanceControlBoard(), summarizePortfolioEmergencyStops(),
                          buildGovernanceBlockers()
  aggregator.ts        — buildPortfolioControlsPayload() (DB queries + orchestration)
```

Pure builder functions (`approvalBoard.ts`, `automationState.ts`, `governanceControl.ts`) receive
pre-fetched data and contain no DB calls. The aggregator owns all DB access.

---

## Current Limitations

- **No bulk approve/reject** — the board handles one approval at a time. Bulk actions would
  require a dedicated API endpoint and are not implemented in this step.
- **Approve/reject only** — defer and escalate actions are visible but require navigating to the
  full approval queue. These actions will be added to the board in a future step.
- **No inline stop/override creation** — operators can only view and navigate to existing controls.
  Creating new stops or overrides is done through `/automation/governance`.
- **Client scope only for autonomy modes** — the board shows safety policies at the client scope.
  Ad account and campaign-level policies are not surfaced in this view.
- **No real-time updates** — the board shows a snapshot at page load time. Refresh the page to
  see the latest state.

---

## Next Steps

The next phase will add:
- Portfolio-level capital allocation intelligence and scenario planning
- Batch approval/rejection workflows
- Inline defer and escalate from the control board
- Ad account and campaign-level governance visibility
