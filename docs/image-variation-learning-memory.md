# Image Variation Learning Memory and Reuse Layer

## Overview

This layer captures closed-loop learnings from image variation test outcomes and makes them queryable and reusable inside Creative Lab, experiment planning, and generation workflows. Every surfaced learning is explainable and linked back to supporting evidence.

## What Image Variation Learning Memory Stores

Each learning entry captures:
- **What happened** — human-readable insight text (1-2 sentences)
- **Category** — what type of visual pattern was learned (e.g., winning_visual_hook, poor_performer_visual_pattern)
- **Pattern** — machine label for the visual direction tested (e.g., refresh_visual_hook)
- **Confidence** — how reliable the learning is (high/medium/low)
- **Evidence** — supporting signals (metric lifts, confidence scores, hypotheses)
- **Source** — which test/experiment produced this learning
- **Linkage** — related entities (experiment plan, experiment record, campaign)
- **Reusability flags** — whether the learning can be used in brief generation or scoring

## How Learnings Are Derived

### Source: Image Variation Experiment Outcomes

The 5th source extractor (`extractImageVariationLearnings()`) in `lib/learningMemory/extractor.ts` pulls from launched `ExperimentLaunchPlanRecord` entries with `challengerVariantType: "image"`:

1. **Challenger wins** → Maps the variation intent to a winning visual category:
   - `refresh_visual_hook` → `winning_visual_hook`
   - `refresh_composition` → `winning_composition`
   - `refresh_color_direction` → `winning_color_direction`
   - `refresh_product_focus` → `winning_product_focus`
   - `refresh_ugc_style` → `winning_ugc_style`
   - `full_visual_reset` → `refresh_pattern`

2. **Control holds** → `poor_performer_visual_pattern` — the visual direction didn't work

3. **No clear winner / mixed result** → `experiment_pattern` — inconclusive

4. **No result yet** → `launch_condition` — test launched, awaiting data

### Confidence Determination

| Condition | Confidence |
|-----------|------------|
| Challenger wins or control holds with ≥70% confidence | High |
| Challenger wins or control holds with <70% confidence | Medium |
| No clear winner or mixed result | Medium |
| Insufficient data or no result | Low |

### Evidence Signals

Each learning includes:
- Visual direction (the intent tested)
- Variant title
- Primary metric lift (if result available)
- Confidence percentage
- Hypothesis (if provided)

## Where Learnings Are Reused

### 1. Image Variation Generation Context

`lib/imageVariation/context.ts` already queries `queryLearningsForBrief()` which now includes image variation learnings. These flow into:
- `winningPatterns` — visual directions that worked (used in prompt generation)
- `losingPatterns` — visual directions that failed (avoided in generation)
- `experimentInsights` — general experiment outcomes

### 2. Learning Memory Page

`/insights/memory` — The unified learning memory page now includes image variation outcomes alongside campaign performance, experiment, publish, and automation learnings.

### 3. Image Variation Insights Page

`/creative-lab/image-variations/insights` — A dedicated view filtered to image variation learnings with:
- Category and confidence filters
- Summary stats (total, high-confidence, usable for briefs)
- Recurring patterns with occurrence counts
- Evidence-backed insight cards with expandable details

### 4. Experiment Planning

Image variation learnings with `usableForBriefs: true` (only challenger-wins outcomes) are surfaced when planning future experiments for the same client.

## What Confidence Means

| Level | Meaning |
|-------|---------|
| **High** | Strong evidence from a completed test with clear winner, ≥70% confidence score |
| **Medium** | Moderate evidence — test completed but result was close or mixed |
| **Low** | Weak evidence — test incomplete, insufficient data, or launch-only record |

## New Learning Categories (Image Variation)

| Category | Description |
|----------|-------------|
| `winning_visual_hook` | Visual scroll-stop element that drove engagement |
| `winning_composition` | Layout/hierarchy approach that improved performance |
| `winning_color_direction` | Color palette that improved metrics |
| `winning_product_focus` | Product emphasis approach that converted |
| `winning_ugc_style` | UGC aesthetic that performed well |
| `fatigue_prone_visual_pattern` | Visual approach that fatigues quickly |
| `poor_performer_visual_pattern` | Visual direction that underperformed |

## Architecture

- **5th source extractor** added to existing `lib/learningMemory/extractor.ts`
- **Wired into aggregator** — `queryLearningMemory()` now runs 5 extractors in parallel
- **No new Prisma models** — reads from existing `ExperimentLaunchPlanRecord` + `ExperimentResultRecord`
- **Extends existing types** — `LearningSourceType` and `LearningCategory` in `lib/learningMemory/types.ts` now include image variation values

## Current Limitations

1. **No autonomous decision-making** — learnings inform humans, not automated systems
2. **Confidence is heuristic** — based on outcome + test confidence, not statistical analysis
3. **No cross-client learning** — learnings are scoped per client
4. **Depends on experiment completion** — only produces high-confidence learnings after tests finish
5. **Visual category mapping is intent-based** — maps from generation intent, not actual visual analysis

## File Structure

```
lib/learningMemory/
  ├── types.ts       — MODIFIED: added image_variation_outcome source, 7 visual categories
  ├── extractor.ts   — MODIFIED: added extractImageVariationLearnings() (5th extractor)
  ├── aggregator.ts  — MODIFIED: wired 5th extractor into queryLearningMemory()
  └── patterns.ts    — MODIFIED: added labels and colors for new categories/sources

app/creative-lab/image-variations/
  ├── actions.ts     — MODIFIED: added loadImageVariationInsightsAction
  └── insights/
      ├── page.tsx                           — NEW: server component
      └── ImageVariationInsightsView.tsx     — NEW: client insights view
```

## Next Steps

- Image-variation-aware strategy copilot
- Asset-portfolio optimization workflows
- Cross-client learning aggregation (opt-in)
- Visual analysis integration for more precise category mapping
