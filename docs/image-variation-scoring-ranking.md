# Image Variation Scoring, Ranking, and Publish-Prep Integration

## Overview

This layer scores approved image variation candidates, ranks them, computes readiness, and enables handoff into the existing publish-prep workflow. No candidates are auto-published or autonomously selected.

## How Approved Image Variations Are Scored

### Scoring Flow

1. Candidates are approved in the review workflow (`/creative-lab/image-variations/review`)
2. Navigate to `/creative-lab/image-variations/selection`
3. Select a request with approved candidates
4. System scores each approved candidate on 9 dimensions
5. Candidates are ranked by weighted composite score
6. Readiness state is computed per candidate

### Score Dimensions (9 total, sum to 1.0)

| Dimension | Weight | Description |
|-----------|--------|-------------|
| `source_goal_alignment` | 0.20 | Match between variation and generation intent/trigger |
| `visual_distinctiveness` | 0.18 | Difference from source creative |
| `offer_clarity` | 0.15 | Offer/value proposition clarity in visual |
| `fatigue_separation` | 0.10 | Distance from fatigued source patterns |
| `brand_fit` | 0.08 | Brand visual language alignment |
| `policy_risk` | 0.08 | Compliance signal (higher = safer) |
| `recommendation_fit` | 0.07 | Alignment with recommendation reason |
| `format_readiness` | 0.07 | All required brief fields present |
| `launch_readiness` | 0.07 | Overall readiness for next step |

### Scoring Method

- **Deterministic heuristics** — same input always produces same output
- **No AI API calls** — scoring runs instantly at query time
- **Context-aware** — uses generation context (trigger type, data quality, constraints)
- Per-dimension score: 0–10 raw, weighted, contributes to 0–100 composite
- Pass threshold: ≥ 4 per dimension

## What Ranking and Readiness Mean

### Ranking Sort Order

1. **Primary**: Total score DESC
2. **Secondary**: Readiness priority ASC (ready_for_publish_prep first)
3. **Tertiary**: Visual distinctiveness score DESC
4. **Quaternary**: Candidate ID ASC (stable tie-break)

### Readiness States

| State | Threshold | Meaning |
|-------|-----------|---------|
| `ready_for_publish_prep` | Score ≥ 72, policy ≥ 7, launch ≥ 7 | Strong candidate — can proceed to publish prep |
| `conditionally_ready` | Score ≥ 55, policy ≥ 5, launch ≥ 5 | Acceptable with noted weaknesses |
| `review_required` | Score ≥ 35 | Needs further human review |
| `not_ready` | Score < 35 | Critical issues — do not proceed |
| `blocked` | Policy ≤ 2 or format ≤ 2 | Critical failure — cannot proceed until resolved |

Thresholds match the existing creative scoring system (72/55/35).

### Risk Levels

| Risk | Condition |
|------|-----------|
| `low` | Policy ≥ 7 AND score ≥ 55 |
| `medium` | Policy ≥ 5 OR score ≥ 55 (but not both high) |
| `high` | Policy < 5 OR score < 35 |

## How Publish-Prep Handoff Works

1. Candidate is scored and ranked
2. If readiness is `ready_for_publish_prep` or `conditionally_ready`, the "Select for Publish Prep" button is available
3. Clicking creates an `ImageVariationPublishPrepLink` that captures:
   - candidate ID, request ID
   - source creative, campaign, client
   - readiness state and total score
   - timestamp
4. The link connects the image variation candidate into the existing publish-prep workflow
5. No direct Meta publishing occurs — handoff is to publish preparation only

## What Blockers Can Prevent Handoff

- No approved candidates to score
- No candidates meet the publish-prep readiness threshold (score < 72)
- High-risk candidates (policy risk score < 5)
- Critical policy or format failures (score ≤ 2 = blocked state)
- Missing brief fields (format readiness failure)

## Current Limitations

1. **Heuristic scoring only** — no ML-based scoring; designed to be augmented later
2. **No auto-selection** — all publish-prep selections require human action
3. **No direct publishing** — selection creates a link, not a published ad
4. **Brief-only candidates** — candidates without generated images score lower on launch readiness
5. **No brand guideline enforcement** — brand_fit scored on concept coherence, not actual brand rules
6. **Score persistence** — scores are computed at query time, not stored; re-scoring may vary if context changes

## File Structure

```
lib/imageVariation/
  ├── scoringTypes.ts   — Score dimensions, scorecard, readiness, ranking, publish-prep link types
  ├── scoring.ts        — Scoring engine, ranking, readiness computation, publish-prep linkage
  └── index.ts          — Exports all scoring types and functions

app/creative-lab/image-variations/
  ├── actions.ts        — Extended with scoring server actions
  └── selection/
      ├── page.tsx                           — Server component
      └── ImageVariationSelectionView.tsx    — Client selection view
```

## Next Steps

- Image-variation-aware experiment launch integration
- Closed-loop asset learning from published variation performance
- ML-augmented scoring replacing heuristic dimensions
- Persistent score storage for historical tracking
