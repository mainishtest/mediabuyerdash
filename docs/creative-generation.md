# Creative Generation Engine — Setup and Architecture

## Overview

The Creative Generation Engine converts structured creative briefs into AI-generated draft variants using Anthropic's Claude API. It is performance-aware: every prompt includes real CTR, frequency, ROAS/CPA (CRM-verified), fatigue status, and strategic intent derived from the refresh queue.

---

## How Generation Inputs Are Assembled

Each generation run starts with a `CreativeGenerationInput` built from an existing `CreativeBrief`.

```
CreativeRefreshQueueItem
  ↓ (POST /api/creative-lab/briefs)
CreativeBrief (persisted to DB)
  ├─ input: CreativeBriefInput        — metrics, signals, source context
  ├─ sections: CreativeBriefSection[] — 7-section structured brief document
  └─ draftSet: CreativeDraftSet       — initial scaffold variants (mock)
  ↓ (POST /api/creative-lab/generation)
CreativeGenerationInput
  ├─ brief: CreativeBrief             — full brief document
  ├─ mode: CreativeGenerationMode     — what type of output to generate
  └─ constraints: []                  — optional brand/compliance constraints
  ↓ (lib/creativeGeneration/prompts.ts)
Anthropic prompt (system + user)
  ├─ System: DR creative strategist persona + JSON output requirement
  └─ User: performance context + current creative + diagnosis + direction
  ↓ (Anthropic API)
Raw JSON response
  ↓ (normalizeCreativeOutput)
CreativeDraftVariant[]
  ↓ (completeGenerationJob)
CreativeDraftVariantRecord[] (persisted to DB, tagged with generationJobId)
```

**CRM is the source of truth.** ROAS and CPA values injected into prompts are always CRM-verified with a 7-day attribution window. Meta self-reported values are never used for business outcomes.

---

## Supported Draft Types

| Mode | Label | Outputs | Asset Type |
|------|-------|---------|------------|
| `copy_variations` | Copy Variations | 3 | primary_text (hook + body + CTA) |
| `headline_variations` | Headline Variations | 3 | headline (hook only) |
| `angle_variations` | Angle Variations | 3 | angle (full copy, new positioning) |
| `image_brief_variations` | Image Briefs | 3 | image_brief (concept for designer) |
| `full_refresh_package` | Full Refresh Package | 6 | primary_text + image_brief |

### Copy Variations
Three distinct angles: outcome-led, problem-first, social proof. Each has a distinct hook, body (≤80 words), and CTA.

### Headline Variations
Three headline formats: question, bold claim, curiosity gap. Single scroll-stopping line, ≤15 words.

### Angle Variations
Three positioning approaches: identity (who they aspire to be), fear of loss, authority/proof. Full copy with distinct entry points.

### Image Briefs
Three visual concept approaches: clean focus, proof-led, contrast frame. Structured enough for a designer to execute.

### Full Refresh Package
Complete creative replacement set: 3 copy + 3 image brief variants aligned as a cohesive set.

---

## How Generated Drafts Are Linked to Source Performance Context

Every generated variant is linked through a chain of IDs:

```
CreativeDraftVariantRecord.briefId
  → CreativeBriefRecord.sourceItemId  (refresh queue item)
  → CreativeBriefRecord.creativeId    (source creative)
  → CreativeBriefRecord.campaignId    (source campaign)
  → CreativeBriefRecord.clientAccountId
```

Additionally, the `generationJobId` column on `CreativeDraftVariantRecord` links back to `CreativeGenerationJobRecord` for full provenance (provider, model, tokens, latency).

The `contentJson` on each variant includes:
```json
{
  "source": "ai",
  "provider": "anthropic_text",
  "jobId": "...",
  "briefId": "...",
  "sourceItemId": "...",
  "campaignId": "...",
  "creativeId": "...",
  "clientAccountId": "..."
}
```

---

## How Review Decisions Work

Generated variants use the same review workflow as brief-scaffolded variants:

```
POST /api/creative-lab/generation
  → variants saved to CreativeDraftVariantRecord with reviewDecision = null

Buyer reviews at /creative-lab/generation?briefId=XXX
  → ApproveBtn / ReviseBtn / RejectBtn

PATCH /api/creative-lab/briefs/[id]
  body: { action: "variant", variantId, reviewDecision }
  → updateVariantReview() in lib/creativeBrief/db.ts
  → sets reviewDecision + reviewedAt on CreativeDraftVariantRecord
```

Review decisions:
- `approve` — variant is ready for the next step (creative production or guarded publish)
- `request_revision` — returned for changes; buyer adds notes
- `reject` — dismissed; not proceeding with this variant

Brief-level status changes via:
```
PATCH /api/creative-lab/briefs/[id]
  body: { action: "status", status }
```

---

## Failure Modes and Current Limitations

### Provider Not Configured
When `ANTHROPIC_API_KEY` is not set in `.env`, the engine falls back to structured mock output automatically. The rationale text indicates "Mock (AI not configured)". No error is shown to the user — output is always returned.

To enable real AI generation:
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-haiku-20241022   # optional, defaults to haiku
```

### Parse Failure
If Anthropic returns a non-JSON response (model instruction drift), `normalizeCreativeOutput()` returns an empty array. The engine detects this and falls back to structured mock output tagged with provider `"anthropic_text_fallback"`.

### Rate Limiting
HTTP 429 from Anthropic returns `{ ok: false, error: "Rate limited", retryable: true }`. The UI shows a clear message. Retry manually.

### Network Error
Unhandled fetch errors are caught and automatically fall back to mock output tagged with `"mock_fallback"`. Buyer always gets output to review.

### Missing Brief
If `briefId` is not found in DB, the generation API returns HTTP 404 and the page renders a "Brief Not Found" error.

### Missing Performance Data
The engine handles `null` ROAS/CPA gracefully — prompts note "pending CRM reconciliation" and omit performance targets that depend on those values.

### Stale Sync Data
The brief is generated from point-in-time data. If CRM reconciliation has run since the brief was created, the stored performance numbers may be stale. Brief timestamps indicate when the data was captured.

### No Auto-Publishing
This step generates drafts for review only. There is no Meta API write, no auto-approval, and no autonomous creative replacement at this stage.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | No | — | Enables real AI generation. Without it, mock output is returned. |
| `ANTHROPIC_MODEL` | No | `claude-3-5-haiku-20241022` | Claude model for generation. |

---

## Architecture

```
types/creativeGeneration.ts         — Pure TypeScript types (no lib imports)

lib/creativeGeneration/
  prompts.ts                        — Prompt construction (pure, no side effects)
  engine.ts                         — Core generation + fallback logic
  db.ts                             — Job record + variant persistence
  index.ts                          — Public exports

app/api/creative-lab/
  generation/route.ts               — POST: trigger generation job

app/creative-lab/generation/
  page.tsx                          — Server: load brief + job history
  GenerationView.tsx                — Client: orchestrator + layout
  GenerationModeSelector.tsx        — Mode picker
  GeneratedVariantCard.tsx          — Variant display with review actions

prisma/schema.prisma
  CreativeGenerationJobRecord       — One row per generation run
  CreativeDraftVariantRecord        — Updated: +generationJobId column
```

### Separation of Concerns

- **Prompt construction** (`prompts.ts`) is pure and testable independently of the engine.
- **Generation logic** (`engine.ts`) is separated from DB writes.
- **DB persistence** (`db.ts`) is separated from generation logic.
- **Review workflow** reuses existing `lib/creativeBrief/db.ts` and API routes — no duplication.
- **UI** has no business logic — all decisions go through API routes.

---

## Next Step

This engine prepares for **creative scoring, ranking, and approval readiness** — the next phase where approved drafts are evaluated against success criteria and ranked by predicted performance lift.
