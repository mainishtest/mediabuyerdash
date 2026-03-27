# Performance-Driven AI Creative Generation Engine

## Overview

The Creative Engine generates high-quality, structured ad-ready creative outputs grounded in real performance data, fatigue signals, and learned patterns from the learning memory module.

It is accessible at `/creative-lab/creative-engine` and is linked from the Creative Lab workflow queue header.

---

## How Generation Works

### 1. Source Selection

The user selects a creative from their performance snapshots. Each snapshot represents a (creative, campaign) pair with aggregated 14-day metrics from Meta.

### 2. Trigger Detection

The trigger type is automatically derived from the creative's `evaluationStatus`:

| Evaluation Status | Trigger Type    | Intent                          |
|-------------------|-----------------|----------------------------------|
| `fatigued`        | `fatigue`       | Refresh hook, new angle          |
| `weak`            | `underperformance` | Replace creative, hook fix    |
| `strong`          | `opportunity`   | Preserve pattern, extend life    |
| `average`         | `manual`        | Broad generation                 |

### 3. Context Building (`buildCreativeGenerationContext`)

Before any generation, the engine builds a `CreativeGenerationContext` from:

- **Performance snapshot** — CTR, frequency, ROAS, CPA, spend, evaluation status
- **Learning memory** — winning patterns, losing patterns, audience insights, experiment insights
- **Goals** — ROAS goal, CPA goal, primary goal type (optional)
- **Platform constraints** — Meta format limits (primary_text, headline, description, CTA)

The context is built in `lib/creativeGeneration/context.ts`.

### 4. Context-Brief Bridge (`buildContextBrief`)

The `CreativeGenerationContext` is converted to a `CreativeBrief` via `lib/creativeGeneration/contextBrief.ts`. This allows the existing Anthropic generation engine to operate without modification.

### 5. Generation (`generateCreativeDrafts`)

The existing `lib/creativeGeneration/engine.ts` runs the generation:
- Calls Anthropic Claude via API if `ANTHROPIC_API_KEY` is configured
- Falls back to structured mock output if API key is missing or network error occurs
- Always returns structured output — never throws

### 6. Concept Assembly (`generateCreativeConcepts`)

Raw draft variants are assembled into `CreativeConcept[]`:
- Copy variant + paired image brief = one `CreativeConcept`
- Each concept includes: angle, copy block (hook + body + CTA), optional image brief, performance rationale, trigger link, estimated quality score

---

## What Inputs Are Used

| Input Source | Fields Used | How |
|---|---|---|
| Meta sync (14-day) | CTR, frequency, spend, impressions | Creative performance snapshot |
| CRM reconciliation | ROAS, CPA (7-day attribution) | CRM-verified — never Meta self-reported |
| Learning memory | winning_hook, winning_angle, poor_performer_pattern, audience_message_fit, experiment_pattern | `queryLearningsForBrief()` |
| Creative content | adCopy, callToAction, thumbnailUrl | Snapshot fields |
| Campaign context | campaignName, externalCampaignId | Snapshot fields |
| Goals | roasGoal, cpaGoal, primaryGoalType | Optional POST params |

**Attribution window:** 7 days (CRM-verified ROAS/CPA).

**Source of truth:** CRM for ROAS and CPA — Meta self-reported conversion data is never used.

---

## How Outputs Are Structured

### CreativeConcept

The primary output unit. Each concept contains:

```typescript
type CreativeConcept = {
  id:                   string;
  title:                string;              // e.g. "Variation A — Outcome-Led"
  angle:                CreativeAngle;       // message positioning strategy
  copyBlock:            CreativeCopyBlock;   // hook + body + CTA
  imageBrief?:          {                   // structured image direction
    conceptSummary:      string;
    visualChanges:       string;
    goal:                string;
    directResponseAngle: string;
  };
  performanceRationale: string;             // why this addresses the signal
  triggerLink:          string;             // e.g. "CTR 0.42% — hook weakness"
  estimatedScore:       number;             // 0–100 quality estimate
};
```

### CreativeCopyBlock

```typescript
type CreativeCopyBlock = {
  hook:          CreativeHook;    // scroll-stopping opening line
  body:          string;          // benefit-focused body text
  callToAction:  string;          // action-oriented CTA phrase
  angle:         CreativeAngle;   // strategic angle
  platformReady: boolean;         // within Meta primary_text limits (125 chars preview)
};
```

### CreativeVariant

Flat variant with workflow status:

```typescript
type CreativeVariant = {
  variantType: "copy" | "image" | "full_concept";
  status:      "generated" | "saved_draft" | "sent_to_scoring" | "sent_to_approval" | "edited";
  // ... copy fields or image brief fields
};
```

---

## Workflow Integration

### Save Draft
Sets `status = "saved_draft"`. Marks the variant as manually saved for later review.

### Send to Scoring
Sets `status = "sent_to_scoring"`. Routes to `/creative-lab/review` where heuristic scoring applies 9 dimensions (goal_alignment, hook_strength, offer_clarity, etc.).

### Send to Approval
Sets `status = "sent_to_approval"`. Routes to the approval workflow (`/portfolio/controls`) for buyer review before any publish action.

### Regenerate Variants
Clears the current output and re-triggers generation from the same context. Useful when output quality is below expectations.

### Edit Manually
Opens an inline editor for copy variants. Saves with `status = "edited"` and routes to approval.

---

## Limitations

1. **No image rendering** — image briefs are structured text descriptions for designers or image tools. No images are generated or uploaded.
2. **No auto-publish** — the engine generates concepts only. Publishing requires explicit approval workflow completion.
3. **Sparse data handling** — when performance history is limited (`dataQuality = "sparse"`), concepts are broadly framed. More data = more specific, grounded outputs.
4. **Learning memory dependency** — if no learnings exist, the engine generates without pattern context. Quality improves as the system accumulates approved creatives and experiment outcomes.
5. **CRM reconciliation required** — ROAS and CPA signals are only available after CRM reconciliation is run for the campaign. Unreconciled campaigns show `—` for ROAS/CPA.
6. **Attribution window** — all CRM-verified metrics use a 7-day attribution window. Campaigns newer than 7 days will have partial data.

---

## API Reference

### POST `/api/creative-lab/creative-engine`

Generates creative concepts from a performance context.

**Request body:**
```json
{
  "clientAccountId": "string",
  "snapshot": { /* CreativePerformanceSnapshot */ },
  "mode": "concepts | variants | copy_blocks",
  "triggerType": "fatigue | underperformance | opportunity | manual",
  "generationMode": "copy_variations | angle_variations | ...",
  "constraints": [],
  "roasGoal": 2.5,
  "cpaGoal": 35.0,
  "primaryGoalType": "roas"
}
```

**Response (success):**
```json
{
  "ok": true,
  "concepts": [ /* CreativeConcept[] */ ],
  "variants": [ /* CreativeVariant[] */ ],
  "summary": { /* CreativeGenerationRunSummary */ },
  "warnings": [ "..." ],
  "contextMeta": { /* key context fields for display */ }
}
```

---

## Architecture

```
CreativePerformanceSnapshot
  └─ buildCreativeGenerationContext()    ← lib/creativeGeneration/context.ts
       ├─ queryLearningsForBrief()       ← lib/learningMemory/aggregator.ts
       └─ CreativeGenerationContext

CreativeGenerationContext
  └─ generateCreativeConcepts()          ← lib/creativeGeneration/concepts.ts
       ├─ buildContextBrief()            ← lib/creativeGeneration/contextBrief.ts
       └─ generateCreativeDrafts()       ← lib/creativeGeneration/engine.ts
            ├─ Anthropic Claude API      (if ANTHROPIC_API_KEY configured)
            └─ Structured mock output   (if API not configured)

GenerationOutput
  ├─ CreativeConcept[]                   (full concept packages)
  ├─ CreativeVariant[]                   (flat variants)
  └─ CreativeGenerationRunSummary        (aggregate stats)
```

---

## Setup Requirements

1. **Meta sync** — run the Meta sync pipeline to populate `MetaSyncedInsight`, `MetaSyncedAd`, and `MetaSyncedCreative` tables.
2. **CRM reconciliation** — run reconciliation to populate `ReconciledCampaignPerformance` with CRM-verified ROAS and CPA.
3. **Anthropic API key** (optional) — set `ANTHROPIC_API_KEY` in `.env.local` to enable real AI generation. Without it, structured mock outputs are returned.
4. **Learning memory** — approve creatives, run experiments, and complete publish-prep workflows to accumulate learning entries that enrich future generation context.
