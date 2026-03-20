# Creative Refresh Queue — Setup and Architecture Reference

## What the Refresh Queue Is Responsible For

The Creative Refresh Queue detects which creatives need attention, why they
need it, and what action should happen next. It is a **triage and prioritisation
surface** — not a generation tool.

It answers: *"Which creative needs to be refreshed right now, and what
specifically should we do about it?"*

It does **not**:
- Generate copy or images
- Publish anything to Meta
- Replace creatives automatically
- Make decisions autonomously

---

## How Creatives Enter the Queue

```
Meta sync → MetaSyncedInsight + MetaSyncedCreative
                   ↓
        loadCreativePerformanceData()
                   ↓
      buildCreativePerformanceSnapshots()     ← 14-day aggregated metrics
                   ↓
          [per snapshot]
          detectCreativeFatigue()             ← audience overexposure signals
          evaluateCreative()                  ← quality + conversion evaluation
                   ↓
      buildCreativeRefreshQueueItem()         ← merge both, derive priority + recommendation
                   ↓
      Exclusion rules:
        - skip spend < $50 (insufficient_data)
        - skip strong + healthy (scale candidate, not refresh)
        - include weak + watch + fatigued + severe_fatigue
        - include average + healthy if spend is meaningful (monitor_only)
                   ↓
      Sort: urgent → high → medium → low, then spend desc
                   ↓
      RefreshQueueView renders the sorted queue
```

---

## Signal Sources

The queue merges signals from two existing detection modules:

| Module | Signal Type | Examples |
|---|---|---|
| `lib/creativeFatigue/detector.ts` | Audience overexposure | High frequency, CTR collapse, compound spend+poor ROAS |
| `lib/creativelab/performance.ts` | Quality + conversion | Weak evaluation status, evaluationStatus === "weak" |

No detection logic is duplicated. The refresh queue only consumes and merges
their outputs.

### Signal Thresholds

| Signal | Threshold | Severity |
|---|---|---|
| Frequency — very high | > 5.0x | Critical |
| Frequency — high | > 3.5x | Warning/Critical |
| Frequency — watch | > 2.5x | Watch |
| CTR — collapsed | < 0.5% | Critical |
| CTR — declining | < 0.8% | Warning |
| ROAS — below threshold | < 1.0x | Warning/Critical |
| ROAS — declining | < 1.5x | Warning |
| Compound | Spend ≥ $200 + CTR < 0.8% + ROAS < 1.0x | Critical |
| Spend waste risk | Spend ≥ $500 + any weakness | Warning/Critical |

---

## Priority Levels

Priority is derived deterministically from signal severity. Checks run from
most to least severe — first match wins.

### `urgent`
Creative requires immediate attention. Active budget is at risk.

Conditions (any of):
- `severe_fatigue` status (audience deeply overexposed)
- Spend ≥ $500 + ROAS < 1.0x (CRM-verified) — significant budget waste
- Frequency > 5.0x + CTR < 0.5% — creative is exhausted

### `high`
Creative needs refresh action in the near term.

Conditions (any of):
- `fatigued` status (frequency above fatigue threshold)
- Spend ≥ $200 + ROAS < 1.0x — spending more than earning
- CTR < 0.5% + spend ≥ $200 — engagement collapsed with meaningful spend

### `medium`
Early warning signals. Proactive refresh recommended.

Conditions (any of):
- `watch` status from fatigue detector
- Weak evaluation + spend ≥ $50
- ROAS < 1.5x + spend ≥ $200 — below comfortable threshold

### `low`
Minor signals. Monitor and refresh if trends worsen.

Conditions:
- All other cases that pass inclusion rules

---

## Recommendation Types

Each queue item receives exactly one primary recommendation.

| Action Type | When Used | Meaning |
|---|---|---|
| `generate_full_refresh_brief` | Severe fatigue or high spend + poor ROAS | Complete creative replacement needed — brief covers hook, visual, copy |
| `generate_new_image_variations` | Fatigued + high frequency + weak CTR | Visual hook is tired; new image can re-engage same audience |
| `generate_new_copy_variations` | Fatigued + high frequency + OK CTR | Copy angle wearing thin; visual still working |
| `pause_creative_candidate` | Large spend + poor ROAS + fatigued | Creative burning budget — pause while replacement is prepared |
| `review_creative` | Watch status — early signals | Proactive review; no immediate action, prepare refresh |
| `monitor_only` | Average + healthy + meaningful spend | No action needed; watch for signal changes |

### Recommendation Logic (simplified)

```
severe_fatigue                          → generate_full_refresh_brief
spend ≥ $500 + ROAS < 1.0x             → pause_creative_candidate
fatigued + high freq + weak CTR         → generate_new_image_variations
fatigued + high freq + OK CTR           → generate_new_copy_variations
high spend + poor ROAS                  → generate_full_refresh_brief
watch + weak CTR                        → generate_new_copy_variations
watch                                   → review_creative
weak evaluation                         → generate_new_copy_variations
everything else                         → monitor_only
```

---

## Confidence Levels

| Level | Conditions |
|---|---|
| `high` | Spend ≥ $200 AND CRM ROAS available |
| `medium` | Spend ≥ $50 AND CRM ROAS available |
| `low` | Spend < $200 OR ROAS not yet reconciled |

Low confidence means the recommendation is based on limited data. More spend
and CRM reconciliation will improve confidence.

---

## Architecture Boundary

```
types/creativeRefreshQueue.ts              ← Pure types. No lib imports.
lib/creativeRefreshQueue/
  queue.ts                                 ← All logic: build, prioritise, recommend, filter
  index.ts                                 ← Public exports
lib/creativeFatigue/detector.ts            ← Consumed (not duplicated)
lib/creativelab/performance.ts             ← Consumed (not duplicated)
app/creative-lab/refresh-queue/
  page.tsx                                 ← Server: load + build queue
  RefreshQueueView.tsx                     ← Client: filter, list, state
  RefreshQueueItemCard.tsx                 ← Queue item compact card
  RefreshQueueItemDetail.tsx               ← Detail panel: signals + actions
```

Keep `lib/creativeRefreshQueue/queue.ts` free of UI concerns. Keep
`RefreshQueueItemDetail.tsx` free of queue generation logic.

---

## Route

**`/creative-lab/refresh-queue`**

Linked from:
- `/creative-lab` bottom nav
- Creative Lab item cards (future)
- Creative Fatigue page (future)

---

## Action Button Behaviour (Current Step)

Action buttons in the detail panel are placeholders in this step. They log
the action intent but do not yet trigger generation.

The next phase (Creative Brief Generation) will wire these buttons to a brief
creation flow. When a buyer clicks "Generate Full Refresh Brief", that will
open a brief editing surface pre-populated with the item's creative context,
signals, and recommendation rationale.

---

## Current Limitations

1. **No DB persistence** — queue is rebuilt from performance data on every
   page load. Buyer actions (mark as monitor only, etc.) are not persisted.

2. **No historical trending** — priority is based on the current 14-day window
   only. Multi-window trend analysis (declining CTR over time) requires
   storing historical snapshots.

3. **Action buttons are stubs** — clicking them logs intent but does not open
   a brief creation flow yet. That is the next phase.

4. **No CRM goal context** — target ROAS/CPA goals from campaign goals are
   not yet used in priority derivation. Adding goal-aware thresholds is a
   near-term enhancement.

5. **No real-time updates** — queue requires a page reload to reflect new
   Meta sync or CRM reconciliation data.

6. **Attribution window** — all metrics use a 14-day insight window. The
   7-day attribution window for CRM conversions is applied by the reconciliation
   pipeline upstream.
