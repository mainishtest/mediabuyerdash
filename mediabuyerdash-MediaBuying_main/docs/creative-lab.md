# Creative Lab — Setup and Architecture Reference

## What Creative Lab Is Responsible For

Creative Lab is the workflow surface for reviewing, triaging, and acting on
creative signals from performance data. It is **not** a creative generation
tool — it is the queue that decides *what* needs to change and *why*, before
any generation or execution step begins.

Creative Lab bridges three existing systems:

| System | Role in Creative Lab |
|---|---|
| Meta sync pipeline | Source of delivery signals (CTR, frequency, impressions) |
| Shopify/CRM reconciliation | Source of ROAS and CPA — the only trusted revenue numbers |
| Creative fatigue detection | Source of fatigue signals and overexposure indicators |

### Scope

Creative Lab **does**:
- Surface performance-driven creative opportunities as reviewable work items
- Let buyers triage, approve, or reject creative actions before they happen
- Track reviewer notes and state transitions per item
- Link to the Creative Generator and Fatigue Analysis pages

Creative Lab **does not**:
- Auto-publish changes to Meta
- Generate copy or images (that is the Generator at `/creative-lab/generate`)
- Replace creatives automatically
- Run fatigue analysis (that is the Creative Fatigue module)

---

## Item States

Every Creative Lab item moves through a defined lifecycle.

```
draft → queued → in_review → approved → [next step]
                           ↓
                     needs_revision → in_review
                           ↓
                        rejected
                           ↓
                        archived
```

| State | Meaning |
|---|---|
| `draft` | Created but not yet submitted to the active queue |
| `queued` | Visible in the active queue, awaiting a buyer's attention |
| `in_review` | A buyer has opened the item and is actively reviewing it |
| `approved` | Approved for the next step — brief generation, budget action, or refresh |
| `rejected` | Dismissed — not worth pursuing at this time |
| `needs_revision` | Returned for more context, assets, or changes before proceeding |
| `blocked` | Waiting on an external dependency (e.g. client sign-off, missing assets) |
| `archived` | Completed or stale — removed from the active queue |

### Review State

Tracks whether a human has engaged with the item:
- `not_started` — item has not been opened
- `reviewing` — item is currently open (`in_review`)
- `reviewed` — item has been approved or rejected

### Approval State

Records the final approval decision:
- `pending` — no decision made yet
- `approved` — approved for the next step
- `rejected` — dismissed

---

## How Priorities Work

Priority is derived deterministically from performance signals — not subjective
importance. The checks run in order from most to least severe; first match wins.

| Priority | Conditions |
|---|---|
| `urgent` | Severe fatigue status **or** frequency > 6x **or** ROAS < 0.5x with spend > $100 |
| `high` | Fatigued status **or** ROAS < 1.0x with spend > $50 **or** winning creative with ROAS ≥ 3x |
| `medium` | Watch fatigue status **or** weak evaluation **or** recommendation engine source |
| `low` | All other cases |

Priority is recalculated every time the page loads from fresh performance data.
It cannot be manually overridden in this version.

---

## Source Types

Source types describe the signal that created a queue item.

| Source Type | Created When |
|---|---|
| `winning_creative` | Evaluation status is `strong` — high CTR, positive ROAS |
| `fatigued_creative` | Evaluation status is `fatigued` — high frequency, declining CTR |
| `underperforming_creative` | Evaluation status is `weak` or `average` — low CTR or poor ROAS |
| `manual_entry` | Manually added by a media buyer (not yet implemented in UI) |
| `recommendation_engine` | Raised by the automation rule engine |

---

## How Items Flow Into the Queue

```
Meta sync → MetaSyncedInsight + MetaSyncedCreative
                    ↓
         loadCreativePerformanceData()
                    ↓
       buildCreativePerformanceSnapshots()   ← aggregates 14-day windows
                    ↓
          evaluateCreative()                 ← assigns evaluation status
                    ↓
    filter out "insufficient_data" items
                    ↓
    buildCreativeLabItem() for each snapshot ← assigns source type, recommendation, priority
                    ↓
    getWorkflowStates() from DB              ← load any persisted status/notes
                    ↓
    merge: overlay persisted state on dynamic items
                    ↓
    CreativeLabWorkflowView renders the queue
```

Items are rebuilt from performance data on every page load. Workflow state
(status, notes, activity log) is persisted in the `CreativeLabWorkflowItem`
and `CreativeLabActivityLog` DB tables.

---

## DB Models

### `CreativeLabWorkflowItem`

Stores the mutable workflow state for one Creative Lab item.

| Field | Description |
|---|---|
| `id` | Deterministic: `cl_{clientAccountId}_{creativeId}_{campaignId}` |
| `clientAccountId` | The client this item belongs to |
| `status` | Current lifecycle state (see Item States above) |
| `notes` | Buyer-entered notes, saved on blur |
| `createdAt` / `updatedAt` | Standard timestamps |

### `CreativeLabActivityLog`

Append-only audit trail. One row per state transition.

| Field | Description |
|---|---|
| `itemId` | Foreign key to `CreativeLabWorkflowItem` |
| `action` | Human-readable description of the transition |
| `fromStatus` | Previous state |
| `toStatus` | New state |
| `note` | Optional buyer note at time of transition |

---

## API Routes

### `PATCH /api/creative-lab/items/[id]`

Updates workflow state for one item. Body is JSON.

**Status transition:**
```json
{
  "action": "status",
  "toStatus": "in_review",
  "fromStatus": "queued",
  "clientAccountId": "...",
  "note": "Optional note"
}
```

**Notes update:**
```json
{
  "action": "notes",
  "notes": "Buyer-entered text",
  "clientAccountId": "..."
}
```

---

## Current Limitations

1. **No manual item creation** — items are generated from performance signals
   only. Manual entry source type is modelled but not yet exposed in the UI.

2. **Priority is read-only** — derived from signals on page load. Manual
   priority override is not yet implemented.

3. **No real-time updates** — status changes made by other users are not
   reflected until the page is reloaded.

4. **Activity log actor is null** — user identity is not yet captured on
   state transitions (requires auth session propagation to the API).

5. **No brief generation** — `approved` items do not yet trigger a brief
   or refresh queue. That is the next phase: Creative Refresh Queue.

6. **No AI generation from queue** — the Generator at `/creative-lab/generate`
   is a separate tool. Integration between queue approval and generation
   is a future step.

7. **DB push required on first deploy** — the `CreativeLabWorkflowItem` and
   `CreativeLabActivityLog` tables must be created by running:
   ```
   npx prisma db push
   ```
   or by applying the migration in production.

---

## Architecture Boundary

```
types/creativeLab.ts          ← Pure types. No lib imports.
lib/creativelab/
  types.ts                    ← Performance snapshot types (no UI)
  performance.ts              ← Loads + evaluates creative performance (no UI)
  workflowUtils.ts            ← Pure functions: build, derive, group, summarize
  db.ts                       ← DB read/write for workflow state
  analysis.ts                 ← Claude Vision image analysis (separate)
  storage.ts                  ← Image upload handling (separate)
  conceptGenerator.ts         ← Image concept generation (separate)
app/creative-lab/
  page.tsx                    ← Server: load + merge data, pass to view
  CreativeLabWorkflowView.tsx ← Client: queue orchestrator, filter, state
  CreativeLabItemCard.tsx     ← Queue item row (compact card)
  CreativeLabItemDetail.tsx   ← Detail panel (full context + actions)
  generate/page.tsx           ← Separate: AI copy + image generator
app/api/creative-lab/
  items/[id]/route.ts         ← PATCH: status transition + notes save
```

Keep generation logic (analysis, storage, conceptGenerator) separate from
the workflow logic (workflowUtils, db, WorkflowView). These two branches
will diverge further in the Creative Refresh Queue phase.
