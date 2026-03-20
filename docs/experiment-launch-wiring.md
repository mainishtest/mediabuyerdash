# Experiment Launch Wiring for Approved Creative Drafts

Phase 8 — Creative Lab: Experiment Launch Wiring

---

## Overview

Experiment Launch Wiring bridges **approved creative drafts** into **structured experiment launch plans**. A launch plan defines what is being tested, against what (control vs challenger), where (campaign and ad set), and how success is measured — before any live test begins.

This is a planning and wiring layer. No experiments auto-launch. Human approval gates every transition.

---

## Workflow: Approved Draft → Experiment Launch Plan

```
Creative Lab
  → Brief Generation
  → Draft Scoring & Review
  → Publish Prep (approved_for_launch)
  → Experiment Launch Wiring  ← This step
  → ExperimentRecord (when launched)
  → Result Evaluation & Learnings
```

### Step-by-step

1. A creative draft is approved in the Draft Review page.
2. The draft is promoted to a **Publish Prep item** (PublishPrepRecord), where it passes validation and guardrail checks.
3. Once the prep item reaches `approved_for_launch`, a media buyer creates an **Experiment Launch Plan** via `/creative-lab/launch`.
4. The plan wires the approved draft as the **challenger creative**.
5. The buyer selects an existing creative as the **control**.
6. The buyer maps the test to a **target campaign and ad set**.
7. **Success criteria** and **guardrails** are defined (or auto-populated from defaults).
8. Readiness is computed. When all required guardrails pass and the plan is approved, it becomes `ready_for_launch`.
9. A human reviewer marks the plan as launched, which links it to an **ExperimentRecord** for live tracking.

---

## Required Mappings

Before a plan can reach `ready_for_launch`, all of the following must be set:

| Field | Description |
|---|---|
| `challenger.prepItemId` | Links to the approved PublishPrepRecord |
| `control.creativeId` or `control.adExternalId` | Identifies the baseline creative |
| `mapping.campaignId` or `mapping.campaignExternalId` | Target campaign for the test |
| `mapping.adSetId` or `mapping.adSetExternalId` | Target ad set for the test |
| `successCriteria.primaryMetric` | The metric that determines the winner |
| `successCriteria.successThreshold` | Minimum relative lift to declare a winner |

---

## Readiness State Machine

```
draft
  → (challenger + control assigned)
needs_mapping
  → (campaign + ad set mapped)
needs_approval  OR  blocked (if guardrails fail)
  → (human approves plan)
ready_for_launch
  → (linked to ExperimentRecord)
launched
```

States:

| State | Meaning |
|---|---|
| `draft` | Missing challenger or control creative |
| `needs_mapping` | Variants assigned but no campaign/ad set mapped |
| `needs_approval` | All required fields set — awaiting human sign-off |
| `ready_for_launch` | Approved and all guardrails pass — can create experiment |
| `blocked` | One or more required guardrails are failing |
| `launched` | Plan is live and linked to an ExperimentRecord |

---

## Success Criteria

Success criteria define what a winning result looks like:

| Field | Default | Notes |
|---|---|---|
| `primaryMetric` | `roas_7d` | CRM 7-day ROAS — source of truth |
| `secondaryMetrics` | `["cpa_7d", "ctr"]` | Tracked but not determining |
| `guardrailMetrics` | `["cpm"]` | Must not degrade |
| `successThreshold` | `0.10` (10% lift) | Minimum relative lift to declare winner |
| `minSpendPerVariant` | `$50` | Below this, data is unreliable |
| `minConversionsPerVariant` | `5` | Below this, evaluation is insufficient |
| `evaluationWindowDays` | `7` | **Always 7** — matches CRM 7-day attribution window |

The evaluation window is always 7 days to align with the CRM attribution policy. This cannot be overridden.

---

## Guardrails

Guardrails gate launch readiness. Required guardrails block progression if they fail.

| Key | Required | Description |
|---|---|---|
| `challenger_assigned` | Yes | Challenger creative must be linked from publish-prep |
| `control_assigned` | Yes | Control creative must be identified |
| `mapping_complete` | Yes | Campaign and ad set must both be mapped |
| `success_criteria_set` | Yes | Primary metric, threshold, and window must be defined |
| `min_spend_threshold` | No (warning) | Spend floor below $10 is flagged as a risk |
| `hypothesis_defined` | No (warning) | Hypothesis is best practice for learning value |
| `not_already_launched` | Yes | Prevents double-launch |

---

## What Makes a Plan Launch-Ready

A plan reaches `ready_for_launch` when:

1. All required guardrails pass
2. A human reviewer has approved it (approvedAt is set)
3. The plan is not already launched

---

## Architecture

```
types/experimentLaunch.ts          — pure TypeScript models
lib/experimentLaunch/
  builder.ts                       — buildCreativeExperimentLaunchPlan()
  mapping.ts                       — buildCreativeExperimentMapping()
  criteria.ts                      — buildCreativeExperimentSuccessCriteria(), buildCreativeExperimentGuardrails()
  readiness.ts                     — computeCreativeExperimentLaunchReadiness(), summarizeCreativeExperimentLaunchPlan()
  db.ts                            — persistence (ExperimentLaunchPlanRecord)
  index.ts                         — public exports
app/api/creative-lab/launch/
  route.ts                         — GET (list), POST (create)
  [id]/route.ts                    — GET (detail), PATCH (update + recompute readiness)
app/creative-lab/launch/
  page.tsx                         — server component, loads plans
  LaunchWiringView.tsx             — client orchestrator
  LaunchPlanCard.tsx               — list card
  LaunchPlanDetail.tsx             — detail panel
prisma/schema.prisma               — ExperimentLaunchPlanRecord model
prisma/migrations/
  add_experiment_launch_plan.sql   — CREATE TABLE migration
```

---

## Linkage to Other Modules

| Module | Relationship |
|---|---|
| PublishPrepRecord | Source of challenger creative — plan.prepItemId links here |
| CreativeBriefRecord | Source brief — plan.briefId links here |
| ExperimentRecord | Target — linkedExperimentId set when plan is launched |
| ExperimentLearningRecord | Learnings from completed experiments feed back into brief generation |

---

## Current Limitations

- **No automatic experiment creation**: A human must manually link the plan to an ExperimentRecord. Auto-wiring is not implemented.
- **Control creative selection is manual**: The buyer must identify the existing creative to use as control. No automated control selection.
- **No Meta API calls**: Launch wiring prepares the plan, but does not trigger any Meta ad operations. That happens via Publish Prep and the guarded publish workflow.
- **No live performance data in this view**: Performance ingestion happens in the Experiments module after the test is live.
- **Challenger ad external ID not auto-populated**: After the challenger is live in Meta, the `challengerAdExternalId` must be set manually until Meta write-back is implemented.

---

## Next Step

Phase 8 continues with **Creative Performance Results Ingestion and Test Outcome Tracking**, which will ingest live Meta delivery + CRM conversion data into ExperimentRecords linked from these launch plans.
