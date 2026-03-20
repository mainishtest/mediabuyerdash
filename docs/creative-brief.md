# Creative Brief Generation and Review Workflow

## Overview

The Creative Brief system converts performance signals and fatigue context into structured, reviewable creative refresh briefs. Each brief contains a structured document with sections, generated draft variants, and a full review workflow.

Briefs are generated from the **Creative Refresh Queue** and reviewed in the **Creative Briefs** section of Creative Lab (`/creative-lab/briefs`).

---

## How Briefs Are Generated

### Trigger points

Briefs are generated when a user clicks a generation action on a Refresh Queue item:

- **3 Copy Variations** — `POST /api/creative-lab/briefs` with `draftType: "copy_variation"`
- **3 Headline Variations** — `POST /api/creative-lab/briefs` with `draftType: "headline_variation"`
- **3 Image Variation Briefs** — `POST /api/creative-lab/briefs` with `draftType: "image_brief"`
- **Full Refresh Brief** — `POST /api/creative-lab/briefs` with `draftType: "full_refresh_brief"`

After a successful generation the user is navigated to `/creative-lab/briefs` filtered by the relevant client.

### What inputs are used

The `buildCreativeBriefInput()` function assembles the following context from the queue item:

| Input field | Source |
|---|---|
| `clientAccountId` / `clientName` | Client identity |
| `campaignId` / `campaignName` | Campaign linkage |
| `creativeId` / `creativeName` | Creative identity |
| `spend`, `impressions`, `clicks`, `avgCtr` | 14-day performance window |
| `avgFrequency` | Meta frequency signal |
| `campaignRoas`, `campaignCpa` | **CRM-verified** — not Meta self-reported |
| `fatigueStatus` | From creative fatigue detection module |
| `evaluationStatus` | From creative performance evaluation module |
| `priorityReason` | Derived priority explanation from refresh queue |
| `signalLabels` | Source signal labels that triggered this item |
| `recommendedActionType` | Recommended action from refresh queue |
| `recommendationRationale` | Rationale text from refresh queue |
| `adCopy`, `callToAction`, `thumbnailUrl` | Existing creative content |
| `notes` | Optional user notes |

### Generation intent inference

`inferGenerationIntent()` selects the generation strategy based on fatigue + performance signals:

| Condition | Intent |
|---|---|
| Severe fatigue OR (weak evaluation AND ROAS < 1.0) | `full_reset` |
| Fatigued AND frequency > 3.5 AND CTR < 0.8% | `refresh_visual_direction` |
| Fatigued OR frequency > 3.5 | `refresh_angle` |
| CTR < 0.8% | `refresh_hook` |
| Watching AND ROAS ≥ 2.0 | `preserve_winner_pattern` |
| Default | `refresh_hook` |

---

## Draft Types Supported

| Draft Type | Description | Variant format |
|---|---|---|
| `copy_variation` | 3 variations of full ad copy | hook + body + CTA |
| `headline_variation` | 3 headline-focused variations | hook + body + CTA |
| `angle_variation` | 3 angle / positioning variations | hook + body + CTA |
| `image_brief` | 3 image direction briefs | conceptSummary + visualChanges + goal |
| `full_refresh_brief` | Comprehensive refresh brief with all variant types | Mixed |

---

## Review Workflow

### Brief statuses

| Status | Meaning |
|---|---|
| `draft` | Freshly generated, not yet reviewed |
| `in_review` | Reviewer has opened and started reviewing |
| `approved` | Brief approved and ready for production |
| `revision_requested` | Returned for changes |
| `rejected` | Brief rejected outright |

### Variant-level decisions

Each draft variant can be reviewed independently:

| Decision | Meaning |
|---|---|
| `approve` | This variant is ready for use |
| `reject` | This variant is not suitable |
| `request_revision` | Needs changes before use |

### Review actions available on the brief

- **Start Review** — moves `draft` → `in_review`
- **Approve Brief** — moves `in_review` → `approved`
- **Request Revision** — moves any status → `revision_requested`
- **Reject Brief** — moves any status → `rejected`
- **Return to Draft** — resets to `draft`

---

## Architecture

```
types/creativeBrief.ts          — all typed models
lib/creativeBrief/
  briefs.ts                     — pure generation functions (no DB, no side effects)
  db.ts                         — Prisma read/write for briefs and variants
  index.ts                      — public re-exports

app/api/creative-lab/
  briefs/route.ts               — POST: generate + persist a brief
  briefs/[id]/route.ts          — PATCH: update status or variant review

app/creative-lab/briefs/
  page.tsx                      — server component (loads clients + briefs)
  BriefsView.tsx                — client orchestrator (filter, list, detail)
  BriefCard.tsx                 — compact queue list card
  BriefDetail.tsx               — full detail panel with review controls
```

Generation logic (`briefs.ts`) is completely decoupled from UI and DB layers.
Review workflow (`db.ts` + API routes) is separate from generation logic.

---

## Database Models

Two Prisma models back this feature:

### `CreativeBriefRecord`

Stores the brief document and metadata.

| Field | Description |
|---|---|
| `id` | Unique brief ID |
| `clientAccountId` | Client this brief belongs to |
| `campaignId` | Linked campaign (optional) |
| `creativeId` | Linked source creative (optional) |
| `sourceItemId` | Linked refresh queue item ID |
| `draftType` | One of the supported draft types |
| `intent` | Inferred generation intent |
| `status` | Current review status |
| `briefJson` | Serialised brief sections and input snapshot |
| `notes` | Optional user notes |

### `CreativeDraftVariantRecord`

Stores each generated draft variant.

| Field | Description |
|---|---|
| `id` | Unique variant ID |
| `briefId` | Parent brief |
| `variantType` | `"copy"` or `"image"` |
| `title` | Variant display title |
| `contentJson` | Serialised copy fields or image brief fields |
| `reviewDecision` | `approve`, `reject`, or `request_revision` |
| `reviewNote` | Optional reviewer note |
| `reviewedAt` | Timestamp of review decision |

---

## Linkage to Creative Lab and Refresh Queue

- Briefs are linked to the source refresh queue item via `sourceItemId`
- Briefs can be navigated from the Refresh Queue item detail panel (View Briefs link)
- Briefs link back to Creative Lab, Refresh Queue, and the source Campaign via navigation links in the detail panel
- The Creative Lab main page links to Creative Briefs in both the header and the bottom navigation

---

## Current Limitations

1. **No Meta publishing** — briefs and variants are not published to Meta. This is intentional.
2. **No auto-approval** — all review decisions require manual action.
3. **No image rendering** — image brief variants contain textual direction only; actual image creation is out of scope.
4. **No AI generation** — draft variants are built via deterministic template logic reusing `copyVariationGenerator` and `imageVariationGenerator`. AI-powered generation is the next phase.
5. **No autonomous generation loops** — briefs are only generated on explicit user action.
6. **CRM dependency** — ROAS and CPA context is only available when CRM sync is up to date.
7. **Stale sync** — brief inputs snapshot performance data at the time of generation; they do not auto-update.

---

## Setup

No additional configuration is required beyond standard project setup. The Prisma models (`CreativeBriefRecord`, `CreativeDraftVariantRecord`) must be migrated:

```bash
npx prisma migrate dev --name add-creative-briefs
```

After migration, the brief generation and review workflow is available at `/creative-lab/briefs`.
