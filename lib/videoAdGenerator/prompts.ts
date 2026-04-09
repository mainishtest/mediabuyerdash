// Video Ad Generator — prompt templates
//
// Each function returns a { system, user } pair designed to produce a
// strict JSON response. Keeping the templates pure + declarative makes
// it easy to A/B test prompts and swap the underlying model.

import type {
  ConceptBrief,
  Angle,
  Hook,
  Script,
} from "./types";
import { AD_STYLE_LABELS, AWARENESS_LABELS, PLATFORM_LABELS } from "./types";

const BASE_SYSTEM = `You are a senior direct-response creative strategist who has written winning video ads for 8- and 9-figure DTC brands. You think in hooks, angles, mechanisms, and proof stacks.

Rules:
- Write for real paid traffic — not generic marketing fluff.
- Every output must be specific, concrete, and testable.
- Never use corporate-speak, adjective-stacking, or empty "game-changing" language.
- Return ONLY valid JSON. No preamble, no explanation, no markdown fences.`;

function briefContext(brief: ConceptBrief): string {
  return [
    `Product: ${brief.productName}`,
    `Offer: ${brief.offer}`,
    `Audience: ${brief.audience}`,
    `Pain points: ${brief.painPoints}`,
    `Awareness stage: ${AWARENESS_LABELS[brief.awarenessStage]}`,
    `Ad style: ${AD_STYLE_LABELS[brief.adStyle]}`,
    `Platform: ${PLATFORM_LABELS[brief.platform]}`,
    brief.brandVoice ? `Brand voice: ${brief.brandVoice}` : null,
    brief.extraNotes ? `Extra notes: ${brief.extraNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Angle ────────────────────────────────────────────────────────────────────

export function anglePrompt(brief: ConceptBrief) {
  return {
    system: BASE_SYSTEM,
    user: `Brief:
${briefContext(brief)}

Task: Propose the strongest creative angle for this ad. Think like Eugene Schwartz — what is the "big idea" that would stop this audience mid-scroll?

Return JSON with this exact shape:
{
  "bigIdea":       "The single sentence that captures the core argument.",
  "enemy":         "What are we attacking? (a belief, competitor category, the status quo, etc.)",
  "mechanism":     "The unique reason our solution works — the thing they've never heard before.",
  "emotionalHook": "The emotion we're hijacking (fear, desire, outrage, curiosity, relief, etc.) and why it matters here."
}`,
  };
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function hooksPrompt(brief: ConceptBrief, angle: Angle) {
  return {
    system: BASE_SYSTEM,
    user: `Brief:
${briefContext(brief)}

Angle:
- Big idea: ${angle.bigIdea}
- Enemy: ${angle.enemy}
- Mechanism: ${angle.mechanism}
- Emotional hook: ${angle.emotionalHook}

Task: Write 10 distinct scroll-stopping hooks for the first 1-3 seconds of the video. Each hook should feel different — vary the archetype. Aim for specificity over cleverness.

Archetypes to cover (mix freely, but hit most of these):
pattern_interrupt, question, bold_claim, curiosity_gap, social_proof, contrarian, relatable_pain, demonstration

Return JSON array with exactly 10 items:
[
  { "text": "...", "styleTag": "pattern_interrupt" },
  ...
]`,
  };
}

// ── Script ───────────────────────────────────────────────────────────────────

export function scriptPrompt(brief: ConceptBrief, angle: Angle, hook: Hook) {
  const targetDuration = brief.platform === "rumble" ? "60-90 seconds" : "30-45 seconds";
  return {
    system: BASE_SYSTEM,
    user: `Brief:
${briefContext(brief)}

Angle: ${angle.bigIdea}
Chosen hook: "${hook.text}"

Task: Write a complete, shoot-ready script for a ${targetDuration} ${AD_STYLE_LABELS[brief.adStyle]} video ad. The opening must continue directly from the chosen hook. Use spoken-word phrasing a real person would say on camera — not written copy.

Structure:
- opening (first 3-8 seconds after the hook — establish the problem or stakes)
- body (the argument — pain -> mechanism -> proof -> offer reveal)
- cta (1-2 sentences, clear and direct)

Return JSON:
{
  "opening":         "...",
  "body":            "...",
  "cta":             "...",
  "durationSeconds": 45
}`,
  };
}

// ── Shot list ────────────────────────────────────────────────────────────────

export function shotListPrompt(brief: ConceptBrief, script: Script) {
  return {
    system: BASE_SYSTEM,
    user: `Brief:
${briefContext(brief)}

Script:
OPENING: ${script.opening}
BODY: ${script.body}
CTA: ${script.cta}
Duration: ~${script.durationSeconds}s

Task: Break this script into a scene-by-scene shot list an editor could use to cut the ad. Typical count: 6-12 scenes. Include specific visuals, on-screen text, B-roll, and editor notes.

Return JSON array:
[
  {
    "sceneNumber":     1,
    "timecode":        "0:00-0:03",
    "visual":          "Close-up of talent, unexpected facial expression, natural light",
    "onScreenText":    "YOU'VE BEEN LIED TO",
    "bRollNotes":      "None — tight on face",
    "editorNotes":     "Hard cut in, no fade. Add subtle zoom on 'lied'.",
    "talentDirection": "Break the 4th wall. Direct eye contact. Slight head tilt."
  },
  ...
]`,
  };
}

// ── CTAs ─────────────────────────────────────────────────────────────────────

export function ctasPrompt(brief: ConceptBrief, angle: Angle) {
  return {
    system: BASE_SYSTEM,
    user: `Brief:
${briefContext(brief)}

Angle: ${angle.bigIdea}

Task: Write 5 alternate CTA lines a media buyer can swap in for testing. Each should use a different psychological lever.

Levers: direct, soft, urgency, risk_reversal, curiosity

Return JSON array:
[
  { "text": "...", "styleTag": "direct" },
  ...
]`,
  };
}

// ── Platform variants ────────────────────────────────────────────────────────

export function platformVariantsPrompt(brief: ConceptBrief, script: Script, hook: Hook) {
  const platforms = brief.platform === "both"
    ? ["facebook", "rumble"]
    : [brief.platform];

  return {
    system: BASE_SYSTEM,
    user: `Brief:
${briefContext(brief)}

Master hook: "${hook.text}"
Master script opening: "${script.opening}"
CTA: ${script.cta}

Task: Adapt this creative for ${platforms.map((p) => p.toUpperCase()).join(" and ")}. Each platform needs genuinely different pacing, on-screen text density, tone, and CTA style.

Platform guidelines:
- FACEBOOK: 15-45s sweet spot. Sound-off friendly — on-screen text does heavy lifting. Hook must land in 1-3s. Polished UGC tone. FB-policy-aware CTAs ("Shop now", "Learn more"). 9:16 or 4:5 aspect.
- RUMBLE: 60-120s tolerated. Sound-ON by default. Editorial / talking-head friendly. Hook can breathe 3-6s. Creator-native CTAs ("Click the link below", "Check the description"). 16:9 primary. More tolerant of direct claims.

Return JSON (only include keys for requested platforms):
{
  ${platforms.includes("facebook") ? `"facebook": {
    "hook":         "Adapted hook, sound-off aware",
    "opening":      "Adapted opening",
    "pacing":       "One-sentence pacing description",
    "onScreenText": "Dense OST plan — what text appears when",
    "cta":          "FB-policy-aware CTA",
    "notes":        "Anything an editor needs to know"
  }` : ""}${platforms.length > 1 ? "," : ""}
  ${platforms.includes("rumble") ? `"rumble": {
    "hook":         "Adapted hook, audio-on",
    "opening":      "Adapted opening, more editorial",
    "pacing":       "One-sentence pacing description",
    "onScreenText": "Lighter OST plan — text used sparingly",
    "cta":          "Creator-native CTA",
    "notes":        "Anything an editor needs to know"
  }` : ""}
}`,
  };
}
