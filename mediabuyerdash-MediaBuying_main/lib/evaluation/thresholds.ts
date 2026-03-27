// lib/evaluation/thresholds.ts
// Configurable threshold constants for the v1 evaluation engine.
// Adjust here when refining thresholds — no other files need to change.
//
// ROAS bands (actual / goal):
//   scaling  ≥ 1.10 × goal  (10%+ above goal)
//   stable   ≥ 0.90 × goal  (within 10% below)
//   watching ≥ 0.70 × goal  (10–30% below)
//   losing   <  0.70 × goal  (>30% below)
//
// CPA bands (actual / goal — lower is better):
//   scaling  ≤ 0.90 × goal  (10%+ below goal — good)
//   stable   ≤ 1.10 × goal  (within 10% above)
//   watching ≤ 1.30 × goal  (10–30% above)
//   losing   >  1.30 × goal  (>30% above)
//
// Fatigue proxy (CTR or CVR vs target):
//   fatigued if actual < 0.70 × target AND spend ≥ FATIGUE_MIN_SPEND
//
// LP signal:
//   investigate_lp if ROAS ≥ 0.90 × goal but CPA delta > +30%
//
// Confidence:
//   high   = spend ≥ $200  AND conversions ≥ 5
//   medium = spend ≥ $50   AND conversions ≥ 1
//   low    = everything else

export const EVAL_THRESHOLDS = {
  // ROAS bands
  ROAS_SCALING: 1.10,
  ROAS_STABLE:  0.90,
  ROAS_WATCHING: 0.70,

  // CPA bands
  CPA_SCALING:  0.90,
  CPA_STABLE:   1.10,
  CPA_WATCHING: 1.30,

  // Fatigue detection
  CTR_FATIGUE:      0.70,  // below 70% of targetCtr triggers fatigue
  CVR_FATIGUE:      0.70,  // below 70% of targetCvr triggers fatigue
  FATIGUE_MIN_SPEND: 50,   // minimum spend to surface a fatigue signal

  // Confidence thresholds
  HIGH_SPEND:  200,
  HIGH_CONVS:  5,
  MED_SPEND:   50,
  MED_CONVS:   1,

  // Pause signal: only recommend pause when high-confidence AND high spend
  PAUSE_MIN_SPEND: 200,

  // LP investigation signal
  LP_ROAS_OK_FACTOR:  0.90,  // ROAS ≥ 90% of goal → not a spend problem
  LP_CPA_BAD_DELTA:   30,    // CPA >30% over goal → possible LP/funnel issue
} as const;
