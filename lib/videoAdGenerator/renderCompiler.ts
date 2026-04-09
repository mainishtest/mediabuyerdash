// Video Ad Generator V2 — Render Brief Compiler
//
// DETERMINISTIC. No AI calls. Pure TypeScript transformation.
// Takes strategy outputs and produces per-scene render briefs that
// describe exactly what the Veo rendering engine needs.
//
// Bump COMPILER_VERSION when any compilation logic changes.

import type {
  ExpandedConceptBrief,
  StrategyRunOutput,
  StrategyShotListItem,
  StrategyOnScreenText,
  StrategyEditorNotes,
  StrategyPlatformAdjustment,
  Platform,
  VisualStyle,
  SceneRenderBrief,
  FullRenderBrief,
  RenderGlobalMetadata,
  CameraFraming,
  CameraMovement,
  VisualToneGuidance,
  EnvironmentGuidance,
  AudioGuidance,
  BrandConstraints,
  ReferenceImageGuidance,
} from "./types";
import { getPlatformProfile, type PlatformProfile } from "./platformRules";

export const COMPILER_VERSION = "1.0.0";

// ── Camera framing inference ────────────────────────────────────────

function inferCameraFraming(visual: string, talentDirection: string): CameraFraming {
  const v = visual.toLowerCase();
  const td = talentDirection.toLowerCase();

  let shotType: CameraFraming["shotType"] = "medium";
  if (v.includes("extreme close") || v.includes("ecu"))      shotType = "extreme_close_up";
  else if (v.includes("close-up") || v.includes("close up") || v.includes("tight on")) shotType = "close_up";
  else if (v.includes("medium close") || v.includes("mcu"))  shotType = "medium_close";
  else if (v.includes("medium wide") || v.includes("mws"))   shotType = "medium_wide";
  else if (v.includes("wide shot") || v.includes("full shot") || v.includes("wide angle")) shotType = "wide";
  else if (v.includes("extreme wide") || v.includes("establishing")) shotType = "extreme_wide";

  let subjectPosition: CameraFraming["subjectPosition"] = "center";
  if (td.includes("off center") || td.includes("off-center")) subjectPosition = "off_center";
  else if (v.includes("rule of thirds") || v.includes("thirds")) subjectPosition = "rule_of_thirds_left";

  let verticalAngle: CameraFraming["verticalAngle"] = "eye_level";
  if (v.includes("low angle") || v.includes("low-angle") || v.includes("hero angle")) verticalAngle = "low_angle";
  else if (v.includes("high angle") || v.includes("overhead") || v.includes("bird")) verticalAngle = "high_angle";
  else if (v.includes("dutch") || v.includes("tilt")) verticalAngle = "dutch";

  return { shotType, subjectPosition, verticalAngle };
}

// ── Camera movement inference ───────────────────────────────────────

function inferCameraMovement(editorNotes: string, moodTag: string, profile: PlatformProfile): CameraMovement {
  const e = editorNotes.toLowerCase();

  let type: CameraMovement["type"] = "static";
  if (e.includes("dolly in") || e.includes("push in") || e.includes("zoom in"))   type = "dolly_in";
  else if (e.includes("dolly out") || e.includes("pull out") || e.includes("zoom out")) type = "dolly_out";
  else if (e.includes("pan left"))   type = "pan_left";
  else if (e.includes("pan right"))  type = "pan_right";
  else if (e.includes("pan"))        type = "pan_left";
  else if (e.includes("tilt up"))    type = "tilt_up";
  else if (e.includes("tilt down"))  type = "tilt_down";
  else if (e.includes("tracking") || e.includes("follow")) type = "tracking";
  else if (e.includes("handheld") || e.includes("hand-held") || e.includes("shaky")) type = "handheld";
  else if (e.includes("orbit"))      type = "orbit";

  // Platform-aware defaults: Facebook defaults to movement, Rumble defaults to static
  if (type === "static" && profile.movementIntensity === "high") {
    type = "handheld"; // Facebook: never truly static — at minimum handheld energy
  }

  let speed: CameraMovement["speed"] = profile.movementIntensity === "high" ? "fast" : "medium";
  if (e.includes("slow") || moodTag === "warm" || moodTag === "curious") speed = "slow";
  else if (e.includes("fast") || e.includes("quick") || moodTag === "urgent") speed = "fast";

  const motivation = moodTag === "tense"
    ? "Building tension through controlled movement"
    : moodTag === "triumphant"
    ? "Expanding energy to match the payoff moment"
    : profile.platform === "facebook"
    ? "Maintaining scroll-stopping energy — movement from frame 1"
    : "Maintaining composed visual interest while the argument builds";

  return { type, speed, motivation };
}

// ── Visual tone lookup ──────────────────────────────────────────────

const TONE_DEFAULTS: Record<VisualStyle, VisualToneGuidance> = {
  raw_ugc:      { lighting: "natural",       colorPalette: "Warm, slightly desaturated",    mood: "Authentic, unfiltered",    texture: "grainy" },
  polished_ugc: { lighting: "natural",       colorPalette: "Warm, clean, high contrast",    mood: "Approachable, trustworthy", texture: "clean" },
  cinematic:    { lighting: "dramatic",       colorPalette: "Rich, deep, film-grade",        mood: "Cinematic, premium",        texture: "filmic" },
  editorial:    { lighting: "studio",         colorPalette: "Neutral, sophisticated",        mood: "Authoritative, clean",      texture: "clean" },
  animation:    { lighting: "bright_flat",    colorPalette: "Vibrant, brand-aligned",        mood: "Energetic, modern",         texture: "clean" },
  mixed:        { lighting: "natural",        colorPalette: "Varied, scene-appropriate",     mood: "Dynamic, adaptive",         texture: "clean" },
};

const MOOD_LIGHTING_OVERRIDES: Record<string, Partial<VisualToneGuidance>> = {
  tense:      { lighting: "moody_low_key", mood: "Tense, uneasy" },
  warm:       { lighting: "golden_hour",   mood: "Warm, inviting" },
  urgent:     { lighting: "bright_flat",   mood: "Urgent, high-energy" },
  curious:    { lighting: "natural",       mood: "Intriguing, mysterious" },
  triumphant: { lighting: "golden_hour",   mood: "Triumphant, celebratory" },
};

function inferVisualTone(visualStyle: VisualStyle, moodTag: string): VisualToneGuidance {
  const base = { ...TONE_DEFAULTS[visualStyle] };
  const moodOverride = MOOD_LIGHTING_OVERRIDES[moodTag];
  if (moodOverride) {
    return { ...base, ...moodOverride };
  }
  return base;
}

// ── Environment extraction ──────────────────────────────────────────

function inferEnvironment(visual: string): EnvironmentGuidance {
  const v = visual.toLowerCase();

  // Setting — extract from visual description
  let setting = "Interior, neutral background";
  if (v.includes("kitchen"))     setting = "Modern kitchen, everyday feel";
  else if (v.includes("outdoor") || v.includes("outside") || v.includes("trail")) setting = "Outdoor, natural environment";
  else if (v.includes("bathroom")) setting = "Clean bathroom, morning routine";
  else if (v.includes("office") || v.includes("desk")) setting = "Home office or workspace";
  else if (v.includes("gym") || v.includes("workout")) setting = "Gym or workout space";
  else if (v.includes("living room") || v.includes("couch") || v.includes("sofa")) setting = "Living room, casual";
  else if (v.includes("bedroom")) setting = "Bedroom, intimate";
  else if (v.includes("studio"))  setting = "Clean studio backdrop";

  // Time of day
  let timeOfDay: EnvironmentGuidance["timeOfDay"] = "midday";
  if (v.includes("morning") || v.includes("sunrise"))       timeOfDay = "morning";
  else if (v.includes("golden hour") || v.includes("sunset")) timeOfDay = "golden_hour";
  else if (v.includes("evening") || v.includes("night"))    timeOfDay = "evening";

  // Props — extract nouns that could be props
  const keyProps: string[] = [];
  if (v.includes("product") || v.includes("bottle") || v.includes("box") || v.includes("package")) {
    keyProps.push("Product/packaging visible");
  }
  if (v.includes("phone") || v.includes("screen")) keyProps.push("Phone/device");

  return { setting, timeOfDay, weather: "Clear, neutral", keyProps };
}

// ── Audio guidance ──────────────────────────────────────────────────

function inferAudioGuidance(
  moodTag: string,
  audioNotes: string,
  globalEditorNotes: StrategyEditorNotes
): AudioGuidance {
  let spokenDelivery: AudioGuidance["spokenDelivery"] = "conversational";
  if (moodTag === "urgent")     spokenDelivery = "excited";
  else if (moodTag === "tense") spokenDelivery = "authoritative";
  else if (moodTag === "warm")  spokenDelivery = "conversational";

  let pace: AudioGuidance["pace"] = "moderate";
  if (moodTag === "urgent") pace = "fast";
  else if (moodTag === "warm" || moodTag === "curious") pace = "slow";

  return {
    spokenDelivery,
    pace,
    musicNote: audioNotes || globalEditorNotes.musicDirection || "Subtle background, doesn't compete with voice",
    sfxNote: globalEditorNotes.soundDesign || "Minimal — let the voice carry",
  };
}

// ── Timecode parsing ────────────────────────────────────────────────

function parseTimecodeDuration(timecode: string): number {
  const match = timecode.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/);
  if (!match) return 3;
  const startSec = parseInt(match[1]) * 60 + parseInt(match[2]);
  const endSec   = parseInt(match[3]) * 60 + parseInt(match[4]);
  return Math.max(endSec - startSec, 1);
}

// ── Render priority ─────────────────────────────────────────────────

function inferRenderPriority(
  sceneNumber: number,
  totalScenes: number,
  bRollNotes: string
): SceneRenderBrief["renderPriority"] {
  if (sceneNumber === 1) return "critical"; // hook scene
  if (sceneNumber === totalScenes) return "high"; // CTA scene
  if (bRollNotes.toLowerCase().includes("b-roll only") || bRollNotes.toLowerCase().includes("stock")) {
    return "optional";
  }
  return "standard";
}

// ── Aspect ratio from platform ──────────────────────────────────────

function getAspectRatio(
  platform: Platform,
  platformAdjustments: StrategyPlatformAdjustment[]
): "9:16" | "16:9" | "4:5" | "1:1" {
  const adj = platformAdjustments.find((a) => a.platform === platform);
  if (adj?.aspectRatio) return adj.aspectRatio;
  if (platform === "rumble") return "16:9";
  return "9:16"; // Facebook default
}

// ── Brand constraints ───────────────────────────────────────────────

function compileBrandConstraints(
  brief: ExpandedConceptBrief,
  editorNotes: StrategyEditorNotes,
  profile: PlatformProfile
): BrandConstraints {
  return {
    forbiddenElements: [
      "Competitor logos or products",
      "Copyrighted music",
      ...editorNotes.complianceNotes,
      ...profile.complianceNotes,
    ],
    requiredElements: [
      brief.brandName ? `Brand: ${brief.brandName}` : `Product: ${brief.productName}`,
    ],
    colorRestrictions: [],
    textPlacement: [
      profile.platform === "facebook"
        ? "Keep safe zones for FB UI (top 10%, bottom 20% for Reels)"
        : "Standard safe zones (top 5%, bottom 10%)",
    ],
  };
}

// ── Reference images ────────────────────────────────────────────────

function compileReferenceImages(urls: string[]): ReferenceImageGuidance[] {
  return urls.map((url, i) => ({
    url,
    usage: i === 0 ? "product_shot" as const : "style_reference" as const,
    notes: i === 0
      ? "Primary product reference — match the product appearance"
      : "Use for style/mood reference only",
  }));
}

// ── OST lookup ──────────────────────────────────────────────────────

function getOSTForScene(
  sceneNumber: number,
  onScreenTexts: StrategyOnScreenText[]
): Array<{ text: string; timing: string; style: string }> {
  const sceneOst = onScreenTexts.find((o) => o.sceneNumber === sceneNumber);
  if (!sceneOst) return [];
  return sceneOst.texts.map((t) => ({
    text:   t.text,
    timing: t.timing,
    style:  t.style,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

export function compileRenderBrief(
  strategyOutput: StrategyRunOutput,
  brief: ExpandedConceptBrief,
  strategyRunId: string,
  platformOverride?: Platform
): FullRenderBrief {
  const platform = platformOverride ?? (brief.platform === "both" ? "facebook" : brief.platform);
  const profile = getPlatformProfile(platform);
  const aspectRatio = getAspectRatio(platform, strategyOutput.platformAdjustments);
  const brandConstraints = compileBrandConstraints(brief, strategyOutput.editorNotes, profile);
  const referenceImages = compileReferenceImages(brief.referenceAssetUrls);
  const totalScenes = strategyOutput.shotList.length;

  let totalDuration = 0;

  const scenes: SceneRenderBrief[] = strategyOutput.shotList.map((shot) => {
    const durationSec = parseTimecodeDuration(shot.timecode);
    totalDuration += durationSec;

    return {
      sceneNumber:    shot.sceneNumber,
      sceneId:        `s${shot.sceneNumber}`,
      spokenDialogue: shot.spokenDialogue,
      onScreenTexts:  getOSTForScene(shot.sceneNumber, strategyOutput.onScreenText),
      cameraFraming:  inferCameraFraming(shot.visual, shot.talentDirection),
      cameraMovement: inferCameraMovement(shot.editorNotes, shot.moodTag, profile),
      visualTone:     inferVisualTone(brief.visualStyle, shot.moodTag),
      environment:    inferEnvironment(shot.visual),
      aspectRatio,
      durationSec,
      audioGuidance:  inferAudioGuidance(shot.moodTag, shot.audioNotes, strategyOutput.editorNotes),
      brandConstraints,
      referenceImages,
      renderPriority: inferRenderPriority(shot.sceneNumber, totalScenes, shot.bRollNotes),
      renderNotes:    `[${profile.label}] ${profile.renderRules.cutFrequency} | ${profile.renderRules.transitionStyle} | ${shot.editorNotes}`,
    };
  });

  const globalMetadata: RenderGlobalMetadata = {
    compilerVersion: COMPILER_VERSION,
    compiledAt:      new Date().toISOString(),
    strategyRunId,
    conceptId:       "", // filled in by the server action
    platform,
    totalDurationSec: totalDuration,
    aspectRatio,
  };

  return { scenes, globalMetadata };
}
