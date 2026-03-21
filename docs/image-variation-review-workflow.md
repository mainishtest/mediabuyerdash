# Image Variation Review, Revision, and Approval Workflow

## Overview

The review workflow lets operators inspect generated image variation candidates, compare them side-by-side, request revisions, and approve or reject them. Approved candidates are marked ready for the next step (scoring, publish-prep). No candidates are auto-published.

## How It Works

### Flow

1. **Generate** — Image variations are generated at `/creative-lab/image-variations`
2. **Send to Review** — Click "Send to Review" to move candidates into the review queue
3. **Review** — Navigate to `/creative-lab/image-variations/review`
4. **Compare** — Side-by-side candidate cards with source context
5. **Decide** — Per candidate: Approve, Reject, Request Revision, or Archive
6. **Next step** — Approved candidates are flagged as ready for scoring/publish-prep

### Review States

| State | Meaning |
|-------|---------|
| `draft` | Generated but not yet in review |
| `needs_review` | In the review queue, awaiting decision |
| `revision_requested` | Reviewer wants changes — includes a revision intent |
| `approved` | Reviewer approved — ready for next step |
| `rejected` | Reviewer rejected — will not proceed |
| `archived` | Removed from active review |

### State Transitions

```
draft → needs_review (via "Send to Review")
needs_review → approved (via "Approve")
needs_review → rejected (via "Reject")
needs_review → revision_requested (via "Request Revision")
needs_review → archived (via "Archive")
revision_requested → approved / rejected / archived (after revision)
```

## Revision Intents

When requesting a revision, the reviewer selects an intent describing what needs to change:

| Intent | Description |
|--------|-------------|
| `make_more_distinct` | Too similar to another candidate or the source creative |
| `make_more_brand_aligned` | Doesn't match the brand's visual language |
| `strengthen_product_focus` | Product not prominent enough |
| `strengthen_offer_clarity` | Offer/value prop not visually clear |
| `simplify_visual` | Too busy — simplify for mobile feed |
| `increase_ugc_feel` | Needs more authentic, UGC aesthetic |
| `change_composition` | Layout or hierarchy needs rework |
| `explore_new_direction` | Start fresh with a different concept |

## How Approval Moves Candidates Forward

- **Approved** candidates are flagged in the review summary as `readyForNextStep: true`
- The review summary shows when all candidates have been decided (`isComplete: true`)
- The UI shows a "ready for next step" indicator when approved candidates exist and no reviews are pending
- The next step (scoring, publish-prep) will consume approved candidates from the review queue
- No auto-publishing — approved means "human-verified, ready for next stage"

## Data Model

Review state is stored directly on the `ImageVariationCandidate` object within `ImageVariationRequest.candidatesJson`:

```typescript
{
  // ... existing candidate fields ...
  reviewState?: "needs_review" | "approved" | "rejected" | "revision_requested" | "archived";
  reviewerNote?: string | null;
  revisionIntent?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}
```

No new Prisma models were added. Review state lives within the existing JSON column, matching the generation engine's storage pattern.

## API (Server Actions)

| Action | Parameters | Description |
|--------|------------|-------------|
| `loadReviewQueueAction()` | — | Load all requests with reviewable candidates |
| `loadComparisonSetAction(requestId)` | requestId | Load a single request's candidates |
| `approveCandidateAction(requestId, candidateId, note?)` | — | Approve a candidate |
| `rejectCandidateAction(requestId, candidateId, note?)` | — | Reject a candidate |
| `requestRevisionAction(requestId, candidateId, intent, note?)` | — | Request revision with intent |
| `archiveCandidateAction(requestId, candidateId)` | — | Archive a candidate |
| `loadReviewSummaryAction(requestId)` | requestId | Load aggregate review stats |

## UI Structure

- **Review queue page**: `/creative-lab/image-variations/review`
- **Layout**: Sidebar with generation request list + main area with candidate cards
- **Mobile**: Stacked cards with thumb-friendly buttons, collapsible content
- **Desktop**: Side-by-side comparison grid, inline notes, richer context panel

## Linkage

All review decisions maintain linkage to:
- Source creative (via `sourceCreativeId`)
- Source asset (via `sourceAssetUrl`)
- Source generation request (via `requestId`)
- Campaign (via `campaignId`)
- Client (via `clientAccountId`)
- Variation intent and trigger context

## Current Limitations

1. **No scoring/ranking** — Review is human-only; automated scoring comes in the next phase
2. **No publish execution** — Approved candidates are marked ready but not published
3. **No revision re-generation** — Revision requests are recorded but do not trigger automatic re-generation
4. **Single reviewer** — No multi-reviewer workflow or role-based permissions
5. **No notification** — Reviewers must check the queue manually

## File Structure

```
lib/imageVariation/
  ├── reviewTypes.ts  — Review state, revision intent, decision, queue, summary types
  ├── review.ts       — Review workflow utilities (queue, compare, approve, reject, revise)
  ├── types.ts        — Extended with review fields on ImageVariationCandidate
  └── index.ts        — Exports all review types and functions

app/creative-lab/image-variations/
  ├── actions.ts      — Extended with review server actions
  └── review/
      ├── page.tsx                      — Server component
      └── ImageVariationReviewView.tsx  — Client review view
```

## Next Steps

- Image variation scoring and ranking engine
- Publish-prep integration for approved candidates
- Revision re-generation workflow
- Multi-reviewer support
