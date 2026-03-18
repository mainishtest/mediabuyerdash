# Creative Performance Diagnostics

## What it is

The Creative Performance page (`/creative-lab/performance`) evaluates ad creatives
using real Meta sync data. It identifies which creatives are underperforming or
performing well, and explains why — before any new creative generation happens.

This is **not** the AI generation pipeline (that lives at `/creative-lab`). This
is the diagnostic layer that informs what to generate and why.

---

## How creatives link to ads

The linkage chain uses existing Meta sync tables:

```
MetaSyncedInsight (level="ad")
  .externalAdId         ──→  MetaSyncedAd.externalAdId
  .spend / .impressions /
    .clicks / .frequency       .externalCreativeId  ──→  MetaSyncedCreative.externalCreativeId
                                                          .thumbnailUrl / .imageUrl
                                                          .body (ad copy)
                                                          .callToAction
                               .externalCampaignId  ──→  ReconciledCampaignPerformance
                                                          .calculatedRoas (CRM-verified)
                                                          .calculatedCpa  (CRM-verified)
```

Multiple ads can share the same creative (`externalCreativeId`). All ad-level
insight rows for a given `(creativeId, campaignId)` pair are aggregated into a
single `CreativePerformanceSnapshot`.

---

## Detection window

The last **14 days** of ad-level `MetaSyncedInsight` rows. Requires at least
**$50 in spend** within that window to produce a signal.

---

## How evaluation status is assigned

| Status | Condition |
|---|---|
| `insufficient_data` | Spend < $50 in the 14-day window |
| `fatigued` | Frequency > 3.5x (regardless of CTR) |
| `strong` | CTR ≥ 1.5% AND campaign ROAS ≥ 2.0x |
| `weak` | CTR < 0.8% — OR — CTR ≥ 1.5% with ROAS < 1.0x |
| `average` | Everything else |

Fatigue overrides all other signals — even a high-CTR creative is flagged as
fatigued if the audience is overexposed.

---

## How diagnostics are determined

| Primary Issue | Trigger Conditions | Recommended Direction |
|---|---|---|
| **Insufficient Data** | Spend < $50 | Wait for more spend before evaluating |
| **Creative Fatigue** | Frequency > 3.5x + CTR < 0.8% | Replace immediately with fresh concept |
| **Creative Fatigue** | Frequency > 3.5x (CTR still holding) | Begin developing replacement now |
| **Strong Performer** | CTR ≥ 1.5% + ROAS ≥ 2.0x | Scale budget; build variants of this creative |
| **Click-Through Disconnect** | CTR ≥ 1.5% + ROAS < 1.0x + spend ≥ $200 | Creative is working; fix landing page / offer |
| **Weak Hook** | CTR < 0.8% + spend ≥ $200 | Test stronger visual hook or benefit headline |
| **Weak Hook** | CTR < 0.8% | Test one hook variable at a time |
| **Average Performance** | None of the above | Monitor; test single variables to improve |

---

## Creative Opportunities

Each evaluation produces one or more opportunity recommendations:

| Type | Trigger | Urgency |
|---|---|---|
| `scale` | Status = `strong` | High |
| `retire` | Status = `fatigued` | High |
| `iterate` | Status = `weak` AND spend ≥ $200 | Medium |
| `refresh` | Status = `average` AND frequency > 2.5x | Low |

Opportunities are sorted by urgency (high → low).

---

## Architecture

```
lib/creativelab/
  types.ts         — CreativeEvaluationStatus, CreativePerformanceSnapshot,
                     CreativeDiagnostic, CreativeOpportunity, CreativeOpportunityType
  performance.ts   — loadCreativePerformanceData()      (DB loader, 2-phase)
                     buildCreativePerformanceSnapshots() (aggregator)
                     evaluateCreative()                  (status assignment)
                     diagnoseCreative()                  (issue + signals + direction)
                     buildCreativeOpportunities()        (ranked action list)

app/creative-lab/performance/
  page.tsx          — server component: loads data → builds snapshots →
                      diagnoses → builds opportunities → renders
  PerformanceView.tsx — client component: summary cards (clickable filters),
                        filter pill bar, creative cards grid, opportunities section
```

### Separation from the generation pipeline

`lib/creativeDiagnosisUtils.ts` — the **existing** diagnosis engine. Uses mock
copy/image metadata fields (hook text, CTA text, image style, visual theme) to
classify whether underperformance is caused by copy, image, or both. Used by the
AI generation pipeline at `/creative-lab` to inform what kind of variation to generate.

`lib/creativelab/performance.ts` — the **new** performance layer. Uses **real**
Meta sync data (spend, CTR, frequency) and CRM-verified ROAS/CPA from
reconciliation to evaluate actual live creative performance.

These are two separate layers with different inputs and outputs. The performance
layer is the prerequisite for the generation layer: diagnose first, then generate.

---

## Preparing for AI-driven generation (next phase)

The `CreativeDiagnostic` type is already structured to feed the generation pipeline:

```typescript
type CreativeDiagnostic = {
  externalCreativeId:   string;
  primaryIssue:         string;      // e.g. "Weak Hook"
  supportingSignals:    string[];    // evidence for the diagnosis
  recommendedDirection: string;      // what to test next
};
```

To connect to the generation pipeline:
1. Pass the diagnosed `CreativePerformanceSnapshot` + `CreativeDiagnostic` as context
2. Use `primaryIssue` to select the appropriate generation template
   (e.g. "Weak Hook" → hook-focused copy template)
3. Use `recommendedDirection` as the generation brief
4. Use `thumbnailUrl` / `imageUrl` as the reference image for visual variation

No changes to `performance.ts` or `types.ts` are required — only a new connector
layer between the diagnostic output and the generation input.

---

## Current limitations (v1)

- **No creative-level conversion data.** ROAS/CPA are at the campaign level because
  Meta's API does not provide creative-level conversions without the Conversions API
  and creative-level event matching. One card is shown per (creative, campaign) pair.

- **14-day window only.** Creatives that have been paused for more than 14 days will
  not appear even if they ran extensively before. No historical trend view yet.

- **Frequency signal requires ad-level sync.** Meta must sync at `level="ad"` for
  frequency data to be available. Workspace-level sync settings control this.

- **Thumbnail URLs may expire.** Meta CDN URLs in `MetaSyncedCreative.thumbnailUrl`
  and `imageUrl` are time-limited. If the image fails to load, a placeholder is shown.
  Re-syncing the creative data will refresh the URLs.

- **No historical CTR trend.** Only aggregate CTR for the 14-day window. A declining
  CTR trend within the window would be a stronger fatigue signal — not yet computed.

- **CRM-verified ROAS requires reconciliation.** If reconciliation has not been run
  for a campaign, ROAS and CPA show as `—` and the creative cannot be evaluated as
  `strong` (requires confirmed ROAS ≥ 2.0x).
