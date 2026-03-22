# Action History and Audit Timeline

## Overview

The Action History provides a unified, account-level timeline of all important decisions and actions. It merges multiple event sources into a single reverse-chronological view that shows:
- What action happened
- When it happened
- Who or what initiated it
- Whether it succeeded, failed, or was blocked
- What happened after (outcome linking)

## Architecture

```
types/actionHistory.ts           — Unified type definitions
lib/actionHistory/aggregator.ts  — Server-only: merges all event sources
lib/actionHistory/utils.ts       — Client-safe: summary, grouping, filtering (NO Prisma)
lib/actionHistory/linker.ts      — Server-only: links entries to downstream outcomes
app/api/action-history/route.ts  — API endpoint (GET with filters)
app/history/page.tsx             — Server page
app/history/HistoryView.tsx      — Client view with filters + detail drawer
app/history/sections/            — Timeline UI components
```

### Client/Server Boundary

**Critical design decision**: Pure utility functions (`buildActionHistorySummary`, `groupActionHistoryEntries`, `filterActionHistoryEntries`) live in `lib/actionHistory/utils.ts` which has NO Prisma imports. Client components import from `utils.ts`, never from `aggregator.ts`.

The aggregator re-exports from utils for backward compatibility, but `aggregator.ts` also contains server-only functions that use Prisma.

### Data Sources

| Source | Table | Events |
|--------|-------|--------|
| Automation Audit | `AutomationAuditLog` | Approvals, executions, blocks, recommendations |
| Proposed Actions | `ProposedAutomationAction` | Approval lifecycle (proposed → approved → executed) |
| Execution Log | `AutoExecutionLog` | Execution attempts, guardrail blocks |
| Creative Lab | `CreativeLabActivityLog` | Creative workflow transitions, image generation |
| Outcome Routes | `CreativeOutcomeRouteRecord` | Winner/loser routing, scale decisions |

## Event Types

| Event Type | Description |
|------------|-------------|
| `recommendation_created` | System surfaced a recommendation |
| `approval_requested` | Action entered the approval queue |
| `approval_granted` | Operator approved an action |
| `approval_rejected` | Operator rejected an action |
| `approval_deferred` | Operator deferred an action |
| `scale_plan_created` | Scale plan approved |
| `scale_executed` | Budget increase/decrease executed |
| `budget_changed` | Budget modification event |
| `test_created` | New creative test created |
| `test_launched` | Test launched to Meta |
| `creative_refresh_sent` | Creative sent to lab for refresh |
| `image_generation_completed` | AI image generation completed |
| `creative_status_changed` | Creative workflow status transition |
| `outcome_routed` | Test outcome routed (winner/loser/retest) |
| `execution_succeeded` | Action executed successfully |
| `execution_failed` | Action execution failed |
| `launch_failed` | Creative launch failed |
| `action_blocked` | Action blocked by policy/guardrail |
| `emergency_stopped` | Emergency stop applied |
| `retry_started` | Retry attempt began |
| `retry_succeeded` | Retry completed successfully |

## Statuses

| Status | Meaning | Visual |
|--------|---------|--------|
| `success` | Completed successfully | Green dot |
| `failed` | Action failed | Red dot |
| `blocked` | Blocked by policy/guardrail | Red dot |
| `pending` | Awaiting action/review | Amber dot |
| `in_progress` | Currently executing | Blue dot |
| `skipped` | Skipped (not applicable) | Gray dot |

## Timeline UI (`/history`)

### Layout

1. **Summary bar** — Counts by status and category (always shows Total)
2. **Filters** — Client, event type, status, actor type, date range
3. **Grouped timeline** — Entries grouped by date (Today, Yesterday, older dates)
4. **Entry cards** — Clickable with event badge, title, description, entity, actor, outcome link
5. **Detail drawer** — Side panel (desktop) or bottom panel (mobile) with full entry details and action buttons
6. **Footer links** — Command Center, Morning Brief, Creative Lab, Outcome Routing, Alerts, Audit Log

### Entry Detail Drawer

When an entry is selected, the detail drawer shows:
- Status badge
- Title and description
- Timestamp
- Actor (with type indicator)
- Entity (linked)
- Client (linked)
- Linked outcome (if any)
- Source
- Metadata (policy decision, rollback state, lift/confidence, etc.)
- **Contextual action buttons**

### Action Buttons

The drawer builds contextual action buttons based on the entry:

| Button | When shown |
|--------|-----------|
| Open account | Entry has a clientId |
| Open campaign | Entity is a campaign |
| Open Creative Lab | Source is creative_lab |
| Open experiments | Entry is test_launched or test_created |
| Open scale review | Entry is scale_plan_created or scale_executed |
| Open approvals | Entry is approval_requested/granted/rejected |
| View linked outcome | Entry has an outcomeLink |
| Open audit log | Source is automation_audit/proposed_action/execution_log |

### Filters

| Filter | Options |
|--------|---------|
| Client | All clients in workspace |
| Event Type | 15 event types |
| Status | success, failed, blocked, pending, skipped |
| Actor | system, operator, scheduled, API |
| Date From | Calendar picker |
| Date To | Calendar picker |

## Deep Linking

Entity hrefs are now context-aware:
- Budget actions → `/clients/{id}/campaigns`
- Campaign entities → `/clients/{id}/campaigns`
- Client entities → `/clients/{id}/decision`
- Creative lab entries → `/creative-lab`
- Outcome routes → `/creative-lab/outcomes`

## Outcome Linking

`linkActionHistoryToOutcomes()` links action entries to downstream outcomes by matching entity IDs against `CreativeOutcomeRouteRecord.testResultId` and `id`. When found, entries get an `outcomeLink` with type, label, and href.

Linking is best-effort: entries without matching outcomes display normally.

## Integration Points

| System | Integration |
|--------|------------|
| **Daily Brief** | `summarizeRecentActions()` feeds recent action counts into morning brief |
| **Command Center** | RecentActionsPanel shows last-24h actions with status badges |
| **Automation Audit** | Reuses `loadCombinedAuditHistory()` as primary data source |
| **Creative Lab** | Includes creative workflow transitions and image generation events |
| **Outcome Routing** | Outcome route decisions appear with outcome links |
| **Scale Review** | Scale plan approvals and executions appear in timeline |

## API

### GET /api/action-history

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `clientId` | query | — | Filter by client |
| `eventType` | query | — | Filter by event type |
| `status` | query | — | Filter by status |
| `dateFrom` | query | — | YYYY-MM-DD start |
| `dateTo` | query | — | YYYY-MM-DD end |
| `limit` | query | 100 | Max entries (max 300) |

Returns: `{ entries: ActionHistoryEntry[], summary: ActionHistorySummary }`

## Safe Handling

| Scenario | Behavior |
|----------|----------|
| Missing linked entities | Entry displays without entity link; no crash |
| Partial event records | Missing fields fall back to safe defaults |
| Legacy records | Bridged from AutoExecutionLog and ProposedAutomationAction |
| Duplicate events | Deduplication in loadCombinedAuditHistory() prefers native over bridged |
| Stale data | Timeline reflects last-loaded state; refresh re-queries |
| Sparse accounts | Empty state with helpful message |
| Missing tables | try/catch in each loader returns empty arrays |

## Current Limitations

1. **No real-time updates** — Timeline is loaded on page visit, not live-streamed
2. **Client-side filtering** — Limited to ~150 entries loaded server-side
3. **No full-text search** — Filters are structured only (no keyword search)
4. **Actor detail limited** — Creative Lab entries show "System" (no user tracking in that table)
5. **No export** — Timeline data cannot yet be exported
