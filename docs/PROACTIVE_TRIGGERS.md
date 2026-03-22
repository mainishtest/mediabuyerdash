# Proactive AI Trigger and Alert System

## Overview

The proactive trigger system detects meaningful performance, risk, and opportunity conditions and surfaces them as explainable, actionable alerts. It extends the existing `AlertEvent` pipeline — same lifecycle, same deduplication, same command center integration.

## Architecture

```
types/proactiveTriggers.ts              — Type definitions
lib/proactiveTriggers/evaluator.ts      — Server-only trigger evaluation
lib/proactiveTriggers/alertBuilder.ts   — Converts triggers → AlertEventDraft[]
lib/alerts/types.ts                     — Extended AlertType with new trigger types
lib/alerts/persist.ts                   — Existing upsert/lifecycle (reused)
app/api/proactive-triggers/route.ts     — POST (evaluate) + GET (load)
app/alerts/page.tsx                     — Runs proactive triggers alongside detectors
```

### Key Design Decision

**Extends existing AlertEvent, doesn't create a parallel system.** Proactive triggers generate `AlertEventDraft[]` that are upserted into the same `AlertEvent` table. This means:
- Same deduplication (dedup key prevents spam)
- Same lifecycle (open → acknowledged → resolved)
- Same command center display
- Same notification/digest integration
- No migration needed (uses existing `alertType` string field)

## Trigger Types (8)

| Trigger | Condition | Priority | Source |
|---------|-----------|----------|--------|
| `scale_ready` | Client has `scaleReadiness = "ready"` | High | Daily executive summary |
| `winner_detected` | Outcome routing has winner or scale opportunity | Medium–High | Daily outcomes |
| `loser_detected` | Outcome routing has loser or refresh-needed | Low–Medium | Daily outcomes |
| `creative_fatigue_detected` | Creative fatigue signals detected | Medium | Creative fatigue detector |
| `follow_up_test_needed` | Outcome has retest-needed routing | Medium | Daily outcomes |
| `action_blocked` | Action history has blocked/failed entries | Medium–High | Action history |
| `trust_state_warning` | Portfolio trust state is suspect/blocked | High–Urgent | Executive summary |
| `sync_health_issue` | Client has stale sync (>48h) | Medium | Executive summary |

## Trigger Evaluation Flow

`evaluateProactiveTriggers()` runs 3 existing aggregators in parallel:

1. **`buildDailyExecutiveSummary()`** → Client status, risk level, scale readiness, trust state
2. **`buildDailyOutcomeSummary()`** → Winners, losers, scale-ready, retest-needed highlights
3. **`buildActionHistoryTimeline()`** → Blocked/failed actions (last 48h)

Each returns data that feeds into detector functions:
- `detectScaleReadyConditions()` — Clients with `scaleReadiness = "ready"`
- `detectPerformanceDropConditions()` — Critical/at-risk clients with declining trend
- `detectTrustStateWarnings()` — Portfolio trust issues + client stale syncs
- `detectWinnerConditions()` — Outcome winners and scale opportunities
- `detectLoserConditions()` — Outcome losers and refresh-needed
- `detectFollowUpTestNeed()` — Retest-needed outcomes
- `detectBlockedActionNeed()` — Blocked/failed recent actions

## Alert Priority

| Priority | When Used | AlertSeverity Mapping |
|----------|-----------|----------------------|
| Urgent | Trust state blocked, critical performance | `high` |
| High | Scale-ready, trust suspect, winner (scale opp), failed actions | `high` |
| Medium | At-risk with decline, blocked actions, refresh-needed, retest | `medium` |
| Low | Loser detected, learning captured | `low` |

## Alert Lifecycle

Proactive alerts follow the existing `AlertEvent` lifecycle:

```
open → acknowledged → resolved
  └→ (re-detected) → lastDetectedAt updated (status preserved)
```

- **Deduplication**: Key is `{clientId}:{triggerType}:{entityId}`
- **Re-detection**: If condition persists, `lastDetectedAt` updates but status stays
- **Resolution**: When user marks resolved and condition recurs, new alert created
- **Acknowledge**: Preserves alert but removes from "unacknowledged" queue

## Evidence

Each trigger includes evidence items:
```typescript
{
  label: "ROAS",
  value: "2.45×",
  source: "CRM reconciliation",
  direction: "positive"
}
```

Evidence is stored in `supportingMetrics` JSON field alongside action metadata (`_actionLabel`, `_actionHref`, `_actionDesc`).

## Action Suggestions

Each trigger includes a contextual action suggestion:
```typescript
{
  label: "Review scale plan",
  description: "Client X is performing above goal with positive trend.",
  href: "/clients/{id}/decision",
  priority: "high"
}
```

Actions route to real workflow pages — never generic destinations.

## Integration Points

| System | Integration |
|--------|------------|
| **Alerts Page** | Proactive triggers run alongside anomaly detectors on page load |
| **Command Center** | Proactive alerts appear in AlertsPanel with type labels |
| **Daily Brief** | Proactive alerts included in digest (via existing AlertEvent queries) |
| **API** | POST `/api/proactive-triggers` to evaluate; GET to load proactive alerts |
| **Notifications** | Proactive alerts flow into existing digest/email pipeline |

## API Endpoints

### POST /api/proactive-triggers
Evaluate triggers and upsert alerts. Returns trigger counts and warnings.

### GET /api/proactive-triggers
Load current proactive alerts with summary. Returns `{ alerts, summary }`.

## Safe Handling

| Scenario | Behavior |
|----------|----------|
| Duplicate alerts | Deduplication key prevents spam; re-detection just updates timestamp |
| Low-confidence signals | Winners/losers include confidence in evidence; priority adjusted |
| Stale data | Trust warnings surfaced; stale sync triggers generated |
| Missing sources | `Promise.allSettled` — failed sources logged as warnings, others proceed |
| Noisy triggers | Sliced to top 5 per type; priority-based ordering |
| Suspect trust | Trust state warning generated with urgent priority |

## Current Limitations

1. **No scheduled evaluation** — Triggers run on page load or API call. Cron integration planned.
2. **No creative fatigue integration yet** — Creative fatigue detector exists but isn't wired into proactive triggers in v1.
3. **No alert suppression rules** — All triggers generate alerts; user-level suppression not yet available.
4. **No Slack/webhook delivery** — In-app and email digest only.
5. **Portfolio-level triggers limited** — Trust state is portfolio-wide; others are client-scoped.
