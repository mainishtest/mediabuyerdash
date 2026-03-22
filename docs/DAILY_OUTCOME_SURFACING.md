# Daily Operator Surfacing of Launched-Test Outcomes

## Overview

The command center now surfaces launched creative/image test outcomes directly in the daily operator view, showing winners, losers, scale opportunities, refresh needs, and monitoring items.

## What Sections Are Shown

### Launched-Test Outcomes (Command Center)

The new "Launched-Test Outcomes" section appears when there are outcome routes in the system. It shows:

| Highlight Type | Color | Meaning |
|---------------|-------|---------|
| Scale Ready | Sky blue | Winner with high confidence — ready for scale review |
| Winner | Emerald | Challenger winning but needs more data or already running |
| Refresh Needed | Rose | Loser — needs creative refresh in Creative Lab |
| Retest Needed | Violet | Mixed result — needs follow-up test redesign |
| Monitoring | Slate | Low confidence — keep monitoring until more data |
| Loser | Amber | Failed test or archived — learning captured |

### Summary Bar
Shows counts of each category at the top of the section. Only categories with items > 0 are displayed.

### Sorting Logic
Items are sorted in priority order:
1. Blockers (pending action on scale/refresh items) — shown first
2. Scale opportunities — high-value actions
3. Refresh needed — losing creatives that need attention
4. All other items by type

## How Action Readiness Is Represented

Each outcome item shows:
- **Readiness dot**: amber (pending), emerald (actioned), slate (archived), indigo (learning captured)
- **"Action needed" badge**: shown when the item is pending action and is a scale opportunity or refresh need
- **Next action label**: the recommended action (e.g., "Send to Scale Review", "Iterate in Lab")
- **Linked workflow**: clicking the item navigates to the destination workflow

## How Daily Outcome Aggregation Works

```
buildCommandCenterPayload()
  → buildDailyOutcomeSummary() [new]
    → Queries CreativeOutcomeRouteRecord (pending_action first, then by update time)
    → Classifies each route into highlight types
    → Builds titles + subtitles with lift % and confidence
    → Counts by category
  → Maps to CommandCenterOutcomeItem[]
  → Includes in payload.outcomeItems + payload.outcomeSummary
```

## How This Links Into Downstream Workflows

Each outcome item links to the appropriate next workflow:

| Route Type | Destination |
|-----------|-------------|
| `send_winner_to_scale_review` | `/experiments?highlight={experimentId}` |
| `keep_winner_running` | `/creative-lab/results` |
| `send_loser_to_creative_lab` | `/creative-lab?briefId={briefId}` |
| `send_mixed_result_to_follow_up_test` | `/creative-lab/launch?prepItemId={prepItemId}` |
| `monitor_until_more_data` | `/creative-lab/results` |
| `capture_learning_only` | `/insights/memory` |
| `archive_creative_outcome` | (no link — archived) |

## Key Files

| File | Purpose |
|------|---------|
| `lib/dailyOutcomes/aggregator.ts` | Queries outcome routes, builds highlights |
| `lib/commandCenter/aggregator.ts` | Updated to include outcome data in payload |
| `lib/commandCenter/types.ts` | Added outcome types to command center payload |
| `app/command-center/sections/OutcomesPanel.tsx` | Outcomes UI panel |
| `app/command-center/CommandCenterView.tsx` | Updated to render outcomes section |

## Integration Points

- **Command Center**: Outcomes panel appears between Creative Actions and Budget Pacing
- **Creative Lab Outcomes**: Full detail view at `/creative-lab/outcomes`
- **Experiment Results**: Individual experiment detail at `/experiments`
- **Creative Lab**: Refresh workflow at `/creative-lab`

## Current Limitations

1. **No real-time updates** — Outcome data is loaded on page render, not via WebSocket
2. **Batch limit** — Shows max 30 outcome items in command center
3. **No client name on items** — Outcome routes store clientAccountId but not always clientName
4. **Outcome routes must exist** — Items only appear after `buildCreativeOutcomeRoute()` has been called for a test result
5. **Non-blocking** — If outcome loading fails, the command center still renders all other sections
