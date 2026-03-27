# Optimization Command Center

## What It Is

The Command Center (`/command-center`) is the daily operating cockpit for media buyers and operators. It surfaces the most important signals across all active clients in a single, prioritized view — so you start every work session knowing exactly what needs attention, what is blocked, and what is ready to move next.

It does **not** execute actions itself. Every item links directly into the relevant workflow module.

---

## What Data Feeds It

| Section | Data Source |
|---|---|
| KPI Summary | `ReconciliationSummary` (30-day window, CRM source of truth) |
| Today's Priorities | Derived from all sections below |
| Actions Awaiting Approval | `ProposedAutomationAction` (status = proposed) |
| Active Experiments | `ExperimentRecord` + `ExperimentResultRecord` |
| Creative Actions | `PublishPrepRecord` (draft / validated / guardrails_passed) |
| Budget Pacing Risks | `BudgetPacingTarget` + `UTMPerformanceRow` (current month spend) |
| Alerts & Blockers | `AlertEvent` (open + acknowledged) |

All ROAS and CPA figures are **CRM-sourced** with a **7-day attribution window**.

---

## How Priorities Are Determined

The priority engine (`lib/commandCenter/priorityEngine.ts`) assigns a level to every item:

| Level | Examples |
|---|---|
| **Critical** | High-severity alert, approval pending > 48h, over-pacing > 130%, under-pacing < 60% |
| **High** | Medium-severity alert, pending approval (high priority rule), experiment with declared winner, over/under pacing 85–130% |
| **Medium** | Low-severity alert, pending approval (medium priority), experiment running, awaiting-review creative |
| **Low** | Completed experiments, in-progress creative drafts |

The "Today's Priorities" section is a unified queue that merges all signals, sorts by priority (critical → low), and surfaces the top 20 items.

---

## How to Use It Daily

1. **Open Command Center first.** The KPI summary tells you the 30-day state at a glance.
2. **Work through "Today's Priorities" top-to-bottom.** Critical and High items need same-day attention.
3. **Review "Actions Awaiting Approval."** Any automation proposals triggered overnight will appear here. Approve or reject directly from the linked Automation page.
4. **Check "Active Experiments."** If a winner has been declared, the recommended action is shown. Navigate to Experiments to act on it.
5. **Handle "Creative Actions."** Items marked "Ready to publish" are approved and waiting for you to push to Meta via Publish Prep.
6. **Monitor "Budget Pacing Risks."** Over-pacing and under-pacing clients appear here. Link takes you to the Pacing module for adjustment.
7. **Clear "Alerts & Blockers."** Unresolved alerts remain visible until acknowledged or resolved in the Alerts module.

---

## Filters

- **Client selector** — filters all sections to a single client. Changes URL (`?clientId=`) and triggers a server re-fetch.
- **Priority filter** — client-side only, refines the "Today's Priorities" list without re-fetching.

---

## Current Limitations

- **KPI data requires reconciliation to have run** for the selected client and date range. If no reconciliation summaries exist, spend/revenue/ROAS/CPA will show zero.
- **Pacing calculation** uses `UTMPerformanceRow` for actual spend. If Meta sync has not run recently, the figure may be stale.
- **Client-level pacing targets only** — campaign-level budget targets are not surfaced in the Command Center pacing panel (they appear in the full Pacing module).
- **No auto-refresh** — the page requires a manual reload to pick up new signals. A polling mechanism can be added in a future step.
- **Creative Lab items** shown are `PublishPrepRecord` entries only. Creative Lab workflow items in earlier stages (queued, in_progress) are not surfaced here.

---

## Architecture

```
lib/commandCenter/
  types.ts            — Pure type definitions (no logic)
  priorityEngine.ts   — Priority scoring + label helpers (pure functions)
  aggregator.ts       — Prisma queries → CommandCenterPayload

app/command-center/
  page.tsx            — Server component: reads searchParams, calls aggregator
  CommandCenterView.tsx — Client root: filter state, section layout
  sections/
    SummaryBar.tsx    — KPI + signal counts
    PriorityQueue.tsx — Unified priority cards
    ApprovalQueue.tsx — Pending automation approvals
    ExperimentsPanel.tsx — Active + completed experiments
    CreativePanel.tsx — Publish-prep creative items
    PacingPanel.tsx   — Budget pacing risks
    AlertsPanel.tsx   — Open + acknowledged alerts
```

The server page always performs a fresh DB fetch (`force-dynamic`). The client component filters sections locally by priority without an extra round-trip. Client filter changes navigate to a new URL, which causes a server re-render with the new `clientId` param.
