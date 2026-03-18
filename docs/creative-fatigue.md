# Creative Fatigue Detection

## What this is

The creative fatigue module detects audience overexposure and declining performance
signals for active Meta creatives, and recommends targeted refresh actions.

It does **not** auto-publish replacements to Meta. Recommendations link into the
existing Creative Lab generation workflow for human-directed execution.

---

## How fatigue is detected

Detection runs on the existing 14-day creative performance window loaded by
`lib/creativelab/performance.ts`. No new data loading is required.

```
loadCreativePerformanceData()            ← existing
  → buildCreativePerformanceSnapshots()  ← existing
    → buildCreativeFatigueReport()       ← new
        detectCreativeFatigue(snapshot)  ← per-creative
```

### Step 1: Collect signals

Each creative is evaluated against 7 signal types:

| Signal | Condition | Severity |
|---|---|---|
| `frequency_very_high` | Avg frequency > 5.0x | critical |
| `frequency_high` | Avg frequency > 3.5x | warning/critical |
| `ctr_critically_low` | CTR < 0.5% | critical |
| `ctr_declining` | CTR < 0.8% | warning |
| `roas_below_threshold` | Campaign ROAS < 1.0x | warning/critical |
| `roas_declining` | Campaign ROAS < 1.5x | warning |
| `high_spend_poor_performance` | Spend > $200 + weak CTR + poor ROAS | critical |

### Step 2: Derive fatigue status

| Status | Condition |
|---|---|
| `insufficient_data` | Spend < $50 — not enough signal |
| `severe_fatigue` | Frequency > 5.0x **or** 2+ critical signals |
| `fatigued` | Frequency > 3.5x **or** CTR collapsed + poor ROAS together |
| `watch` | Frequency > 2.5x **or** early warning combo |
| `healthy` | No signals above threshold |

### Step 3: Build refresh recommendation

| Status | Primary signal | Recommended action |
|---|---|---|
| `severe_fatigue` | any | `generate_full_creative_refresh` |
| `fatigued` | freq + weak CTR | `generate_new_image_variations` |
| `fatigued` | freq + OK CTR | `generate_new_copy_variations` |
| `fatigued` | high spend + poor ROAS | `pause_creative_candidate` |
| `fatigued` | weak CTR + poor ROAS | `generate_full_creative_refresh` |
| `watch` | any | `review_creative` |

---

## Refresh action types

| Action | Description |
|---|---|
| `review_creative` | Manual review; monitor the situation before acting |
| `generate_new_copy_variations` | Same visual, 3 new message/angle variations |
| `generate_new_image_variations` | New visual hook, preserving the message structure |
| `generate_full_creative_refresh` | Complete creative replacement — new hook + visual |
| `pause_creative_candidate` | Pause this creative while preparing a replacement |

All action buttons link to `/creative-lab` where generation is executed.
This follows the existing Creative Lab workflow and avoids duplication.

---

## Creative Refresh Queue

The Refresh Queue shows only `fatigued` and `severe_fatigue` creatives, sorted by:
1. Recommendation priority (high → medium → low)
2. Spend (descending) within each priority tier

---

## Architecture

```
lib/creativeFatigue/
  types.ts     — CreativeFatigueStatus, Signal, Summary, Recommendation types
  detector.ts  — detectCreativeFatigue(), buildCreativeFatigueReport(),
                 getOverallHealthCounts(), summarizeCreativeHealthByClient()
  index.ts     — public re-exports

app/creative-fatigue/
  page.tsx               — server: load data → snapshots → fatigue report
  CreativeFatigueView.tsx — client: summary cards, filters, queue, table
```

---

## Current limitations (v1)

1. **No trend comparison** — detection uses a single 14-day window. Rising/falling
   trends require storing historical snapshots (planned v2).

2. **Campaign-level ROAS/CPA only** — Meta does not provide creative-level conversion
   data without the Conversions API. ROAS/CPA signals are campaign-level only.

3. **No click_id matching** — the `high_spend_poor_performance` signal uses
   campaign-level ROAS as a proxy. True creative-level attribution requires
   Conversions API or UTM-level ad tracking.

4. **14-day window only** — "time in market" (how long a creative has been running)
   is not tracked. Longer-lived creatives are not penalised more harshly.

5. **Action buttons are navigation links** — clicking "Generate Copy Variations"
   navigates to `/creative-lab`. Deep-linking with a specific creative pre-selected
   is a planned enhancement.

6. **Frequency is averaged across all insight rows** — day-to-day frequency trends
   are not visible; only the mean across the window.

---

## What comes next

- **Performance-driven AI creative generation**: when a fatigued creative is
  identified, auto-populate the Creative Lab with the existing copy/image
  metadata and performance context pre-filled, so generation is one click away.
- **Historical trend detection**: store weekly snapshots to detect rising frequency
  and declining CTR trends before they cross hard thresholds.
- **Creative-level ROAS via Conversions API**: replace campaign-level ROAS proxy
  with creative-level CRM-verified metrics.
