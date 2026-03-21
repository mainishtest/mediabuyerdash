# AI Image Variation Generation Engine

## Overview

The Image Variation Engine generates structured image variation candidates tied to source creative performance signals, fatigue triggers, and Creative Lab workflows. It produces provider-ready image briefs (and actual images when an image provider is configured).

## How It Works

### Flow

1. **Select source creative** — Pick a creative from the performance snapshot list
2. **Choose variation intent** — What kind of visual change is needed
3. **Set trigger type** — Why the variation is needed (fatigue, underperformance, opportunity, manual)
4. **Generate candidates** — The engine assembles context, builds a prompt, calls the provider, and returns structured candidates
5. **Review candidates** — Each candidate includes a concept brief, rationale, and linkage back to source
6. **Save or send to review** — Candidates can be saved or forwarded to the review workflow

### Context Assembly

`buildImageVariationContext()` pulls from:

- **Source creative** — Current image, copy, CTA, thumbnail URL
- **Performance signals** — CTR, frequency, ROAS (CRM-verified, 7-day attribution), CPA, spend
- **Fatigue signals** — From the creative fatigue detection system
- **Learning memory** — Winning patterns, losing patterns, audience insights, experiment insights
- **Goals** — ROAS target, CPA target, primary goal type
- **Offer/audience context** — Optional summary of the offer and target audience
- **Brand constraints** — Brand colors, format requirements, compliance rules
- **Placement constraints** — Format or placement-specific requirements

### Variation Intents

| Intent | Description |
|--------|-------------|
| `refresh_visual_hook` | Scroll-stop power has decayed — redesign to earn attention |
| `refresh_offer_framing` | Reframe how the offer is visually communicated |
| `refresh_composition` | Change layout, hierarchy, or visual flow |
| `refresh_color_direction` | Shift palette for contrast or brand alignment |
| `refresh_product_focus` | Change product shot angle, context, or emphasis |
| `refresh_lifestyle_angle` | Shift lifestyle imagery or aspirational context |
| `refresh_ugc_style` | Move toward user-generated content aesthetic |
| `full_visual_reset` | Complete image concept replacement |

### Automatic Intent Selection

When no explicit intent is provided, `selectVariationIntent()` maps performance signals:

- **Fatigue + frequency > 5.0x** → `full_visual_reset`
- **Fatigue** → `refresh_visual_hook`
- **Underperformance + CTR < 0.5%** → `refresh_composition`
- **Underperformance** → `refresh_offer_framing`
- **Opportunity** → `refresh_product_focus`
- **Manual** → `refresh_visual_hook`

## Provider Integration

### Architecture

The engine uses an `ImageVariationProvider` interface:

```typescript
interface ImageVariationProvider {
  name: ImageVariationProviderType;
  isAvailable(): boolean;
  generateVariations(ctx, prompt, count): Promise<ImageVariationProviderResult>;
}
```

### Available Providers

| Provider | Status | Description |
|----------|--------|-------------|
| `brief_only` | Active | Generates structured briefs via Anthropic (or mock fallback). Always available. |
| `dalle` | Stub | OpenAI DALL-E 3 integration. Available when `OPENAI_API_KEY` is set. |
| `mock` | Active | Deterministic output for testing. |

### Adding a New Provider

1. Implement the `ImageVariationProvider` interface in `lib/imageVariation/providers.ts`
2. Add to the priority list in `resolveImageVariationProvider()`
3. Add config check to `lib/providerExecution/config.ts` if needed

### Provider Resolution

`resolveImageVariationProvider()` returns the best available provider in priority order:
1. DALL-E (if `OPENAI_API_KEY` is set)
2. Brief-only (always available — uses Anthropic for AI briefs, falls back to mock)

## Inputs

### Required

- **creativeId** — External creative ID from Meta sync
- **intent** — One of the 8 variation intents
- **triggerType** — `fatigue` | `underperformance` | `opportunity` | `manual`

### Optional

- **candidateCount** — Number of candidates to generate (default: 3)
- **constraints** — Brand, format, placement, compliance constraints
- **sourceAssetUrl** — URL of the source image
- **recommendationId** — Links to a source recommendation

## Outputs

### ImageVariationCandidate

Each candidate includes:

- **title** — Descriptive name (e.g., "Concept A — Clean Hero Focus")
- **conceptSummary** — 2-3 sentences describing the image concept
- **visualChanges** — What changes from the current creative
- **goal** — What the image is designed to do
- **directResponseAngle** — How the image supports the offer
- **imageUrl** — Generated image URL (null for brief-only mode)
- **rationale** — Why this variation was proposed
- **performanceSignal** — The performance signal that drove this concept
- **sourceCreativeId** — Links back to source creative
- **campaignId** — Links back to campaign
- **clientAccountId** — Links back to client

### ImageVariationGenerationSummary

Aggregate stats for the UI:
- Candidate count, provider, data quality, latency, warnings

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Enables AI-powered brief generation. Falls back to mock if not set. |
| `OPENAI_API_KEY` | No | Enables DALL-E image generation. Falls back to brief-only if not set. |

## Database

### ImageVariationRequest

Single table stores the full request lifecycle:

- Request metadata (intent, trigger, creative, campaign, client)
- Full context snapshot (JSON)
- Prompt sent to provider (JSON)
- Generated candidates (JSON array)
- Generation summary (JSON)
- Status, timing, error tracking

## Current Limitations

1. **No real image generation** — DALL-E provider is a stub. Only structured briefs are generated.
2. **No review workflow** — Candidates can be saved and sent to review, but the review/scoring/approval workflow is not yet implemented (planned for next phase).
3. **No publish-prep** — Generated candidates are not yet integrated into the publish-prep pipeline.
4. **Single source per request** — Each request generates variations for one source creative.
5. **No image analysis** — Source image is referenced by URL but not analyzed by vision AI.

## File Structure

```
lib/imageVariation/
  ├── types.ts       — All typed models (intent, context, candidate, provider, etc.)
  ├── context.ts     — Context assembly from performance + learning memory
  ├── prompts.ts     — Prompt construction per intent
  ├── providers.ts   — Provider abstraction (BriefOnly, DALL-E stub, Mock)
  ├── engine.ts      — Orchestrator (request → context → prompt → provider → normalize → persist)
  └── index.ts       — Public API exports

app/creative-lab/image-variations/
  ├── page.tsx                — Server component (loads snapshots + history)
  ├── ImageVariationView.tsx  — Client view (selector, settings, candidates, history)
  └── actions.ts              — Server actions (generate, save, send to review)

prisma/schema.prisma          — ImageVariationRequest model
```

## Next Steps (Phase 10)

- Image variation review, revision, and approval workflow
- Integration with publish-prep pipeline
- Real image generation via DALL-E or Stability AI
- Source image analysis via vision API
- Candidate scoring and ranking
