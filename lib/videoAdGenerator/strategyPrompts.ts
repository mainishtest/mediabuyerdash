// Video Ad Generator V2 — GPT Strategy Prompts
//
// Master system prompt + 8 sub-prompts for the strategy engine.
// Each function returns { system, user } for the OpenAI caller.
// All prompts enforce strict JSON output.

import type {
  ExpandedConceptBrief,
  StrategyAngleSet,
  StrategyHookSet,
  StrategyHook,
  StrategyScript,
  StrategyShotListItem,
  StrategyRunOutput,
} from "./types";
import { getPlatformProfile, getBothProfiles } from "./platformRules";
import {
  AD_STYLE_LABELS,
  AWARENESS_LABELS,
  PLATFORM_LABELS,
  MARKET_SOPHISTICATION_LABELS,
  CTA_GOAL_LABELS,
  VISUAL_STYLE_LABELS,
} from "./types";

// ── Master system prompt ────────────────────────────────────────────

export const STRATEGY_SYSTEM = `You are the chief creative strategist at a direct-response agency that has produced winning video ads for 8- and 9-figure DTC brands on Facebook and Rumble.

You think in angles, mechanisms, proof stacks, and emotional levers — not generic marketing.

Your work is informed by:
- Eugene Schwartz's 5 levels of market sophistication
- Gary Halbert's starving crowd principle
- Claude Hopkins' scientific advertising
- Modern DR creative patterns from top Facebook/Rumble media buyers

Rules:
1. Be specific and concrete. Every hook, line, and scene must be testable — not clever, not vague.
2. Write for spoken video — real words a real person would say on camera. No corporate copy.
3. Adapt sophistication to the market level. Level 1 = simple direct claim. Level 5 = identity-based storytelling.
4. Every output is structured for production teams — editors, UGC creators, and media buyers.
5. Consider the visual style in every recommendation. If the style is raw UGC, don't suggest cinematic slow-mo.
6. Return ONLY valid JSON. No preamble, no explanation, no markdown fences.
7. Never use filler words like "game-changing", "revolutionary", "cutting-edge", or "world-class".`;

// ── Brief context builder ───────────────────────────────────────────

function expandedBriefContext(brief: ExpandedConceptBrief): string {
  const lines: string[] = [
    brief.brandName ? `Brand: ${brief.brandName}` : null,
    `Product: ${brief.productName}`,
    `Offer: ${brief.offer}`,
    `Platform: ${PLATFORM_LABELS[brief.platform]}`,
    `Audience: ${brief.audience}`,
    `Pain points: ${brief.painPoints}`,
    `Awareness stage: ${AWARENESS_LABELS[brief.awarenessStage]}`,
    `Market sophistication: ${MARKET_SOPHISTICATION_LABELS[brief.marketSophistication]}`,
    `Ad style: ${AD_STYLE_LABELS[brief.adStyle]}`,
    `Visual style: ${VISUAL_STYLE_LABELS[brief.visualStyle]}`,
    `CTA goal: ${CTA_GOAL_LABELS[brief.ctaGoal]}`,
    brief.keyClaims.length > 0
      ? `Key claims:\n${brief.keyClaims.map((c, i) => `  ${i + 1}. ${c.claim} (proof: ${c.proof} [${c.proofType}])`).join("\n")}`
      : null,
    brief.brandVoice ? `Brand voice: ${brief.brandVoice}` : null,
    brief.referenceAssetUrls.length > 0
      ? `Reference assets: ${brief.referenceAssetUrls.join(", ")}`
      : null,
    brief.extraNotes ? `Extra notes: ${brief.extraNotes}` : null,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

// Injects platform-specific creative rules into every strategy prompt.
// For "both" platform, includes both rule sets so GPT generates with
// awareness of how the concept will be adapted.
function platformRulesBlock(brief: ExpandedConceptBrief): string {
  if (brief.platform === "both") {
    const [fb, rm] = getBothProfiles();
    return `\n\n--- PLATFORM RULES (generating for BOTH platforms) ---
This concept will be adapted for both Facebook and Rumble. Generate the PRIMARY version for Facebook (tighter, faster, sound-off optimized), but keep the argument structure strong enough to extend to Rumble's longer, editorial format.

${fb.strategyPromptRules}

${rm.strategyPromptRules}
--- END PLATFORM RULES ---`;
  }

  const profile = getPlatformProfile(brief.platform);
  return `\n\n--- PLATFORM RULES (${profile.label.toUpperCase()}) ---
${profile.strategyPromptRules}
--- END PLATFORM RULES ---`;
}

// ── 1. Angle set ────────────────────────────────────────────────────

export function strategyAnglePrompt(brief: ExpandedConceptBrief) {
  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Task: Generate the strongest creative angle for this ad, plus 2 alternate angles.
${platformRulesBlock(brief)}

The primary angle should be the one most likely to stop this specific audience mid-scroll at their current awareness level and market sophistication.

Alternate angles should attack from genuinely different directions — not variations of the same idea.

For market sophistication level ${brief.marketSophistication}:
${brief.marketSophistication === 1 ? "- Be first. Make a simple, direct claim. The market hasn't heard this yet." : ""}
${brief.marketSophistication === 2 ? "- Be bigger. Enlarge the claim — more results, faster, easier. The basic claim exists." : ""}
${brief.marketSophistication === 3 ? "- Show the mechanism. The market has heard the claims. Now show WHY and HOW it works differently." : ""}
${brief.marketSophistication === 4 ? "- Show more mechanism. The market knows mechanisms exist. Stack uniqueness — proprietary process, specific combination, novel framing." : ""}
${brief.marketSophistication === 5 ? "- Identify with the prospect. The market is exhausted. Lead with identity, story, and belonging — not claims." : ""}

Return JSON:
{
  "primary": {
    "bigIdea": "The single-sentence core argument that would stop this audience mid-scroll.",
    "enemy": "What are we attacking? A belief, the status quo, a competitor category.",
    "mechanism": "The unique reason our solution works — the thing they haven't heard before.",
    "emotionalHook": "The dominant emotion we're hijacking and why it works for this audience."
  },
  "alternates": [
    { "bigIdea": "...", "enemy": "...", "mechanism": "...", "emotionalHook": "..." },
    { "bigIdea": "...", "enemy": "...", "mechanism": "...", "emotionalHook": "..." }
  ]
}`,
  };
}

// ── 2. Hook set ─────────────────────────────────────────────────────

export function strategyHookSetPrompt(brief: ExpandedConceptBrief, angleSet: StrategyAngleSet) {
  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Primary angle:
- Big idea: ${angleSet.primary.bigIdea}
- Enemy: ${angleSet.primary.enemy}
- Mechanism: ${angleSet.primary.mechanism}
- Emotional hook: ${angleSet.primary.emotionalHook}

Task: Write 10 distinct scroll-stopping hooks for the first 1-6 seconds of the video.
${platformRulesBlock(brief)}

Each hook must:
1. Be specific to this product and audience — no generic openers
2. Match the ${AD_STYLE_LABELS[brief.adStyle]} ad style and ${VISUAL_STYLE_LABELS[brief.visualStyle]} visual style
3. Include guidance on whether it needs sound to work (for Facebook sound-off viewers)
4. Include what on-screen text should appear simultaneously

Cover these archetypes (hit most, mix freely):
pattern_interrupt, question, bold_claim, curiosity_gap, social_proof, contrarian, relatable_pain, demonstration, callout, confession

Return JSON:
{
  "hooks": [
    {
      "text": "The spoken hook or scene description",
      "styleTag": "pattern_interrupt",
      "targetDurationSec": 3,
      "soundRequired": false,
      "onScreenTextHint": "THE TEXT THAT APPEARS ON SCREEN"
    },
    ...
  ]
}`,
  };
}

// ── 3. Script ───────────────────────────────────────────────────────

export function strategyScriptPrompt(
  brief: ExpandedConceptBrief,
  angleSet: StrategyAngleSet,
  selectedHook: StrategyHook
) {
  const targetDuration = brief.platform === "rumble" ? "60-90 seconds" : "30-45 seconds";
  const proofPointsContext = brief.keyClaims.length > 0
    ? `\n\nAvailable proof points (use the strongest 2-4 in the body):\n${brief.keyClaims.map((c) => `- ${c.claim}: ${c.proof} [${c.proofType}]`).join("\n")}`
    : "";

  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Angle: ${angleSet.primary.bigIdea}
Selected hook: "${selectedHook.text}"${proofPointsContext}

Task: Write a complete, shoot-ready ${targetDuration} script for a ${AD_STYLE_LABELS[brief.adStyle]} video ad.
${platformRulesBlock(brief)}

The opening must continue directly from the selected hook. Use spoken-word phrasing a real person would say on camera. Build the argument: pain → mechanism → proof → offer → CTA.

The CTA goal is: ${CTA_GOAL_LABELS[brief.ctaGoal]}

Return JSON:
{
  "opening": "First 3-8 seconds after the hook — establish the problem or stakes",
  "body": "The argument — pain → mechanism → proof stack → offer reveal. Written as spoken dialogue.",
  "cta": "1-2 sentences. Clear, direct. Matches the CTA goal.",
  "durationSeconds": 45,
  "proofStack": ["proof point 1 used", "proof point 2 used", "..."],
  "toneNotes": "Delivery guidance — conversational, urgent, warm, authoritative, etc."
}`,
  };
}

// ── 4. Shot list ────────────────────────────────────────────────────

export function strategyShotListPrompt(
  brief: ExpandedConceptBrief,
  script: StrategyScript
) {
  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Script:
OPENING: ${script.opening}
BODY: ${script.body}
CTA: ${script.cta}
Duration: ~${script.durationSeconds}s
Tone: ${script.toneNotes}

Visual style: ${VISUAL_STYLE_LABELS[brief.visualStyle]}
Ad style: ${AD_STYLE_LABELS[brief.adStyle]}

Task: Break this script into a scene-by-scene shot list (6-12 scenes) that an editor and a video generation model can both execute.
${platformRulesBlock(brief)}

Each scene must specify:
- Exact spoken dialogue for that scene
- Visual description matching the ${VISUAL_STYLE_LABELS[brief.visualStyle]} style
- Mood tag for emotional tone
- Transition in/out
- Audio notes (music, SFX, silence)

Think in terms of what a video generation AI needs to render each scene accurately.

Return JSON array:
[
  {
    "sceneNumber": 1,
    "timecode": "0:00-0:03",
    "visual": "Close-up of talent, direct eye contact, natural window light, phone-camera feel",
    "onScreenText": "YOU WON'T BELIEVE THIS",
    "bRollNotes": "None — tight on face",
    "editorNotes": "Hard cut in, no fade. Subtle zoom on word 'believe'.",
    "talentDirection": "Break 4th wall. Conspiratorial whisper. Slight lean forward.",
    "spokenDialogue": "Okay so I need to tell you something that my doctor doesn't want you to know...",
    "audioNotes": "No music. Raw room tone. Authenticity first.",
    "moodTag": "curious",
    "transitionIn": "cut",
    "transitionOut": "cut"
  },
  ...
]`,
  };
}

// ── 5. On-screen text ───────────────────────────────────────────────

export function strategyOnScreenTextPrompt(
  brief: ExpandedConceptBrief,
  script: StrategyScript,
  shotList: StrategyShotListItem[]
) {
  const sceneSummary = shotList
    .map((s) => `Scene ${s.sceneNumber} (${s.timecode}): ${s.spokenDialogue.slice(0, 80)}...`)
    .join("\n");

  const platformOstGuidance = brief.platform === "facebook"
    ? "Facebook: HEAVY on-screen text. Assume sound-off. Every key point needs text reinforcement."
    : brief.platform === "rumble"
    ? "Rumble: LIGHT on-screen text. Sound-on audience. Use text for emphasis only — stats, key phrases, CTA."
    : "Both platforms: Provide text for both approaches — heavy (Facebook) and light (Rumble).";

  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Script duration: ~${script.durationSeconds}s
${platformOstGuidance}

Scenes:
${sceneSummary}

Task: Design the on-screen text layer for each scene. This is what the viewer reads while watching.
${platformRulesBlock(brief)}

For each scene, specify:
- The text content
- Exact timing (start-end within the scene)
- Style: headline (big, bold), subtitle (smaller), callout (highlight box), stat (number emphasis), cta (action text)
- Position: top, center, bottom, lower_third
- Animation: fade, slide_up, pop, typewriter, none

Return JSON array:
[
  {
    "sceneNumber": 1,
    "texts": [
      {
        "text": "YOU WON'T BELIEVE THIS",
        "timing": "0:00-0:03",
        "style": "headline",
        "position": "center",
        "animation": "pop"
      }
    ]
  },
  ...
]`,
  };
}

// ── 6. CTA variants ─────────────────────────────────────────────────

export function strategyCtaVariantsPrompt(
  brief: ExpandedConceptBrief,
  angleSet: StrategyAngleSet
) {
  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Angle: ${angleSet.primary.bigIdea}
CTA goal: ${CTA_GOAL_LABELS[brief.ctaGoal]}

Task: Write 5 CTA variants a media buyer can swap for testing. Each uses a different psychological lever.
${platformRulesBlock(brief)}

Each CTA must include:
- The spoken line (what talent says)
- The on-screen text (what viewer reads)
- A voiceover-ready version (if different from spoken)
- An urgency level (1 = soft, 2 = moderate, 3 = high)

Levers: direct, soft, urgency, risk_reversal, curiosity

Return JSON array:
[
  {
    "text": "The spoken CTA line",
    "styleTag": "direct",
    "onScreenText": "SHOP NOW — FREE SHIPPING",
    "voiceoverLine": "Click the link below to get yours today.",
    "urgencyLevel": 2
  },
  ...
]`,
  };
}

// ── 7. Editor notes ─────────────────────────────────────────────────

export function strategyEditorNotesPrompt(
  brief: ExpandedConceptBrief,
  script: StrategyScript,
  shotList: StrategyShotListItem[]
) {
  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Script duration: ~${script.durationSeconds}s
Script tone: ${script.toneNotes}
Visual style: ${VISUAL_STYLE_LABELS[brief.visualStyle]}
Scene count: ${shotList.length}

Task: Write comprehensive editor/producer notes for this ad. This is the technical creative brief that goes to the editing team.
${platformRulesBlock(brief)}

Cover:
1. Overall pacing direction (where to speed up, slow down, breathe)
2. Color grading guidance (warm, cool, desaturated, high-contrast, etc.)
3. Music direction (genre, tempo, mood shifts, where to drop music)
4. Sound design (SFX, room tone, transitions, risers)
5. Graphics/text style (font feel, animation style, brand consistency)
6. Compliance notes (platform-specific rules, health claims restrictions, financial disclaimers)

Return JSON:
{
  "overallPacing": "...",
  "colorGrading": "...",
  "musicDirection": "...",
  "soundDesign": "...",
  "graphicsStyle": "...",
  "complianceNotes": ["note 1", "note 2", "..."]
}`,
  };
}

// ── 8. Platform adjustments ─────────────────────────────────────────

export function strategyPlatformAdjustmentsPrompt(
  brief: ExpandedConceptBrief,
  output: Partial<StrategyRunOutput>
) {
  const hookList = output.hookSet?.hooks
    .map((h, i) => `  ${i}. "${h.text}" [${h.styleTag}]`)
    .join("\n") ?? "  (no hooks yet)";

  const platforms = brief.platform === "both"
    ? ["facebook", "rumble"]
    : [brief.platform];

  return {
    system: STRATEGY_SYSTEM,
    user: `Brief:
${expandedBriefContext(brief)}

Script duration: ~${output.script?.durationSeconds ?? 45}s

Available hooks:
${hookList}

Task: Generate platform-specific adjustments for ${platforms.map((p) => p.toUpperCase()).join(" and ")}.

Platform guidelines:
- FACEBOOK: 15-45s sweet spot. Sound-off dominant — on-screen text does heavy lifting. Hook must land in 1-3s. Polished UGC tone. FB-policy-aware. 9:16 (Reels) or 4:5 (Feed) aspect.
- RUMBLE: 60-120s tolerated. Sound-ON by default. Editorial / talking-head friendly. Hook can breathe 3-6s. Creator-native CTAs. 16:9 primary. More tolerant of direct claims.

For each platform, specify:
- Which hook index to use (from the list above)
- Aspect ratio
- Target duration
- Pacing adjustments
- On-screen text density
- CTA style adaptation
- Compliance notes specific to that platform

Return JSON array (only include requested platforms):
[
  {
    "platform": "facebook",
    "hookIndex": 0,
    "aspectRatio": "9:16",
    "durationTarget": 35,
    "pacingNotes": "Fast cuts, 2-3 sec per scene max. Front-load the hook.",
    "ostDensity": "heavy",
    "ctaStyle": "Shop Now button-style CTA, urgency framing",
    "complianceNotes": ["No before/after weight claims", "Add 'results may vary' if using testimonials"]
  },
  ...
]`,
  };
}
