// Video Ad Generator V2 — Veo Render Engine Stub
//
// Well-typed client for Google Veo 3.1 video generation.
// The API calls throw "not yet available" — this is intentional.
// composeScenePrompt() IS implemented so the UI can preview what
// Veo will receive before the API goes live.

import { VideoAdGenError } from "./anthropic";
import type {
  SceneRenderBrief,
  VeoModel,
  VeoJobRequest,
  VeoJobStatus,
} from "./types";

// ── Veo client ──────────────────────────────────────────────────────

export class VeoClient {
  private apiKey: string;
  private model: VeoModel;
  private endpoint: string;

  constructor(config: { apiKey?: string; model?: VeoModel } = {}) {
    this.apiKey   = config.apiKey ?? process.env.VEO_API_KEY ?? "";
    this.model    = config.model  ?? "veo-3.1";
    this.endpoint = process.env.VEO_API_ENDPOINT ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  async submitJob(request: VeoJobRequest): Promise<{ jobId: string }> {
    throw new VideoAdGenError(
      "Veo API is not yet available. The render brief has been compiled and stored — " +
      "video generation will run automatically once the Veo integration is activated."
    );
  }

  async checkJob(jobId: string): Promise<VeoJobStatus> {
    throw new VideoAdGenError("Veo API is not yet available.");
  }

  async cancelJob(jobId: string): Promise<void> {
    throw new VideoAdGenError("Veo API is not yet available.");
  }
}

// ── Scene prompt composer (IMPLEMENTED) ─────────────────────────────
//
// Deterministic function that transforms a SceneRenderBrief into the
// text prompt that would be sent to Veo. This lets the UI show exactly
// what the render engine will receive.

export function composeScenePrompt(scene: SceneRenderBrief): string {
  const lines: string[] = [];

  // Visual description — the core prompt
  lines.push(`[Scene ${scene.sceneNumber}] ${scene.environment.setting}`);
  lines.push("");

  // Camera
  const shotLabel = scene.cameraFraming.shotType.replace(/_/g, " ");
  const angleLabel = scene.cameraFraming.verticalAngle.replace(/_/g, " ");
  const moveLabel = scene.cameraMovement.type.replace(/_/g, " ");
  lines.push(`Camera: ${shotLabel}, ${angleLabel}. ${moveLabel !== "static" ? `${scene.cameraMovement.speed} ${moveLabel}.` : "Static camera."}`);

  // Visual tone
  const { lighting, colorPalette, mood, texture } = scene.visualTone;
  lines.push(`Lighting: ${lighting}. Color: ${colorPalette}. Mood: ${mood}. Texture: ${texture}.`);

  // Environment details
  if (scene.environment.keyProps.length > 0) {
    lines.push(`Props: ${scene.environment.keyProps.join(", ")}.`);
  }
  lines.push(`Time of day: ${scene.environment.timeOfDay.replace(/_/g, " ")}. Weather: ${scene.environment.weather}.`);

  // Subject / action (derived from spoken dialogue)
  if (scene.spokenDialogue) {
    lines.push("");
    lines.push(`Subject speaks: "${scene.spokenDialogue}"`);
    lines.push(`Delivery: ${scene.audioGuidance.spokenDelivery}, ${scene.audioGuidance.pace} pace.`);
  }

  // On-screen text overlay (Veo won't render text, but it's useful context)
  if (scene.onScreenTexts.length > 0) {
    lines.push("");
    lines.push("On-screen text overlays (for post-production):");
    for (const ost of scene.onScreenTexts) {
      lines.push(`  "${ost.text}" [${ost.style}] at ${ost.timing}`);
    }
  }

  // Technical
  lines.push("");
  lines.push(`Duration: ${scene.durationSec}s. Aspect ratio: ${scene.aspectRatio}.`);

  // Brand constraints
  if (scene.brandConstraints.forbiddenElements.length > 0) {
    lines.push(`Avoid: ${scene.brandConstraints.forbiddenElements.slice(0, 3).join("; ")}.`);
  }

  // Render priority note
  if (scene.renderPriority === "critical") {
    lines.push("PRIORITY: This is the hook scene — highest quality required.");
  } else if (scene.renderPriority === "optional") {
    lines.push("PRIORITY: B-roll scene — acceptable at lower quality.");
  }

  return lines.join("\n");
}

// ── Negative prompt composer ────────────────────────────────────────

export function composeNegativePrompt(scene: SceneRenderBrief): string {
  const negatives: string[] = [
    "text on screen",
    "watermarks",
    "blurry",
    "low quality",
    "distorted faces",
    "extra limbs",
    ...scene.brandConstraints.forbiddenElements.map((e) => e.toLowerCase()),
  ];
  return negatives.join(", ");
}

// ── Build full VeoJobRequest from a scene ───────────────────────────

export function buildVeoJobRequest(
  scene: SceneRenderBrief,
  model: VeoModel = "veo-3.1"
): VeoJobRequest {
  // Use lite model for non-critical scenes to save cost
  const effectiveModel: VeoModel =
    scene.renderPriority === "optional" || scene.renderPriority === "standard"
      ? "veo-3.1-lite"
      : model;

  return {
    model:          effectiveModel,
    prompt:         composeScenePrompt(scene),
    negativePrompt: composeNegativePrompt(scene),
    durationSec:    scene.durationSec,
    aspectRatio:    scene.aspectRatio,
    referenceImages: scene.referenceImages.map((r) => r.url),
  };
}
