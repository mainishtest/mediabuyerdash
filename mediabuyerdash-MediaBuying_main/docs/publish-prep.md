# Guarded Publish Preparation and Meta Launch Workflow

This document covers how approved creative draft variants move through the publish preparation pipeline — from approval to a validated, guardrail-checked launch plan ready for human-reviewed publication.

---

## Overview

The publish preparation layer sits between the **draft review step** and **actual Meta publication**. It does not make autonomous launch decisions and does not call Meta ad creation APIs without explicit human action.

The pipeline:

```
Approved draft variant (from review)
        ↓
Create PublishPrepItem  ← POST /api/creative-lab/publish-prep
        ↓
Run validation checks   ← validateCreativeDraftForPublish()
        ↓
Run guardrail checks    ← evaluatePublishGuardrails()
        ↓
Derive status           ← deriveStatusFromResults()
        ↓
Human review on /creative-lab/publish-prep
        ↓
Set target mapping      ← select campaign + ad set
        ↓
Approve for launch      ← human clicks "Approve for Launch"
        ↓
"Publish Now" fires     ← only if all guardrails pass
        ↓
Status: published       ← payload preview used for Meta Ads Manager
```

---

## What Publish Prep Assembles

For each approved variant, the system assembles:

| Field | Source |
|---|---|
| Source brief context | `CreativeBrief.input` — CRM ROAS/CPA, performance context |
| Source creative content | `CreativeDraftVariant` — hook, body, CTA (copy) or concept, changes (image) |
| Target mapping | Human-selected: campaign ID, ad set ID, destination URL, CTA type |
| Meta payload preview | Assembled from variant + mapping — ready for review or manual entry |
| Validation results | 7 checks — required fields, approved state, policy risk, target mapping |
| Guardrail results | 7 checks — human approval, validation pass, execution mode, target presence |
| Approval state | Set explicitly by human reviewer |

> **Note:** ROAS and CPA in the source context are always from the CRM (Shopify), not Meta self-reported. The 7-day attribution window applies throughout.

---

## Status Lifecycle

| Status | Meaning |
|---|---|
| `draft` | Assembled but validation not yet run |
| `validating` | Client-side optimistic state during validation run |
| `blocked` | Validation or guardrail failures — must be resolved before proceeding |
| `ready_for_approval` | All validation checks passed — awaiting human approval |
| `approved_for_launch` | Human approved — awaiting final "Publish Now" action |
| `ready_to_publish` | All guardrails pass — launch action is available |
| `publish_failed` | A publish attempt was made but failed |
| `published` | Marked as published — payload prepared for Meta Ads Manager |

Status is **derived automatically** from the current validation + guardrail state and approval flag. It is never set manually except for `published` and `publish_failed`.

---

## Validation Checks

Validation runs when the prep item is created and re-runs when the target mapping is updated.

| Check | Blocking? | Condition |
|---|---|---|
| `required_fields` | Yes | All required fields present for variant type (hook/body/CTA or concept/changes/goal) |
| `supported_draft_type` | Yes | Brief draft type is supported (all current types are) |
| `approved_review_state` | Yes | Variant must have `reviewDecision === "approve"` |
| `no_policy_flags` | Yes | No high-risk patterns (guarantees, cure claims, etc.) |
| `target_campaign_present` | Yes | A target campaign is mapped |
| `target_ad_set_present` | Yes | A target ad set is mapped |
| `destination_url` | Warning | URL is present and starts with `https://` (not blocking for awareness ads) |

All **blocking** checks must pass for status to advance past `blocked`.

---

## Guardrail Checks

Guardrails run after validation and gate the launch action.

| Guardrail | Required | Condition |
|---|---|---|
| `human_approval_required` | Yes | `approvedForLaunch` must be `true` |
| `validation_must_pass` | Yes | All validation checks passed |
| `allowed_execution_mode` | Yes | Mode is `manual_publish` or `guarded_publish` |
| `target_entities_mapped` | Yes | Both campaign and ad set are mapped |
| `no_active_publish_failure` | No (warning) | No previous failed publish attempt |
| `not_already_published` | Yes | Item has not already been published |
| `client_account_present` | Yes | `clientAccountId` is set |

All **required** guardrails must pass for `canProceedToLaunch()` to return `true`.

---

## Execution Modes

| Mode | Behaviour |
|---|---|
| `manual_publish` | Reviewer manually creates the ad in Meta Ads Manager using the payload preview |
| `guarded_publish` | System marks the item as published after all guardrails pass — payload prepared for the human |

In the current version, "Publish Now" marks the status as `published` and provides the full payload preview. Actual Meta ad creation (calling `adcreatives`, `ads` endpoints) is the next workflow step.

---

## Meta Payload Preview

The payload preview is assembled from the variant content and target mapping into the shape that Meta Ads Manager expects:

| Field | Source |
|---|---|
| `adMessage` | hook + body joined with `\n\n` (primary text) |
| `adHeadline` | variant title |
| `adDescription` | body copy |
| `ctaText` | callToAction field |
| `ctaType` | inferred from CTA text (SHOP_NOW, LEARN_MORE, GET_OFFER, etc.) |
| `destinationUrl` | from target mapping |
| `adSetId` | Meta ad set external ID |
| `campaignId` | Meta campaign external ID |
| `imageNote` | concept summary + visual changes (for image brief variants) |

The payload is surfaced for human review before any action is taken. It does not call Meta.

---

## Review Actions

| Action | API Call | Effect |
|---|---|---|
| **Approve for Launch** | `PATCH /api/creative-lab/publish-prep/[id]` `{ action: "approve" }` | Sets `approvedForLaunch = true`, re-evaluates status |
| **Send Back** | `PATCH ... { action: "reject" }` | Resets `approvedForLaunch`, returns to `draft` |
| **Edit Mapping** | `PATCH ... { action: "set_target", ... }` | Updates target campaign/ad set, re-runs validation |
| **Save Notes** | `PATCH ... { action: "set_notes", notes }` | Updates launch notes |
| **Publish Now** | `PATCH ... { action: "publish" }` | Re-checks guardrails, marks as `published` |

---

## How to Navigate to Publish Prep

**From Draft Review** (`/creative-lab/review`):
- Click "Approve for Publish Prep" on a scored variant
- A prep item is created automatically and a link to the prep page appears

**Direct URL:** `/creative-lab/publish-prep`

**Filtered by client:** `/creative-lab/publish-prep?clientAccountId=<id>`

---

## API

### `GET /api/creative-lab/publish-prep`
List prep items. Optional query params: `clientAccountId`, `briefId`, `status`.

### `POST /api/creative-lab/publish-prep`
Create a new prep item.

**Request:**
```json
{
  "briefId": "...",
  "variantId": "...",
  "executionMode": "manual_publish",
  "targetCampaignExternalId": "...",
  "targetAdSetExternalId": "...",
  "destinationUrl": "https://...",
  "launchNotes": "..."
}
```

### `GET /api/creative-lab/publish-prep/[id]`
Load a single prep item.

### `PATCH /api/creative-lab/publish-prep/[id]`
Actions: `approve`, `reject`, `set_target`, `set_notes`, `publish`.

---

## Key Files

| File | Purpose |
|---|---|
| `types/publishPrep.ts` | All typed models |
| `lib/publishPrep/builder.ts` | `buildPublishPrepItem()`, `buildPublishPayloadPreview()` |
| `lib/publishPrep/validator.ts` | `validateCreativeDraftForPublish()`, `validateTargetMapping()`, `summarizePublishBlockers()` |
| `lib/publishPrep/guardrails.ts` | `evaluatePublishGuardrails()`, `canProceedToLaunch()`, `deriveStatusFromResults()` |
| `lib/publishPrep/db.ts` | `PublishPrepRecord` CRUD |
| `app/api/creative-lab/publish-prep/route.ts` | GET + POST |
| `app/api/creative-lab/publish-prep/[id]/route.ts` | GET + PATCH |
| `app/creative-lab/publish-prep/page.tsx` | Server component |
| `app/creative-lab/publish-prep/PublishPrepView.tsx` | Client orchestrator |
| `app/creative-lab/publish-prep/PublishPrepDetail.tsx` | Full detail + actions |
| `app/creative-lab/publish-prep/PublishPrepItemCard.tsx` | Compact list card |

---

## DB Setup Required

The `PublishPrepRecord` model was added to the Prisma schema. Run the following when the Neon database is reachable:

```bash
npx prisma db push
```

or for a tracked migration:

```bash
npx prisma migrate dev --name add-publish-prep-record
```

---

## Current Limitations

- **No actual Meta ad creation** — "Publish Now" marks the item as published but does not call the Meta Ads Manager API to create an ad. Manual creation using the payload preview is required. Meta ad creation API integration is the next workflow step.
- **No campaign/ad set selector from DB** — Target mapping is entered manually (Meta external IDs). A future improvement is a campaign picker loaded from `MetaSyncedCampaign`.
- **One prep item per variant** — The system does not prevent creating multiple prep items for the same variant. Deduplication on `(briefId, variantId)` is a future improvement.
- **Image brief publishing** — Image brief variants produce concept + visual direction. Actual image asset upload to Meta is not part of this workflow.
- **Execution mode `guarded_publish`** — Functionally identical to `manual_publish` in this version. The distinction gates future automated publish behavior.

---

## Next Step: Experiment Planning

The publish preparation layer is designed to feed the next workflow:

- Published prep items can seed experiment plans (A/B tests, holdout tests)
- The experiment planner will track which creative variants are live and compare CRM outcomes against source performance
- Attribution uses the same 7-day window as the scoring and brief context
