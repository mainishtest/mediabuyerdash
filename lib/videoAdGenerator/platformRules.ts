// Video Ad Generator — Platform Strategy Rules
//
// Codified differences between Facebook and Rumble that influence
// every layer: strategy prompts, render brief compilation, and UI.
// This is the single source of truth for platform behavior.

import type { Platform } from "./types";

export interface PlatformProfile {
  platform:           "facebook" | "rumble";
  label:              string;

  // Timing
  hookWindowSec:      [number, number];   // [min, max] seconds to land the hook
  idealDurationSec:   [number, number];   // sweet spot range
  maxTolerableSec:    number;
  pacingBpm:          "fast" | "moderate" | "slow";  // editing rhythm

  // Hook style
  hookApproach:       string;
  hookArchetypes:     string[];           // preferred archetypes in priority order
  thumbStopPriority:  "critical" | "important" | "moderate";

  // Script & messaging
  scriptTone:         string;
  trustBuildingStyle: string;
  proofStackOrder:    string;             // how to order proof points
  setupTolerance:     "minimal" | "moderate" | "generous";

  // CTA
  ctaStyle:           string;
  ctaExamples:        string[];
  ctaUrgency:         "high" | "moderate" | "low";

  // Visual / camera
  primaryAspectRatio: "9:16" | "16:9" | "4:5" | "1:1";
  secondaryAspects:   string[];
  cameraStyle:        string;
  editingRhythm:      string;
  visualPacing:       string;
  movementIntensity:  "high" | "moderate" | "low";

  // Audio
  soundAssumption:    "sound_off" | "sound_on";
  ostDensity:         "heavy" | "moderate" | "light";

  // Compliance
  complianceNotes:    string[];

  // Prompt injection — raw text injected into every GPT strategy prompt
  strategyPromptRules: string;

  // Render brief rules — applied during compilation
  renderRules: {
    defaultCameraMovement: string;
    cutFrequency:          string;
    colorTonePreference:   string;
    textOverlayApproach:   string;
    transitionStyle:       string;
  };
}

export const FACEBOOK_PROFILE: PlatformProfile = {
  platform:           "facebook",
  label:              "Facebook",

  hookWindowSec:      [1, 3],
  idealDurationSec:   [15, 45],
  maxTolerableSec:    60,
  pacingBpm:          "fast",

  hookApproach:       "Immediate pattern interrupt. Must work sound-off. Visual-first. The first frame must earn the second frame.",
  hookArchetypes:     ["pattern_interrupt", "bold_claim", "demonstration", "relatable_pain", "contrarian", "curiosity_gap", "question", "social_proof"],
  thumbStopPriority:  "critical",

  scriptTone:         "Punchy, conversational, high-energy but authentic. Short sentences. No meandering. Every line earns the next line.",
  trustBuildingStyle: "Social proof-led — reviews, UGC clips, numbers, before/after. Fast credibility signals, not long trust arcs.",
  proofStackOrder:    "Lead with the most visual/shocking proof first. Stack 2-3 fast proof beats. Don't linger — move to offer.",
  setupTolerance:     "minimal",

  ctaStyle:           "Direct, button-aligned. Match Facebook's native CTA buttons (Shop Now, Learn More, Get Offer). Urgency framing.",
  ctaExamples:        ["Tap Shop Now before this deal ends", "Click below — free shipping today only", "Get yours now — 4,000+ 5-star reviews"],
  ctaUrgency:         "high",

  primaryAspectRatio: "9:16",
  secondaryAspects:   ["4:5", "1:1"],
  cameraStyle:        "Tight framing. Close-ups dominate. Phone-camera feel for UGC. Frequent angle changes. Movement serves energy, not beauty.",
  editingRhythm:      "Fast cuts every 2-3 seconds. Jump cuts are native. B-roll inserts keep velocity. Never hold a static shot longer than 4 seconds.",
  visualPacing:       "Front-loaded energy. Highest visual intensity in first 3 seconds. Gradually tighten toward CTA.",
  movementIntensity:  "high",

  soundAssumption:    "sound_off",
  ostDensity:         "heavy",

  complianceNotes: [
    "No before/after weight loss imagery",
    "No income claims without disclaimers",
    "No 'you' language in health claims (use 'people' or 'users')",
    "Results may vary disclaimer if using testimonials",
    "No misleading countdown timers",
  ],

  strategyPromptRules: `FACEBOOK-SPECIFIC RULES:
- The hook must land in 1-3 seconds. If it doesn't stop the scroll in that window, the ad fails.
- Assume 70%+ viewers have sound OFF. On-screen text must carry the message independently.
- Write for vertical video (9:16). Every visual must work in portrait framing.
- Pacing is everything. Cut every 2-3 seconds. No scene should hold longer than 4 seconds without movement.
- Social proof > authority proof. Reviews, UGC, and "real people" signals outperform expert credibility.
- CTA must match Facebook's button ecosystem (Shop Now, Learn More, Sign Up). Make the CTA sound like what the button says.
- Pattern interrupts work better than curiosity gaps on Facebook. Lead with the unexpected.
- The body argument must be compressed. You have 30 seconds, not 90. Proof stack = 2-3 beats max.
- Thumb-stop logic: the first FRAME of the video must be visually arresting. Think about what the thumbnail looks like in-feed.`,

  renderRules: {
    defaultCameraMovement: "dolly_in or handheld — movement from frame 1",
    cutFrequency:          "Cut every 2-3 seconds. Jump cuts preferred over dissolves.",
    colorTonePreference:   "High contrast, slightly warm. Bright enough to pop on a phone screen in sunlight.",
    textOverlayApproach:   "Bold, large text. High contrast against background. Every key claim gets text reinforcement. 3-5 word max per text card.",
    transitionStyle:       "Hard cuts. No dissolves. Occasional whip pan or zoom for energy.",
  },
};

export const RUMBLE_PROFILE: PlatformProfile = {
  platform:           "rumble",
  label:              "Rumble",

  hookWindowSec:      [3, 6],
  idealDurationSec:   [60, 120],
  maxTolerableSec:    180,
  pacingBpm:          "moderate",

  hookApproach:       "Conversational authority. Host-read feel. Can breathe — doesn't need to slap in frame 1. Earn trust before making the pitch.",
  hookArchetypes:     ["curiosity_gap", "question", "social_proof", "contrarian", "relatable_pain", "confession", "bold_claim", "pattern_interrupt"],
  thumbStopPriority:  "moderate",

  scriptTone:         "Conversational, editorial, authoritative but warm. Longer sentences are OK. The viewer chose to watch — respect their intelligence. Think podcast-ad or commentary style.",
  trustBuildingStyle: "Authority-led — expertise, founder credibility, detailed mechanism explanation. Longer trust arcs are tolerated. Show you understand their world.",
  proofStackOrder:    "Lead with credibility/authority, then mechanism explanation, then social proof/testimonials, then offer. Let the argument build.",
  setupTolerance:     "generous",

  ctaStyle:           "Creator-native. 'Check the link in the description', 'Click below to see for yourself'. Softer urgency — these viewers distrust hard sells.",
  ctaExamples:        ["Click the link below to check it out for yourself", "I put a link in the description — go see the results", "Visit the site, read the reviews, decide for yourself"],
  ctaUrgency:         "moderate",

  primaryAspectRatio: "16:9",
  secondaryAspects:   ["9:16"],
  cameraStyle:        "Talking-head friendly. Wider framing. Steadier camera. Can hold shots longer. Natural lighting preferred. Less frenetic, more composed.",
  editingRhythm:      "Moderate cuts every 4-8 seconds. Talking-head segments can hold 8-10 seconds. B-roll is supplementary, not driving. Dissolves and fades are acceptable.",
  visualPacing:       "Even energy. Let the argument breathe. Intensity builds gradually toward the CTA rather than front-loading.",
  movementIntensity:  "low",

  soundAssumption:    "sound_on",
  ostDensity:         "light",

  complianceNotes: [
    "More tolerant of direct claims — but still avoid outright falsehoods",
    "Political and health angles are permitted with appropriate framing",
    "Less restrictive on before/after imagery",
    "Creator endorsement rules still apply",
  ],

  strategyPromptRules: `RUMBLE-SPECIFIC RULES:
- The hook can breathe — you have 3-6 seconds to set up the premise. Don't rush.
- Assume viewers have sound ON. Audio carries the message. On-screen text is for emphasis only — stats, key phrases, CTA.
- Write for landscape video (16:9). Talking-head and editorial compositions.
- Pacing is more editorial. Scenes can hold 4-8 seconds. The audience will stay if the content is substantive.
- Authority proof > social proof. Expertise, detailed explanations, and founder credibility outperform review montages.
- CTA should feel creator-native — "click the link below", "check the description". Hard-sell CTAs feel out of place.
- Curiosity gaps and questions work better than pattern interrupts on Rumble. Build intrigue, then deliver.
- The body argument can be longer. You have 60-120 seconds. Build the case methodically — mechanism first, then proof.
- Rumble viewers are more skeptical of polished marketing. Raw, honest, editorial-style content performs better.
- Commentary / host-read style is native to the platform. Write like you're talking TO someone, not AT them.`,

  renderRules: {
    defaultCameraMovement: "static or slow_pan — steady, composed shots",
    cutFrequency:          "Cut every 4-8 seconds. Talking head can hold 8-10 seconds. Let moments breathe.",
    colorTonePreference:   "Natural, slightly desaturated. Not overly graded. Authentic feel over polished look.",
    textOverlayApproach:   "Minimal text. Stats and key phrases only. Lower third placement. Clean, readable, not flashy.",
    transitionStyle:       "Dissolves and cuts. Fades acceptable for section breaks. No rapid-fire jump cuts.",
  },
};

// ── Lookup ──────────────────────────────────────────────────────────

export function getPlatformProfile(platform: Platform): PlatformProfile {
  if (platform === "rumble") return RUMBLE_PROFILE;
  return FACEBOOK_PROFILE; // "facebook" or "both" defaults to Facebook primary
}

export function getBothProfiles(): [PlatformProfile, PlatformProfile] {
  return [FACEBOOK_PROFILE, RUMBLE_PROFILE];
}

// ── Platform comparison matrix (for UI display) ─────────────────────

export interface PlatformComparisonRow {
  dimension: string;
  facebook:  string;
  rumble:    string;
}

export const PLATFORM_COMPARISON_MATRIX: PlatformComparisonRow[] = [
  { dimension: "Hook window",       facebook: "1-3 seconds",                    rumble: "3-6 seconds" },
  { dimension: "Ideal duration",    facebook: "15-45 seconds",                  rumble: "60-120 seconds" },
  { dimension: "Sound assumption",  facebook: "Sound OFF (70%+)",               rumble: "Sound ON" },
  { dimension: "On-screen text",    facebook: "Heavy — carries the message",    rumble: "Light — emphasis only" },
  { dimension: "Hook style",        facebook: "Pattern interrupt, thumb-stop",  rumble: "Curiosity, conversational" },
  { dimension: "Script tone",       facebook: "Punchy, compressed, high-energy", rumble: "Editorial, authoritative, warm" },
  { dimension: "Trust building",    facebook: "Social proof — reviews, UGC",    rumble: "Authority — expertise, mechanism" },
  { dimension: "CTA style",         facebook: "'Shop Now' — direct, urgent",    rumble: "'Check the link below' — native" },
  { dimension: "Aspect ratio",      facebook: "9:16 (portrait)",                rumble: "16:9 (landscape)" },
  { dimension: "Camera style",      facebook: "Tight, close-up, movement",     rumble: "Wider, steadier, talking-head" },
  { dimension: "Editing rhythm",    facebook: "Fast cuts every 2-3s",           rumble: "Moderate cuts every 4-8s" },
  { dimension: "Visual pacing",     facebook: "Front-loaded energy",            rumble: "Gradual build" },
  { dimension: "Compliance",        facebook: "Strict (health, income, B/A)",   rumble: "More tolerant" },
];
