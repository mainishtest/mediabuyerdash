// Video Ad Generator — shared types
//
// These types describe the shape of generated content. Each is persisted
// as a JSON string on the VideoAdConcept row and parsed at read time.

export type AdStyle =
  | "ugc"
  | "founder_story"
  | "problem_solution"
  | "testimonial"
  | "vsl_lite"
  | "native_editorial"
  | "product_demo"
  | "before_after";

export type Platform = "facebook" | "rumble" | "both";

export type AwarenessStage =
  | "unaware"
  | "problem_aware"
  | "solution_aware"
  | "product_aware"
  | "most_aware";

export type ConceptStatus =
  | "draft"
  | "strategy_ready"
  | "render_brief_ready"
  | "rendering"
  | "reviewing"
  | "approved"
  | "in_production"
  | "launched"
  | "archived"
  // Legacy (v1)
  | "shot"
  | "live"
  | "killed";

export interface ConceptBrief {
  productName:    string;
  offer:          string;
  audience:       string;
  painPoints:     string;
  awarenessStage: AwarenessStage;
  adStyle:        AdStyle;
  platform:       Platform;
  brandVoice?:    string;
  extraNotes?:    string;
}

export interface Angle {
  bigIdea:       string;
  enemy:         string;
  mechanism:     string;
  emotionalHook: string;
}

export interface Hook {
  text:     string;
  styleTag: string; // pattern_interrupt | question | bold_claim | curiosity_gap | social_proof | contrarian | relatable_pain | demonstration
}

export interface Script {
  opening:         string;
  body:            string;
  cta:             string;
  durationSeconds: number;
}

export interface ShotListItem {
  sceneNumber:       number;
  timecode:          string;  // "0:00-0:03"
  visual:            string;
  onScreenText:      string;
  bRollNotes:        string;
  editorNotes:       string;
  talentDirection:   string;
}

export interface Cta {
  text:     string;
  styleTag: string; // direct | soft | urgency | risk_reversal | curiosity
}

export interface PlatformVariant {
  hook:         string;
  opening:      string;
  pacing:       string;
  onScreenText: string;
  cta:          string;
  notes:        string;
}

export interface PlatformVariants {
  facebook?: PlatformVariant;
  rumble?:   PlatformVariant;
}

export const AD_STYLE_LABELS: Record<AdStyle, string> = {
  ugc:              "UGC",
  founder_story:    "Founder Story",
  problem_solution: "Problem / Solution",
  testimonial:      "Testimonial",
  vsl_lite:         "VSL-Lite",
  native_editorial: "Native / Editorial",
  product_demo:     "Product Demo",
  before_after:     "Before / After",
};

export const AWARENESS_LABELS: Record<AwarenessStage, string> = {
  unaware:        "Unaware",
  problem_aware:  "Problem-Aware",
  solution_aware: "Solution-Aware",
  product_aware:  "Product-Aware",
  most_aware:     "Most Aware",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  rumble:   "Rumble",
  both:     "Facebook + Rumble",
};

export const STATUS_LABELS: Record<ConceptStatus, string> = {
  draft:              "Draft",
  strategy_ready:     "Strategy Ready",
  render_brief_ready: "Render Brief Ready",
  rendering:          "Rendering",
  reviewing:          "Reviewing",
  approved:           "Approved",
  in_production:      "In Production",
  launched:           "Launched",
  archived:           "Archived",
  // Legacy
  shot:    "Shot",
  live:    "Live",
  killed:  "Killed",
};

// Ordered pipeline for the status stepper
export const STATUS_PIPELINE: ConceptStatus[] = [
  "draft",
  "strategy_ready",
  "render_brief_ready",
  "rendering",
  "reviewing",
  "approved",
  "in_production",
  "launched",
];

// What the next status should be from any given status
export const NEXT_STATUS: Partial<Record<ConceptStatus, ConceptStatus>> = {
  draft:              "strategy_ready",
  strategy_ready:     "render_brief_ready",
  render_brief_ready: "rendering",
  rendering:          "reviewing",
  reviewing:          "approved",
  approved:           "in_production",
  in_production:      "launched",
};

export interface ApprovedStructure {
  hookIndex:      number;
  ctaIndex:       number;
  strategyRunId:  string;
  notes:          string;
};

// ═══════════════════════════════════════════════════════════════════════
// V2 — Two-engine architecture types
//
// Strategy engine (GPT-5.4) → Render brief compiler → Render engine (Veo)
// Everything below is additive. V1 types above are preserved.
// ═══════════════════════════════════════════════════════════════════════

// ── New input dimensions ────────────────────────────────────────────

export type MarketSophistication = 1 | 2 | 3 | 4 | 5;

export type CtaGoal = "purchase" | "lead" | "subscribe" | "book_call" | "learn_more";

export type VisualStyle =
  | "cinematic"
  | "raw_ugc"
  | "polished_ugc"
  | "editorial"
  | "animation"
  | "mixed";

export interface ClaimProofPoint {
  claim:     string;
  proof:     string;
  proofType: "stat" | "testimonial" | "authority" | "demonstration" | "social_proof" | "guarantee";
}

export interface ExpandedConceptBrief extends ConceptBrief {
  brandName?:           string;
  marketSophistication: MarketSophistication;
  keyClaims:            ClaimProofPoint[];
  ctaGoal:              CtaGoal;
  visualStyle:          VisualStyle;
  referenceAssetUrls:   string[];
}

// ── Strategy engine outputs (GPT-5.4) ───────────────────────────────

export interface StrategyAngleSet {
  primary:    Angle;
  alternates: Angle[];
}

export interface StrategyHook extends Hook {
  targetDurationSec: number;
  soundRequired:     boolean;
  onScreenTextHint:  string;
}

export interface StrategyHookSet {
  hooks: StrategyHook[];
}

export interface StrategyScript {
  opening:         string;
  body:            string;
  cta:             string;
  durationSeconds: number;
  proofStack:      string[];
  toneNotes:       string;
}

export interface StrategyShotListItem extends ShotListItem {
  spokenDialogue: string;
  audioNotes:     string;
  moodTag:        string;   // tense | warm | urgent | curious | triumphant
  transitionIn:   string;   // cut | dissolve | zoom | whip
  transitionOut:  string;
}

export interface StrategyOnScreenText {
  sceneNumber: number;
  texts: Array<{
    text:      string;
    timing:    string;
    style:     "headline" | "subtitle" | "callout" | "stat" | "cta";
    position:  "top" | "center" | "bottom" | "lower_third";
    animation: "fade" | "slide_up" | "pop" | "typewriter" | "none";
  }>;
}

export interface StrategyCtaVariant extends Cta {
  onScreenText:  string;
  voiceoverLine: string;
  urgencyLevel:  1 | 2 | 3;
}

export interface StrategyEditorNotes {
  overallPacing:   string;
  colorGrading:    string;
  musicDirection:  string;
  soundDesign:     string;
  graphicsStyle:   string;
  complianceNotes: string[];
}

export interface StrategyPlatformAdjustment {
  platform:        Platform;
  hookIndex:       number;
  aspectRatio:     "9:16" | "16:9" | "4:5" | "1:1";
  durationTarget:  number;
  pacingNotes:     string;
  ostDensity:      "heavy" | "moderate" | "light";
  ctaStyle:        string;
  complianceNotes: string[];
}

export interface StrategyRunOutput {
  angleSet:            StrategyAngleSet;
  hookSet:             StrategyHookSet;
  script:              StrategyScript;
  shotList:            StrategyShotListItem[];
  onScreenText:        StrategyOnScreenText[];
  ctaVariants:         StrategyCtaVariant[];
  editorNotes:         StrategyEditorNotes;
  platformAdjustments: StrategyPlatformAdjustment[];
}

// ── Render brief (deterministic compiler output) ────────────────────

export interface CameraFraming {
  shotType:        "extreme_close_up" | "close_up" | "medium_close" | "medium" | "medium_wide" | "wide" | "extreme_wide";
  subjectPosition: "center" | "rule_of_thirds_left" | "rule_of_thirds_right" | "off_center";
  verticalAngle:   "eye_level" | "low_angle" | "high_angle" | "overhead" | "dutch";
}

export interface CameraMovement {
  type:       "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out" | "tracking" | "handheld" | "orbit";
  speed:      "slow" | "medium" | "fast";
  motivation: string;
}

export interface VisualToneGuidance {
  lighting:     "natural" | "studio" | "golden_hour" | "moody_low_key" | "bright_flat" | "dramatic";
  colorPalette: string;
  mood:         string;
  texture:      "clean" | "grainy" | "filmic" | "raw";
}

export interface EnvironmentGuidance {
  setting:   string;
  timeOfDay: "morning" | "midday" | "afternoon" | "golden_hour" | "evening" | "night";
  weather:   string;
  keyProps:  string[];
}

export interface AudioGuidance {
  spokenDelivery: "conversational" | "authoritative" | "excited" | "whispering" | "testimonial";
  pace:           "slow" | "moderate" | "fast";
  musicNote:      string;
  sfxNote:        string;
}

export interface BrandConstraints {
  forbiddenElements: string[];
  requiredElements:  string[];
  colorRestrictions: string[];
  textPlacement:     string[];
}

export interface ReferenceImageGuidance {
  url:   string;
  usage: "style_reference" | "product_shot" | "environment_reference" | "talent_reference";
  notes: string;
}

export interface SceneRenderBrief {
  sceneNumber:      number;
  sceneId:          string;
  spokenDialogue:   string;
  onScreenTexts:    Array<{ text: string; timing: string; style: string }>;
  cameraFraming:    CameraFraming;
  cameraMovement:   CameraMovement;
  visualTone:       VisualToneGuidance;
  environment:      EnvironmentGuidance;
  aspectRatio:      "9:16" | "16:9" | "4:5" | "1:1";
  durationSec:      number;
  audioGuidance:    AudioGuidance;
  brandConstraints: BrandConstraints;
  referenceImages:  ReferenceImageGuidance[];
  renderPriority:   "critical" | "high" | "standard" | "optional";
  renderNotes:      string;
}

export interface RenderGlobalMetadata {
  compilerVersion:  string;
  compiledAt:       string;
  strategyRunId:    string;
  conceptId:        string;
  platform:         Platform;
  totalDurationSec: number;
  aspectRatio:      string;
}

export interface FullRenderBrief {
  scenes:         SceneRenderBrief[];
  globalMetadata: RenderGlobalMetadata;
}

// ── Veo types ───────────────────────────────────────────────────────

export type VeoModel = "veo-3.1" | "veo-3.1-lite";

export interface VeoJobRequest {
  model:            VeoModel;
  prompt:           string;
  negativePrompt?:  string;
  durationSec:      number;
  aspectRatio:      string;
  referenceImages?: string[];
  seed?:            number;
}

export interface VeoJobStatus {
  jobId:    string;
  status:   "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?:   string;
}

// ── Pipeline control ────────────────────────────────────────────────

export type PipelineMode = "strategy_only" | "storyboard_only" | "render_ready";

export type GenerationTier = "premium" | "standard";

export interface PipelineOptions {
  mode:              PipelineMode;
  tier:              GenerationTier;
  selectedHookIndex?: number;
  platformOverride?:  Platform;
}

// ── V2 label maps ───────────────────────────────────────────────────

export const MARKET_SOPHISTICATION_LABELS: Record<number, string> = {
  1: "Level 1 — Be First",
  2: "Level 2 — Be Bigger",
  3: "Level 3 — Show Mechanism",
  4: "Level 4 — Show More Mechanism",
  5: "Level 5 — Identify with Prospect",
};

export const CTA_GOAL_LABELS: Record<CtaGoal, string> = {
  purchase:   "Purchase",
  lead:       "Lead Gen",
  subscribe:  "Subscribe",
  book_call:  "Book a Call",
  learn_more: "Learn More",
};

export const VISUAL_STYLE_LABELS: Record<VisualStyle, string> = {
  cinematic:    "Cinematic",
  raw_ugc:      "Raw UGC",
  polished_ugc: "Polished UGC",
  editorial:    "Editorial",
  animation:    "Animation",
  mixed:        "Mixed",
};

export const PIPELINE_MODE_LABELS: Record<PipelineMode, string> = {
  strategy_only:  "Strategy Only",
  storyboard_only: "Full Storyboard",
  render_ready:    "Render-Ready",
};

// ═══════════════════════════════════════════════════════════════════════
// V3 — Creative + Campaign OS types
//
// Provider abstraction, standalone assets, campaign bridge.
// ═══════════════════════════════════════════════════════════════════════

// ── AI Provider types ──────────────────────────────────────────────────

export type AIProviderSlug = "anthropic" | "openai" | "google" | "stability" | "elevenlabs";

export type AICapability =
  | "text_generation"
  | "image_generation"
  | "video_generation"
  | "voice_generation";

export interface AIProviderConfig {
  provider:     AIProviderSlug;
  displayName:  string;
  apiKeyEnvVar: string;
  defaultModel: string;
  capabilities: AICapability[];
}

// Known provider configs (source of truth — AIProvider DB rows mirror this)
export const PROVIDER_REGISTRY: Record<AIProviderSlug, AIProviderConfig> = {
  anthropic: {
    provider:     "anthropic",
    displayName:  "Anthropic Claude",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
    capabilities: ["text_generation"],
  },
  openai: {
    provider:     "openai",
    displayName:  "OpenAI",
    apiKeyEnvVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4.1",
    capabilities: ["text_generation", "image_generation"],
  },
  google: {
    provider:     "google",
    displayName:  "Google (Veo / Gemini)",
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    defaultModel: "veo-3.1",
    capabilities: ["text_generation", "video_generation"],
  },
  stability: {
    provider:     "stability",
    displayName:  "Stability AI",
    apiKeyEnvVar: "STABILITY_API_KEY",
    defaultModel: "sd3.5-large",
    capabilities: ["image_generation"],
  },
  elevenlabs: {
    provider:     "elevenlabs",
    displayName:  "ElevenLabs",
    apiKeyEnvVar: "ELEVENLABS_API_KEY",
    defaultModel: "eleven_multilingual_v2",
    capabilities: ["voice_generation"],
  },
};

export const PROVIDER_LABELS: Record<AIProviderSlug, string> = {
  anthropic:  "Anthropic Claude",
  openai:     "OpenAI",
  google:     "Google AI",
  stability:  "Stability AI",
  elevenlabs: "ElevenLabs",
};

// ── Creative Asset types ───────────────────────────────────────────────

export type AssetType = "video" | "image" | "carousel" | "text";
export type AssetSourceType = "generated" | "imported" | "external_url";
export type AssetStatus = "draft" | "ready" | "in_use" | "archived";

export interface CreativeAssetRecord {
  id:             string;
  name:           string;
  type:           AssetType;
  sourceType:     AssetSourceType;
  status:         AssetStatus;
  conceptId:      string | null;
  provider:       AIProviderSlug | null;
  url:            string | null;
  thumbnailUrl:   string | null;
  mimeType:       string | null;
  durationMs:     number | null;
  width:          number | null;
  height:         number | null;
  aspectRatio:    string | null;
  headline:       string | null;
  body:           string | null;
  callToAction:   string | null;
  tags:           string[] | null;
  notes:          string | null;
  createdAt:      Date;
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  video:    "Video",
  image:    "Image",
  carousel: "Carousel",
  text:     "Text / Copy",
};

export const ASSET_SOURCE_LABELS: Record<AssetSourceType, string> = {
  generated:    "AI Generated",
  imported:     "Imported",
  external_url: "External URL",
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  draft:    "Draft",
  ready:    "Ready",
  in_use:   "In Use",
  archived: "Archived",
};
