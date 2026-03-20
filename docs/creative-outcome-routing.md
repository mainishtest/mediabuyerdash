# Creative Outcome Routing

**Location:** `lib/creativeOutcomeRouting/`, `app/creative-lab/outcomes/`, `app/api/creative-lab/outcomes/`

---

## Overview

The outcome routing layer routes completed creative test results to the right next workflow. After a test result is ingested and has an outcome, a routing decision is generated that determines what happens next — scale review, creative iteration, follow-up test, or monitoring.

All routing decisions are **explicit and explainable**. Every route includes a `reasons` array describing why that route was chosen, including any blockers that prevent autonomous scaling.

---

## Route Types

| Route Type | When | Next Step |
|---|---|---|
| `send_winner_to_scale_review` | Challenger wins + high/very_high confidence | Submit to scale approval workflow |
| `keep_winner_running` | Challenger wins + low/medium confidence | Continue running; re-evaluate when window closes |
| `send_loser_to_creative_lab` | Control holds | Send back to Creative Lab for brief iteration |
| `send_mixed_result_to_follow_up_test` | Mixed result or no clear winner | Design a more targeted follow-up test |
| `monitor_until_more_data` | In progress, insufficient data, or conf < 0.40 | Re-ingest when more data is available |
| `capture_learning_only` | Failed test or fallback | Save learning record; no further creative action |
| `archive_creative_outcome` | Archived outcome | No further action required |

---

## Architecture

```
CreativeTestResult (after ingestion)
    │
    ▼
buildCreativeOutcomeRoute()   ← lib/creativeOutcomeRouting/router.ts
    │
    ├── determineRouteType()   — routing decision logic
    ├── buildRouteReasons()    — explainability array with isBlocker flags
    ├── buildRouteEvidence()   — raw metric snapshot
    ├── buildNextAction()      — label, hint, linkedWorkflow path
    └── extractCreativeIterationLearning()  ← lib/creativeOutcomeRouting/learnings.ts
            │
            └── winningPattern, losingPattern, iterationHints,
                briefAdjustments, avoidList, extractionConfidence
    │
    ▼
saveCreativeOutcomeRoute()    ← lib/creativeOutcomeRouting/db.ts
    │
    ▼
CreativeOutcomeRouteRecord    ← PostgreSQL (added via SQL migration)
```

---

## DB Migration

Run `prisma/migrations/add_creative_outcome_routing.sql` in Neon SQL editor:

```sql
-- Creates CreativeOutcomeRouteRecord table with unique constraint on testResultId
-- and indexes on clientAccountId, readinessState, routeType
```

The table is **not** managed by `prisma migrate` — it is created via idempotent SQL. The Prisma schema model (`CreativeOutcomeRouteRecord`) is present for documentation but the generated client does not include it; `(prisma as any)` is used in `db.ts`.

---

## Generating a Route

### Via API

```bash
# Generate or refresh a route from a test result
POST /api/creative-lab/outcomes
Content-Type: application/json

{ "testResultId": "ctr_xxx" }
```

Response:

```json
{
  "route": {
    "id": "cor_xxx",
    "routeType": "send_loser_to_creative_lab",
    "readinessState": "pending_action",
    "nextActionLabel": "Iterate in Creative Lab",
    "nextActionHint": "Send this challenger back to the Creative Lab for a new iteration using the captured learning.",
    "reasons": [...],
    "learning": { "winningPattern": null, "losingPattern": "...", ... }
  }
}
```

### Via Code

```typescript
import { buildCreativeOutcomeRoute, saveCreativeOutcomeRoute } from "@/lib/creativeOutcomeRouting";

const route = buildCreativeOutcomeRoute(result);   // pure — no DB
const saved = await saveCreativeOutcomeRoute(route); // upsert by testResultId
```

---

## Updating Action State

```bash
PATCH /api/creative-lab/outcomes/:id
Content-Type: application/json

{
  "readinessState": "actioned",
  "actionedBy": "user@example.com",
  "actionNote": "Sent to scale review via Slack"
}
```

Valid `readinessState` values: `pending_action`, `actioned`, `archived`, `learning_captured`.

---

## Extracted Learning

When a test result has a resolved outcome with sufficient data, `extractCreativeIterationLearning()` builds a `CreativeIterationLearning` object stored in the route record's `learningJson` column.

**Extraction confidence levels:**

| Level | Condition |
|---|---|
| `high` | Window complete + comparison present + both snapshots + confScore ≥ 0.65 |
| `medium` | Window complete + comparison + snapshots + confScore ≥ 0.40 |
| `low` | Window incomplete, missing snapshots, or confScore < 0.40 |

Low-confidence learning is surfaced to the user with a warning banner — it should be treated as directional only, not used to override a working brief.

---

## UI

Navigate to **Creative Lab → Outcome Routing** (`/creative-lab/outcomes`).

- **Stat cards**: total, pending action, actioned, learning captured, winners, iterate, mixed, monitor, archived
- **Left panel**: filter tabs + compact route card list
- **Right panel**: sticky detail with route decision, reasons, learning, evidence, action buttons
- **Action buttons** (pending routes only):
  - **\<nextActionLabel\> →** — links to the destination workflow
  - **Mark Actioned** — sets state to `actioned`
  - **Save Learning** — sets state to `learning_captured`
  - **Archive** — sets state to `archived`

---

## Integration Points

| System | How |
|---|---|
| Creative Test Results | `POST /api/creative-lab/outcomes` with `testResultId` after ingestion |
| Creative Lab Brief Gen | Inject `learning.briefContextHints` into brief generation context |
| Scale Review | `linkedWorkflow` → `/experiments?highlight=xxx` |
| Learning Memory | `linkedWorkflow` → `/insights/memory`; learning is surfaced for scoring |

---

## Design Rules

1. **Explicit only** — routing proposes a next workflow; no autonomous scaling or pausing
2. **Always explainable** — every route has a populated `reasons[]` array with `isBlocker` flags
3. **Low confidence → monitor** — `confScore < 0.40` always routes to `monitor_until_more_data` regardless of outcome
4. **Additive learning** — `extractCreativeIterationLearning` does not overwrite; it captures the learning from this specific test
5. **Extraction confidence surfaced** — low-confidence learning is flagged in the UI to prevent over-relying on thin data
