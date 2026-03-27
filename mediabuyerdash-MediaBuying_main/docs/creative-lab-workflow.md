# Creative Lab — Workflow Foundation

## What Creative Lab Is Responsible For

Creative Lab is the operational surface where media buyers review, prioritize, and act on creative performance signals. It bridges the performance evaluation and fatigue detection systems with buyer-driven decisions about what to refresh, scale, iterate, or retire.

Creative Lab is **not** responsible for:
- Generating AI copy or images (that lives at `/creative-lab/generate`)
- Publishing to Meta (handled by the Meta write-actions layer with guardrails)
- Automated creative replacement (not in this step)

---

## Item States

Each Creative Lab item moves through a lifecycle:

| Status          | Meaning                                                      |
|-----------------|--------------------------------------------------------------|
| `draft`         | Created but not yet submitted to the active queue            |
| `queued`        | In the active queue, awaiting a buyer's attention            |
| `in_review`     | A buyer has opened the item and is actively reviewing it     |
| `approved`      | Approved for the next step: refresh brief, scale action, etc |
| `rejected`      | Dismissed — not worth pursuing at this time                  |
| `needs_revision`| Returned for more context, creative assets, or changes       |
| `blocked`       | Waiting on an external dependency (asset, client sign-off)   |
| `archived`      | Completed or stale — removed from the active queue           |

**State transitions** (in this step) are managed as client-side React state. DB persistence is added in the Creative Refresh Queue step.

---

## How Priorities Work

Priority is derived automatically from signal severity. Checks are applied in order — first match wins.

| Priority | Triggered By                                                                                 |
|----------|----------------------------------------------------------------------------------------------|
| `urgent` | Severe fatigue (`severe_fatigue` status), frequency > 6.0x, or ROAS < 0.5x with spend > $100 |
| `high`   | Active fatigue (`fatigued`), ROAS < 1.0x with spend > $50, winning creative with ROAS ≥ 3x, underperforming with spend > $500 |
| `medium` | Early fatigue warning (`watch`), weak evaluation status, or recommendation engine signal    |
| `low`    | Everything else — monitor but not urgent                                                     |

The queue always sorts urgent → high → medium → low within a filtered view.

---

## Source Types

Source types describe where a queue item originated:

| Source Type                | Origin                                                                 |
|---------------------------|------------------------------------------------------------------------|
| `fatigued_creative`       | Creative fatigue detection (frequency > threshold, CTR collapsing)     |
| `underperforming_creative`| Performance evaluation: CTR or ROAS below goal                        |
| `winning_creative`        | Evaluation identified strong performer — scale or iterate opportunity  |
| `manual_entry`            | Manually added by a buyer (future UI)                                  |
| `recommendation_engine`   | Automation rule engine triggered a creative review action             |

---

## How Items Are Built From Performance Signals

```
MetaSyncedInsight (ad level) → buildCreativePerformanceSnapshots()
                             → evaluationStatus: strong | average | weak | fatigued | insufficient_data
                             → deriveSourceType()  → CreativeLabSourceType
                             → deriveRecommendation() → headline + rationale + nextAction
                             → buildCreativeLabItem() → CreativeLabItem (status: "queued")
                             → sorted by priority (urgent first) in the WorkflowView
```

Items with `insufficient_data` status (< $50 spend) are excluded — not enough signal.

CRM-verified ROAS and CPA (from `ReconciledCampaignPerformance`) are attached to items when available. All ROAS/CPA values in Creative Lab reflect Shopify/CRM outcomes, not Meta self-reported conversions.

---

## Architecture

### Folder structure

```
types/
  creativeLab.ts              ← Pure TS types — no lib imports

lib/
  creativelab/
    types.ts                  ← CreativePerformanceSnapshot, evaluation types (existing)
    performance.ts            ← Real-data loader + snapshot builder (existing)
    workflowUtils.ts          ← NEW: 6 utility functions for the workflow
    index.ts                  ← NEW: public surface area
    analysis.ts               ← Creative analysis (existing)
    conceptGenerator.ts       ← Concept generation (existing)

app/
  creative-lab/
    page.tsx                  ← NEW: workflow queue server page
    CreativeLabWorkflowView.tsx ← NEW: client-side orchestrator
    CreativeLabItemCard.tsx   ← NEW: queue item card
    CreativeLabItemDetail.tsx ← NEW: detail panel with actions
    generate/
      page.tsx                ← NEW: AI generation pipeline (moved from root)
    CreativeLabView.tsx       ← Existing AI generation client view (unchanged)
    actions.ts                ← Existing server actions (unchanged)
    images/                   ← Existing image upload (unchanged)
    performance/              ← Existing performance view (unchanged)
```

### Key design decisions

1. **`types/creativeLab.ts` has no lib imports** — prevents circular deps. The `workflowUtils.ts` module bridges types ↔ lib.

2. **`CreativeLabItem` has context snapshots, not full objects** — `CreativeLabPerformanceContext`, `CreativeLabFatigueContext`, and `CreativeLabEvaluationContext` are local excerpts of existing module outputs. This decouples the workflow state machine from the evaluation engine internals.

3. **State is client-side in this step** — status transitions live in React state (WorkflowView). DB persistence (a `CreativeLabItem` Prisma model) is added in the Creative Refresh Queue step to support persistent state, history, and multi-user workflows.

4. **The AI generation tool moved to `/creative-lab/generate`** — keeps the landing page focused on the workflow queue. A link in the header and item detail panels connects the two surfaces.

---

## Current Limitations

- Item state (queued → in_review → approved, etc.) resets on page refresh — DB persistence is next step.
- Items are derived from MetaSyncedInsight data only — requires Meta sync to be complete.
- Fatigue context is not yet linked to items from the `creativeFatigue` module (calls `buildCreativeFatigueReport()` which needs its own Prisma queries). This can be added when the page fetches fatigue reports alongside snapshots.
- Campaign filter only shows campaigns present in the current filtered item list.
- Notes editing is not yet wired to a save action.
- Activity log entries persist only for the current browser session.

---

## Next Step: Creative Refresh Queue and Brief Generation

This foundation prepares the architecture for:
1. **DB-persisted `CreativeLabItem` model** — so state survives page refreshes and is visible to all workspace members.
2. **Brief generation** — approved items trigger a brief builder (copy direction, image concept, reference data) surfaced in a new `/creative-lab/brief/[id]` route.
3. **Fatigue signal integration** — wire `buildCreativeFatigueReport()` into the page so fatigue context is populated on all items.
4. **Manual queue entry** — buyers can add items manually with a form.
5. **Notification triggers** — high-priority items surfaced in the alert system.
