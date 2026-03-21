# Client Decision View

## Overview

The Client Decision View (`/clients/{id}/decision`) provides a decision-first drill-down for each client. It answers three questions:

1. **What changed?** — Day-over-day metric deltas (ROAS, CPA, spend, revenue, orders)
2. **Why it changed?** — Detected performance drivers and signals
3. **What to do?** — Contextual action recommendations

## How Changes Are Detected

Changes compare yesterday's reconciliation data against the prior day. Signals are generated for:

| Metric | Severity Thresholds |
|--------|-------------------|
| ROAS | Major: ≥25% change, Moderate: ≥10%, Minor: <10% |
| CPA | Major: ≥25% change, Moderate: ≥10%, Minor: <10% |
| Spend | Major: ≥25% change, Moderate: ≥10% |
| Revenue | Major: ≥25% change, Moderate: ≥10% |
| Orders | Major: ≥25% change, Moderate: ≥10% |

Direction logic:
- ROAS/Revenue/Orders: increase = "improved", decrease = "declined"
- CPA: increase = "declined", decrease = "improved" (lower CPA is better)
- Changes <5% in either direction = "flat"

## How Performance Drivers Are Detected

Drivers explain **why** metrics changed. Detection rules:

| Driver | Trigger | Severity |
|--------|---------|----------|
| Spend change | ≥30% day-over-day change | High if ≥50%, else Medium |
| ROAS drop | ≥20% decline | High if ≥30%, else Medium |
| CPA spike | ≥20% increase | High if ≥40%, else Medium |
| Conversion drop | ≥25% fewer orders | High if ≥40%, else Medium |
| Goal miss (ROAS) | ROAS <90% of goal | High if <70%, Medium if 70-90% |
| Goal miss (CPA) | CPA >130% of goal | High |
| Alert signals | Open/acknowledged alerts | Mapped from alert severity |

## How Actions Are Recommended

Actions are context-sensitive based on current state:

| Condition | Actions |
|-----------|---------|
| ROAS <70% of goal OR critical issues | **Pause Losers** (danger) |
| Creative fatigue or frequency signals | **Refresh Creatives** (primary) |
| ROAS drop or CPA spike | **Create Test** (secondary) |
| ROAS ≥115% of goal | **Scale Winners** (primary) |
| Moderate issues, no critical | **Investigate** (secondary) |
| No goals configured | **Set Goals** (secondary) |
| Everything stable | **Monitor** (ghost) |

### Action Routing

| Action | Destination |
|--------|------------|
| Pause Losers | `/clients/{id}/campaigns` |
| Refresh Creatives | `/creative-lab?clientId={id}` |
| Create Test | `/creative-lab/launch?clientId={id}` |
| Scale Winners | `/clients/{id}/campaigns` |
| Investigate | `/clients/{id}/campaigns` |
| Set Goals | `/clients/{id}/settings` |
| Monitor | `/clients/{id}` |

## Architecture

```
types/clientDecision.ts                          — Type definitions
lib/clientDecision/detect.ts                     — Pure change/driver detection
lib/clientDecision/actions.ts                    — Pure action/issue/opportunity builders
lib/clientDecision/aggregator.ts                 — DB aggregation layer
app/clients/[clientId]/decision/page.tsx          — Server component
app/clients/[clientId]/decision/ClientDecisionView.tsx — Client component
```

## Limitations

1. Compares yesterday vs prior day only (not rolling averages)
2. Fatigue signals come from alerts, not real-time creative-level detection
3. CTR is not yet available at the client summary level (requires campaign-level data)
4. Actions route to existing pages — dedicated scale/fix workflows are planned for future phases
