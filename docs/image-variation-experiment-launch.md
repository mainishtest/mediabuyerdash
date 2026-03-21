# Image Variation Experiment Launch Integration

## Overview

This layer bridges approved image variation candidates into the existing experiment launch system. It creates structured experiment launch plans with explicit controls, challengers, success criteria, guardrails, and readiness gates. No experiments are autonomously launched.

## How Approved Image Variations Become Experiment Launch Plans

### Flow

1. **Generate** image variations at `/creative-lab/image-variations`
2. **Review** and approve candidates at `/creative-lab/image-variations/review`
3. **Score** and rank candidates at `/creative-lab/image-variations/selection`
4. **Create launch plan** at `/creative-lab/image-variations/launch`
5. **Assign control**, map campaign/ad set, define success criteria
6. **Approve** when all guardrails pass → `ready_for_launch`
7. **Wire** to an ExperimentRecord for active testing (separate step)

### What Happens When a Plan Is Created

1. The approved candidate becomes the **challenger** variant
2. A default **hypothesis** is auto-generated from the variation intent and trigger type
3. **Success criteria** default to CRM-based ROAS (7-day attribution window)
4. **Guardrails** are evaluated automatically
5. **Readiness state** is computed (usually starts as `needs_mapping` or `draft`)

## Required Mappings

| Field | Required | Description |
|-------|----------|-------------|
| Challenger (image variation) | Yes | The approved candidate being tested |
| Control creative | Yes | The existing creative being measured against |
| Target campaign | Yes | Which Meta campaign the test runs in |
| Target ad set | Yes | Which Meta ad set the test runs in |
| Success criteria | Yes | Primary metric, threshold, minimums |
| Hypothesis | No (warning) | What you expect the test to show |

## Success Criteria Defaults

| Parameter | Default | Reason |
|-----------|---------|--------|
| Primary metric | `roas_7d` | CRM is source of truth |
| Secondary metrics | `cpa_7d`, `ctr` | Supporting signals |
| Guardrail metrics | `cpm` | Must not degrade |
| Success threshold | 10% relative lift | Minimum meaningful improvement |
| Min spend/variant | $50 | Statistical reliability |
| Min conversions/variant | 5 | CRM attribution reliability |
| Evaluation window | 7 days | **Enforced** — matches 7-day CRM attribution |

## Guardrails (7 Safety Gates)

| Guardrail | Required | Description |
|-----------|----------|-------------|
| Challenger assigned | Yes | Image variation must be assigned |
| Control assigned | Yes | Baseline creative must be assigned |
| Campaign + ad set mapped | Yes | Test must have a target |
| Success criteria defined | Yes | Must know how to judge success |
| Minimum spend ≥ $10 | Warning | Ensures meaningful data |
| Hypothesis defined | Warning | Best practice, not blocking |
| Not already launched | Yes | Prevents duplicate launches |

## What Makes a Plan Launch-Ready

A plan reaches `ready_for_launch` when:
- All **required** guardrails pass
- Control and challenger are both assigned
- Campaign and ad set are mapped
- Success criteria are defined
- Plan has been approved (if approval is required)

## Readiness States

| State | Meaning |
|-------|---------|
| `draft` | Created but missing key fields |
| `needs_mapping` | Variants assigned, no campaign/ad set mapping |
| `needs_approval` | Complete, awaiting human approval |
| `ready_for_launch` | Approved, all guardrails pass |
| `blocked` | Has blocking issues preventing progression |
| `launched` | Wired to an active ExperimentRecord |

## Architecture

- **No new Prisma models** — plans persist to the existing `ExperimentLaunchPlanRecord` table
- **Bridge layer** (`lib/imageVariation/experimentLaunch.ts`) takes image variation candidates and creates plans via the existing `buildCreativeExperimentLaunchPlan()`
- **Reuses** all existing experiment launch infrastructure (builder, mapping, criteria, guardrails, readiness, DB)
- Image variation plans distinguished by `challenger.variantType: "image"` and `challenger.briefDraftType: "image_variation"`

## Current Limitations

1. **No automatic launch** — plans must be manually wired to ExperimentRecord
2. **No results ingestion** — that comes in the next step
3. **Control must be manually identified** — no auto-detection of current best creative
4. **Campaign/ad set mapping is manual** — no auto-suggestion from existing campaigns
5. **Single challenger per plan** — no multi-variant experiments yet

## File Structure

```
lib/imageVariation/
  ├── experimentLaunch.ts  — Bridge from image variations to experiment launch
  └── index.ts             — Exports new functions

app/creative-lab/image-variations/
  ├── actions.ts           — Extended with launch actions
  └── launch/
      ├── page.tsx                         — Server component
      └── ImageVariationLaunchView.tsx     — Client launch view
```

## Next Steps

- Image variation results ingestion and asset-level outcome tracking
- Auto-detection of control creative from existing campaigns
- Campaign/ad set mapping suggestions
- Multi-variant experiment support
