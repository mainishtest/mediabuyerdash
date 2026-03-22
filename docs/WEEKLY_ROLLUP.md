# Weekly Learning & Strategy Rollup

## Overview

The Weekly Rollup generates a concise, evidence-backed summary of account-level activity for the past week. It answers:
- What won and what lost
- What creative patterns are emerging
- Which experiments completed and what they showed
- Where to scale and where to investigate
- What to do next week — with evidence links for each recommendation

## Architecture

```
types/weeklyRollup.ts               — Type definitions (client-safe)
lib/weeklyRollup/aggregator.ts      — Server-only: composes existing aggregators
lib/weeklyRollup/utils.ts           — Client-safe: formatting and display helpers
app/weekly/page.tsx                  — Server page
app/weekly/WeeklyView.tsx            — Client view
app/weekly/sections/                 — UI components (summary, sections, next steps)
```

### Key Design Decision

**No new data tables.** The rollup composes 5 existing aggregators with week-scoped date ranges:

| Aggregator | Data |
|------------|------|
| `buildDailyExecutiveSummary()` | Spend, revenue, ROAS, CPA, client status |
| `buildDailyOutcomeSummary()` | Winner/loser/scale highlights |
| `buildActionHistoryTimeline()` | Actions taken this week |
| `queryLearningMemory()` | Learning entries and creative patterns |
| `prisma.experimentRecord.findMany()` | Active/completed experiments |

All next-step recommendations include evidence links pointing to the source entity.

## Sections

### 1. Summary Bar
- Week date range label
- Total spend, revenue, blended ROAS/CPA
- Winner/loser counts
- Status pills: scale opportunities, declining accounts, experiments, patterns, next steps

### 2. What To Do Next Week (decision-first, shown first)
Priority-ordered next steps with:
- Priority badge (high/medium/low)
- Category (Scale / Refresh / Test / Investigate / Monitor)
- Client name
- Description explaining why
- Evidence links to supporting data

### 3. What Won This Week
Winners from `CreativeOutcomeRouteRecord` with lift, confidence, scale-ready badge, evidence links.

### 4. What Lost This Week
Losers needing refresh, with lift, confidence, refresh-queued badge.

### 5. Scale Opportunities
Clients with `scaleReadiness = "ready"` or positive trend. Shows current ROAS vs goal, spend.

### 6. Areas Needing Attention
Clients with `status = "at_risk"` or `"critical"`. Shows severity, signal description.

### 7. Creative Patterns That Worked
From `queryLearningMemory()` → `extractLearningPatterns()`. Shows pattern label, category, confidence, occurrences, example insight.

### 8. Experiments This Week
Active, completed, or started experiments. Shows status, outcome, winning variant, insight text.

## Next-Step Logic

Next steps are built deterministically from stored outcomes:

| Condition | Next Step | Priority |
|-----------|-----------|----------|
| Winner with `scaleReady` | Scale winning creative | High |
| Decline with `severity = "high"` | Investigate decline | High |
| Loser with `refreshQueued` | Create refresh | Medium |
| Outcome with `type = "retest_needed"` | Create follow-up test | Medium |
| Decline with `severity = "medium"` | Monitor closely | Low |

Every next step links to the relevant workflow page and includes evidence from the source entity.

## Evidence Links

Each claim in the rollup has a `WeeklyRollupEvidenceLink`:
```typescript
{
  entityType: "experiment" | "campaign" | "creative" | "outcome" | "learning" | "action";
  entityId:   string;
  label:      string;
  href:       string;
}
```

These appear as clickable badges in the UI, linking to the source detail page.

## Integration Points

| System | Integration |
|--------|------------|
| **Daily Brief** | Weekly rollup shares data sources; Morning Brief link in header |
| **Action History** | Week's actions summarized via `buildActionHistoryTimeline()` |
| **Learning Memory** | Patterns extracted via `queryLearningMemory()` + `extractLearningPatterns()` |
| **Experiment Results** | Experiment status and outcomes from `ExperimentRecord` |
| **Scale Review** | Scale opportunities from `ClientDailySummary.scaleReadiness` |
| **Creative Lab** | Refresh and test creation actions link to `/creative-lab` |
| **Command Center** | Quick link in rollup header |

## Safe Handling

| Scenario | Behavior |
|----------|----------|
| Sparse week | `isSparse = true` with notice: "Quiet week — limited activity detected" |
| No winners/losers | Section hidden (count = 0) |
| Conflicting outcomes | Both winners and losers shown; next steps prioritize high-severity items |
| Low-confidence learnings | Confidence badge shown; patterns sorted by confidence desc |
| Missing entities | Evidence links still render; clicks go to section page |
| Stale data | Trust warning banner shown when `trustState != "healthy"` |
| No recent tests | Experiments section hidden; patterns from campaign performance only |

## Client/Server Boundary

- `aggregator.ts` — server-only (imports Prisma)
- `utils.ts` — client-safe (formatting helpers, no Prisma)
- UI components import only from `utils.ts` and `types/weeklyRollup.ts`

## Current Limitations

1. **No week navigation** — Shows last week only. Week selector not yet implemented.
2. **No email digest** — In-app only. Email weekly digest planned for future.
3. **No per-client rollup** — Portfolio-wide only. Per-client drill-down planned.
4. **No comparison** — No week-over-week comparison yet.
5. **Experiment data may be sparse** — Depends on active experiments in the period.
