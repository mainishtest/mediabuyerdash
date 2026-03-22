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
lib/actionHistory/aggregator.ts  — Merges all event sources into timeline
lib/actionHistory/linker.ts      — Links entries to downstream outcomes
app/api/action-history/route.ts  — API endpoint (GET with filters)
app/history/page.tsx             — Server page
app/history/HistoryView.tsx      — Client view with filters
app/history/sections/            — Timeline UI components
```

### Key Design Decision

**No new event store.** Instead, the aggregator reads from 5 existing data sources and normalizes them into a unified `ActionHistoryEntry` type. This avoids data duplication and ensures the timeline always reflects the true system state.

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

## Timeline UI

### Layout (`/history`)

1. **Summary bar** — Counts by status, category
2. **Filters** — Client, event type, status, date range
3. **Grouped timeline** — Entries grouped by date (Today, Yesterday, older dates)
4. **Entry cards** — Event badge, title, description, entity, actor, outcome link
5. **Footer links** — Command Center, Morning Brief, Creative Lab, Audit Log

### Filters

All filters are client-side over server-loaded data (up to 150 entries):

| Filter | Options |
|--------|---------|
| Client | All clients in workspace |
| Event Type | 14 event types |
| Status | success, failed, blocked, pending, skipped |
| Date From | Calendar picker |
| Date To | Calendar picker |

## Outcome Linking

The `linkActionHistoryToOutcomes()` post-processor attempts to connect action entries to their downstream outcomes by looking up `CreativeOutcomeRouteRecord` by entity ID. When found:

- The entry gets an `outcomeLink` with type (winner, loser, scale_opportunity, etc.)
- The UI displays an outcome badge on the entry
- The badge links to `/creative-lab/outcomes`

Linking is best-effort: entries without matching outcomes display normally.

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

## Integration Points

| System | Integration |
|--------|------------|
| **Daily Brief** | `summarizeRecentActions()` feeds recent action counts into morning brief |
| **Command Center** | Quick link from history; shares approval/experiment data sources |
| **Automation Audit** | Reuses `loadCombinedAuditHistory()` as primary data source |
| **Creative Lab** | Includes creative workflow transitions and image generation events |
| **Outcome Routing** | Outcome route decisions appear as timeline entries with outcome links |
| **Scale Review** | Scale plan approvals and executions appear in timeline |

## Safe Handling

| Scenario | Behavior |
|----------|----------|
| Missing linked entities | Entry displays without entity link; no crash |
| Partial event records | Missing fields fall back to safe defaults |
| Legacy records | Bridged from `AutoExecutionLog` and `ProposedAutomationAction` |
| Duplicate events | Deduplication in `loadCombinedAuditHistory()` prefers native over bridged |
| Stale data | Timeline reflects last-loaded state; refresh re-queries all sources |
| Sparse accounts | Empty state shown with helpful message |
| Missing tables | Graceful fallback returns empty arrays (try/catch in each loader) |

## Current Limitations

1. **No real-time updates** — Timeline is loaded on page visit, not live-streamed
2. **Client-side filtering** — Limited to ~150 entries loaded server-side; pagination not yet implemented
3. **No full-text search** — Filters are structured only (no keyword search)
4. **Outcome linking is entity-ID based** — Some older entries may not link if entity IDs don't match
5. **Actor detail limited** — Creative Lab entries show "System" as actor (no user tracking in that table)
6. **No export** — Timeline data cannot yet be exported as CSV/PDF
