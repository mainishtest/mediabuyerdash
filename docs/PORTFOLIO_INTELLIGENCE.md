# Portfolio Intelligence and Multi-Account Prioritization

## Overview

The portfolio intelligence layer provides cross-account prioritization for agencies and experienced operators. It answers: which accounts need attention first, which are ready to scale, which are declining, where the best opportunities are, and which blockers matter most.

## Architecture

```
types/portfolioIntelligence.ts                    — Type definitions (13 types)
lib/portfolioIntelligence/scoring.ts              — Priority scoring (pure, explainable)
lib/portfolioIntelligence/aggregator.ts           — Main aggregator (composes 4 data sources)
app/api/portfolio-intelligence/route.ts           — GET endpoint
app/portfolio/sections/IntelligencePanel.tsx       — Interactive priority queue UI
app/portfolio/PortfolioView.tsx                    — Updated to include intelligence section
app/portfolio/page.tsx                             — Updated to fetch intelligence data
```

### Key Design Decision

**Composes existing data sources — no new Prisma queries.** The intelligence layer calls 4 existing aggregators in parallel:

1. `buildDailyExecutiveSummary()` — Per-client status, trend, scale readiness, risk, trust state
2. `buildDailyOutcomeSummary()` — Winners, losers, scale opportunities, retest-needed
3. `buildActionHistoryTimeline()` — Blocked/failed actions (last 72h)
4. `buildPortfolioPayload()` — Health board, risks, opportunities, pacing, governance

This produces a **unified priority queue** where each item has an explainable score.

## Priority Categories (6)

| Category | Meaning | Triggers |
|----------|---------|----------|
| `scale_now` | Account ready to increase budget | Scale readiness = "ready", upward trend |
| `investigate_now` | Account needs immediate attention | Critical status, emergency stop, declining at-risk |
| `refresh_needed` | Creatives underperforming | Loser detected in outcome routing |
| `test_needed` | Follow-up experiment required | Retest-needed in outcome routing |
| `blocked_action` | Something is stuck | Blocked/failed actions in history |
| `monitor` | Watch closely | At-risk without decline, moderate alert count |

## Priority Scoring (0–100)

Each account receives an explainable priority score. Contributing factors are visible in the UI:

| Factor | Max Weight | Condition |
|--------|-----------|-----------|
| Performance status | 30 | Critical=30, At-risk=20, Scaling=10, Stable=5 |
| Trend direction | 15 | Down=15, Up+scale-ready=12 |
| Scale readiness | 15 | Ready=15 |
| Alert severity | 15 | 3+ high=15, 1+ high=8, 3+ total=5 |
| Blocked action | 10 | Has blocked/failed action |
| Emergency stop | 10 | Emergency stop active |
| Restricted mode | 5 | Restricted automation |
| Stale sync | 5 | >48h since sync |
| Winner available | 8 | Winner in outcome routing |
| Loser detected | 5 | Loser in outcome routing |
| Pending test | 5 | Retest-needed outcome |

Score is capped at 100. Items with `monitor` category and score < 10 are filtered out.

## Evidence

Each priority item includes evidence items showing what data supports the ranking:

```typescript
{
  label: "ROAS",
  value: "2.45×",
  source: "CRM reconciliation",
  direction: "positive"   // green chip
}
```

Evidence sources: CRM reconciliation, client goals, 3-day trend, performance engine, Meta spend, alert system, budget pacing.

## Specialized Sections

Beyond the priority queue, the intelligence summary includes:

- **Scale Candidates** — Accounts with `scaleReadiness = "ready"` or `"possible"`
- **Decline Signals** — Accounts with `status = "at_risk"` or `"critical"`
- **Blockers** — Blocked/failed actions + pending outcome blockers
- **Opportunities** — From portfolio health (experiment winners, strong ROAS, under-budget, creative ready)
- **Risks** — From portfolio health (emergency stops, high alerts, critical pacing, overdue approvals)

## UI Design

### Priority Queue
- Expandable rows sorted by score (highest first)
- Each row shows: category badge, blocked/ready state, title, reason, score bar
- Expanded view shows: evidence chips, score factors, and action buttons

### Action Buttons Per Item
- **Primary**: Category-specific (Review scale plan, Investigate account, Open Creative Lab, etc.)
- **Open account**: Direct link to client decision page
- **Action history**: Link to `/history`

### Filters
- **Priority category**: Scale Now, Investigate Now, Refresh Needed, Test Needed, Blocked, Monitor
- **Account**: Filter to specific client
- **State**: Blocked / Ready

### Summary Stats
- Stat cards showing counts per category (only shown when > 0)
- Color-coded: green (scale), red (investigate), amber (refresh), blue (test), orange (blocked)

## Integration Points

| System | Integration |
|--------|------------|
| **Portfolio Page** | Intelligence section appears as first content section after KPIs |
| **Portfolio API** | GET `/api/portfolio-intelligence` returns full summary |
| **Daily Executive Summary** | Primary data source for client status/trend/readiness |
| **Outcome Routing** | Winners/losers/retests feed into priority scoring |
| **Action History** | Blocked/failed actions detected and surfaced |
| **Portfolio Health** | Health board, risks, opportunities reused (not duplicated) |
| **Alerts** | Link to `/alerts` from header action |
| **Command Center** | Link from individual items to command center views |
| **Creative Lab** | Refresh-needed items link to Creative Lab |

## Safe Handling

| Scenario | Behavior |
|----------|----------|
| Sparse accounts | Insufficient-data clients get minimal scoring (status=0) |
| Suspect trust | Trust state displayed on each item; warnings surfaced |
| Stale data | Stale sync adds 5 points and appears in evidence |
| Low-confidence signals | Low-signal monitors (score < 10) filtered from queue |
| Conflicting priorities | Score-based ranking resolves conflicts; all factors visible |
| Missing data sources | `Promise.allSettled` — failed sources logged as warnings |
| Missing workflows | Action hrefs point to existing routes; no dead-end links |

## Responsive Design

- Priority queue uses full-width stacked layout
- Evidence chips and action buttons wrap naturally with `flex-wrap`
- Score bar uses fixed width (64px) for consistent alignment
- Filters wrap on mobile
- Summary stat cards wrap on narrow screens
- All interactive elements have minimum touch targets

## Current Limitations

1. **No cross-account budget optimizer** — Shows which accounts to scale, doesn't compute optimal allocation
2. **No portfolio-level trend** — Trends are per-account only
3. **No saved views** — Filters reset on page load
4. **No notification of priority changes** — Must visit the page to see updates
5. **Single workspace** — Portfolio is workspace-scoped; no multi-workspace aggregation
