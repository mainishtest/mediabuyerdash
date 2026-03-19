# Creative Draft Scoring and Approval Readiness

This document covers how generated creative draft variants are scored, ranked, and evaluated for approval readiness before entering the publish preparation workflow.

---

## Overview

After AI drafts are generated from a creative brief, the scoring layer evaluates each variant across nine quality dimensions and produces:

- A **total weighted score** (0–100)
- A per-dimension breakdown with explanations
- An **approval readiness state** (one of four levels)
- A **risk level** (low / medium / high)
- A **ranked list** of all variants, best first
- Structured **strengths** and **risks** narratives

Scoring is **deterministic and heuristic** — no AI API calls are required. The same variant and brief context always produce the same score. This makes scoring fast, consistent, and transparent.

---

## Scoring Dimensions

Nine dimensions are evaluated. Each returns a raw score from 0 to 10.

| Dimension | What it measures |
|---|---|
| **goal_alignment** | Does the variant type and content match the generation intent and brief direction? |
| **hook_strength** | How strong is the opening hook? (Copy variants only) |
| **offer_clarity** | How clearly does the offer or value proposition come through? |
| **message_clarity** | Overall readability, sentence structure, and body development |
| **angle_novelty** | How different is this variant from the source creative (by word overlap)? |
| **fatigue_separation** | How well does the variant separate from the fatigued creative, weighted by fatigue severity? |
| **brand_fit** | Alignment with brand voice and constraints (defaults to 7/10 without explicit guidelines) |
| **policy_risk** | Compliance signal — **higher score = lower risk**. Checks for superlatives, guarantees, sensitive claims |
| **launch_readiness** | Are all required fields present? (hook + body + CTA for copy; concept + visual changes + goal + DR angle for image) |

### Scoring Weights by Variant Type

Weights reflect which dimensions matter most for each format.

**Copy variants:**
| Dimension | Weight |
|---|---|
| hook_strength | 0.20 |
| goal_alignment | 0.15 |
| angle_novelty | 0.15 |
| offer_clarity | 0.12 |
| policy_risk | 0.10 |
| message_clarity | 0.10 |
| fatigue_separation | 0.08 |
| launch_readiness | 0.05 |
| brand_fit | 0.05 |

**Image brief variants:**
| Dimension | Weight |
|---|---|
| offer_clarity | 0.25 |
| goal_alignment | 0.20 |
| message_clarity | 0.15 |
| angle_novelty | 0.15 |
| fatigue_separation | 0.08 |
| policy_risk | 0.07 |
| launch_readiness | 0.05 |
| brand_fit | 0.05 |
| hook_strength | 0.00 (not applicable) |

**Total score = sum of (raw score × weight × 10)**, producing a 0–100 composite.

---

## Scoring Signals Used

The scorer draws from the following inputs, all sourced from the brief:

| Signal | Source |
|---|---|
| Generation intent | `brief.intent` |
| Variant type (copy / image) | `variant.variantType` |
| Source ad copy | `brief.input.adCopy` |
| Source CTA | `brief.input.callToAction` |
| Fatigue status | `brief.input.fatigueStatus` |
| Average frequency | `brief.input.avgFrequency` |
| ROAS / CPA | `brief.input.campaignRoas` / `brief.input.crmCpa` (CRM-sourced) |

> **Important:** ROAS and CPA are always from the CRM (Shopify / source-of-truth system), not from Meta self-reported attribution. The 7-day attribution window applies to all performance context.

---

## Approval Readiness States

| State | Conditions |
|---|---|
| `ready_for_publish_prep` | Total ≥ 72 **AND** policy_risk ≥ 7 **AND** launch_readiness ≥ 7 |
| `conditionally_ready` | Total ≥ 55 **AND** policy_risk ≥ 5 **AND** launch_readiness ≥ 5 |
| `review_required` | Total ≥ 35 (does not meet conditionally_ready thresholds) |
| `not_ready` | Total < 35 |

Readiness gates are intentionally conservative. `ready_for_publish_prep` does **not** mean the variant is approved or will be launched — it means it has passed quality thresholds and a human reviewer can send it into publish preparation.

---

## Risk Levels

| Level | Conditions |
|---|---|
| `high` | policy_risk score < 4 OR total score < 35 |
| `medium` | policy_risk < 7 OR total score < 55 |
| `low` | policy_risk ≥ 7 AND total score ≥ 65 |

Policy risk checks include: guaranteed results claims, percentage claims combined with "free/safe/effective", cure language, debt elimination, "get rich" framing, work-from-home income claims, weight loss specifics, and urgency/scarcity patterns.

---

## Ranking Logic

Variants within a brief are ranked by the following priority:

1. **Total score** — descending (highest score = rank #1)
2. **Readiness priority** — `ready_for_publish_prep` > `conditionally_ready` > `review_required` > `not_ready`
3. **Angle novelty** — descending (fresher angles preferred in ties)
4. **Variant ID** — ascending (stable, deterministic tie-break)

The rank reason for each variant is shown in the ranking list to explain why it was placed there.

---

## Review Actions

Reviewers can take the following actions from the `/creative-lab/review` page:

| Action | Effect |
|---|---|
| **Approve for publish prep** | Marks variant as `approve` in the DB — eligible for the next publish preparation step |
| **Needs revision** | Marks variant as `request_revision` — surfaces for revision before resubmission |
| **Reject** | Marks variant as `reject` — removed from active consideration |
| **Regenerate (same brief)** | Navigates to generation page for the same brief |
| **Regenerate (new angle)** | Navigates to generation page for a different angle/mode |

> **None of these actions publish to Meta or mutate live campaigns.** The publish preparation step is a separate, future workflow.

---

## How to Navigate to the Review Page

From **Creative Briefs** (`/creative-lab/briefs`):
- Open any brief with generated variants
- Click **"Score & Review →"** in the Brief Actions panel

From **AI Generation** (`/creative-lab/generation`):
- After generating drafts, click **"◈ Score & Review"** in the controls bar

Direct URL: `/creative-lab/review?briefId=<briefId>`

---

## API

### `POST /api/creative-lab/scoring`

Scores and ranks all draft variants for a brief.

**Request body:**
```json
{ "briefId": "clx..." }
```

**Response:**
```json
{
  "ok": true,
  "briefId": "clx...",
  "reviewSet": {
    "briefId": "clx...",
    "rankings": [...],
    "summary": {
      "totalVariants": 4,
      "readyForPublishPrep": 1,
      "conditionallyReady": 2,
      "reviewRequired": 1,
      "notReady": 0,
      "highRisk": 0,
      "topRankedVariantId": "v-...",
      "averageScore": 68
    },
    "scoredAt": "2026-03-19T..."
  }
}
```

No DB writes — scores are computed on demand and are deterministic.

---

## Key Files

| File | Purpose |
|---|---|
| `types/creativeScoring.ts` | All typed models for scoring, ranking, readiness |
| `lib/creativeScoring/scorer.ts` | Pure scoring functions — one per dimension |
| `lib/creativeScoring/ranking.ts` | Ranking, readiness computation, review set assembly |
| `lib/creativeScoring/index.ts` | Public API exports |
| `app/api/creative-lab/scoring/route.ts` | POST endpoint — loads brief, scores, ranks |
| `app/creative-lab/review/page.tsx` | Server component — brief loading and page shell |
| `app/creative-lab/review/ReviewView.tsx` | Client orchestrator — scoring trigger + layout |
| `app/creative-lab/review/DraftScorecardPanel.tsx` | Single variant's full scorecard + actions |
| `app/creative-lab/review/DraftRankingList.tsx` | Compact ranked list with readiness indicators |

---

## Current Limitations

- **Heuristic scoring only** — scores are based on rule-based signals, not semantic AI evaluation. A future step can add AI-assisted scoring for richer context.
- **Brand fit defaults to 7/10** — without explicit brand guidelines configured, brand fit cannot be verified. Adding brand constraint types will improve this dimension.
- **Policy risk is pattern-based** — the checker catches common patterns but is not a legal compliance tool. Human review remains required for policy-sensitive categories.
- **No persistence** — scores are computed on demand and not stored. Rescoring the same brief always recomputes from current variant content.
- **Novelty is text-overlap based** — angle novelty compares word overlap with the source ad copy. It does not understand semantic similarity (same idea, different wording).
- **Image briefs score concept fields only** — image quality cannot be evaluated without rendered image assets.

---

## Next Step: Publish Preparation

The scoring and approval readiness layer is designed to feed the next workflow:

- Variants marked `ready_for_publish_prep` are eligible to enter the guarded publish preparation step
- The publish preparation step will assemble final Meta-ready creative payloads
- No Meta API mutations happen in this scoring layer

See the publish preparation documentation (to be added) for the next phase.
