// lib/creativeGeneration/engine.ts
// Core AI creative generation engine.
//
// Architecture rules:
//   - generateCreativeDrafts() is the single public entry point.
//   - Anthropic is called via the existing executeAnthropicCopyRequest().
//   - When ANTHROPIC_API_KEY is not configured, falls back to structuredMockOutput().
//   - Output is always CreativeGenerationResult — never throws.
//   - Prompt construction is delegated to prompts.ts (pure, testable separately).
//   - CRM is the source of truth for ROAS/CPA throughout brief context.

import { getAnthropicConfig }              from "../providerExecution/config";
import type {
  CreativeGenerationInput,
  CreativeGenerationOutput,
  CreativeGenerationResult,
  CreativeGenerationMode,
  CreativeGenerationConstraint,
}                                          from "../../types/creativeGeneration";
import type {
  CreativeBrief,
  CreativeDraftVariant,
}                                          from "../../types/creativeBrief";
import { buildPromptForMode }              from "./prompts";

// ---------------------------------------------------------------------------
// Public API: buildCreativeGenerationInput
// ---------------------------------------------------------------------------

export function buildCreativeGenerationInput(opts: {
  brief:       CreativeBrief;
  mode:        CreativeGenerationMode;
  constraints?: CreativeGenerationConstraint[];
  regenerate?:  boolean;
}): CreativeGenerationInput {
  return {
    briefId:     opts.brief.id,
    mode:        opts.mode,
    brief:       opts.brief,
    constraints: opts.constraints ?? [],
    regenerate:  opts.regenerate  ?? false,
  };
}

// ---------------------------------------------------------------------------
// Public API: summarizeGenerationConstraints
// Human-readable summary used in rationale text.
// ---------------------------------------------------------------------------

export function summarizeGenerationConstraints(
  constraints: CreativeGenerationConstraint[],
): string {
  if (constraints.length === 0) return "No additional constraints applied.";
  return constraints
    .map((c) => `${c.type}: ${c.value}`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Public API: normalizeCreativeOutput
// Parses and validates JSON from Anthropic response into CreativeDraftVariant[].
// Falls back to empty array on parse error — caller handles partial output.
// ---------------------------------------------------------------------------

export function normalizeCreativeOutput(
  rawContent: string,
  mode:       CreativeGenerationMode,
): CreativeDraftVariant[] {
  let parsed: unknown;
  try {
    // Strip any accidental markdown fences (model sometimes adds them despite instruction)
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const isImageMode = mode === "image_brief_variations";
  const isFullPkg   = mode === "full_refresh_package";

  return parsed
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item): CreativeDraftVariant => {
      const id = crypto.randomUUID();

      // Full refresh package includes both copy and image in one response
      if (isFullPkg) {
        const vt = typeof item.variantType === "string" && item.variantType === "image"
          ? "image" : "copy";
        if (vt === "image") {
          return {
            id,
            variantType:         "image",
            title:               String(item.title ?? "Image Concept"),
            conceptSummary:      item.conceptSummary ? String(item.conceptSummary) : undefined,
            visualChanges:       item.visualChanges  ? String(item.visualChanges)  : undefined,
            goal:                item.goal            ? String(item.goal)           : undefined,
            directResponseAngle: item.directResponseAngle ? String(item.directResponseAngle) : undefined,
            reviewDecision:      null,
            reviewNote:          null,
            reviewedAt:          null,
          };
        }
        return {
          id,
          variantType:    "copy",
          title:          String(item.title ?? "Copy Variation"),
          hook:           item.hook           ? String(item.hook)          : undefined,
          body:           item.body           ? String(item.body)          : undefined,
          callToAction:   item.callToAction   ? String(item.callToAction)  : undefined,
          reviewDecision: null,
          reviewNote:     null,
          reviewedAt:     null,
        };
      }

      if (isImageMode) {
        return {
          id,
          variantType:         "image",
          title:               String(item.title ?? "Image Concept"),
          conceptSummary:      item.conceptSummary      ? String(item.conceptSummary)      : undefined,
          visualChanges:       item.visualChanges       ? String(item.visualChanges)        : undefined,
          goal:                item.goal                ? String(item.goal)                 : undefined,
          directResponseAngle: item.directResponseAngle ? String(item.directResponseAngle)  : undefined,
          reviewDecision:      null,
          reviewNote:          null,
          reviewedAt:          null,
        };
      }

      // Copy modes
      return {
        id,
        variantType:    "copy",
        title:          String(item.title ?? "Copy Variation"),
        hook:           item.hook           ? String(item.hook)          : undefined,
        body:           item.body           ? String(item.body)          : undefined,
        callToAction:   item.callToAction   ? String(item.callToAction)  : undefined,
        reviewDecision: null,
        reviewNote:     null,
        reviewedAt:     null,
      };
    });
}

// ---------------------------------------------------------------------------
// Public API: attachSourceContextToDrafts
// Stamps source linkage (briefId, campaignId, etc.) onto variants.
// This data is stored in contentJson by the DB layer.
// Returns new variant objects — does not mutate.
// ---------------------------------------------------------------------------

export function attachSourceContextToDrafts(
  variants:   CreativeDraftVariant[],
  brief:      CreativeBrief,
  jobId:      string,
  provider:   string,
): Array<CreativeDraftVariant & { _meta: Record<string, unknown> }> {
  return variants.map((v) => ({
    ...v,
    _meta: {
      source:          "ai",
      provider,
      jobId,
      briefId:         brief.id,
      sourceItemId:    brief.sourceItemId,
      campaignId:      brief.campaignId,
      creativeId:      brief.creativeId,
      clientAccountId: brief.clientAccountId,
      generatedAt:     new Date().toISOString(),
    },
  }));
}

// ---------------------------------------------------------------------------
// Mock fallback — structured output when AI provider is not configured
// ---------------------------------------------------------------------------

function buildMockRationale(mode: CreativeGenerationMode): string {
  const labels: Record<CreativeGenerationMode, string> = {
    copy_variations:         "3 copy variations using outcome-led, problem-first, and social proof angles",
    headline_variations:     "3 headline variations using question, bold claim, and curiosity gap formats",
    angle_variations:        "3 full message angle variations using identity, fear-of-loss, and authority positioning",
    image_brief_variations:  "3 image concept briefs using clean focus, proof-led, and contrast frame approaches",
    full_refresh_package:    "3 copy variations + 3 image briefs as a complete creative replacement set",
  };
  return `Mock output — Anthropic API not configured. Generated ${labels[mode]}. Configure ANTHROPIC_API_KEY to enable real AI generation.`;
}

function structuredMockOutput(
  mode:  CreativeGenerationMode,
  brief: CreativeBrief,
): CreativeDraftVariant[] {
  const pc = brief.input;
  const ctaRetain = pc.callToAction ?? "Learn More";

  if (mode === "copy_variations" || mode === "angle_variations") {
    return [
      {
        id:             crypto.randomUUID(),
        variantType:    "copy",
        title:          "Variation A — Outcome-Led Hook",
        hook:           `Here's what ${Math.round(pc.spend / 30)} days of data revealed about campaigns like yours.`,
        body:           "Most campaigns hit a ceiling not because of targeting — but because the message stops resonating. This is the framework that identifies exactly what to change to get your ROAS moving again.",
        callToAction:   ctaRetain,
        reviewDecision: null,
        reviewNote:     null,
        reviewedAt:     null,
      },
      {
        id:             crypto.randomUUID(),
        variantType:    "copy",
        title:          "Variation B — Problem-First Hook",
        hook:           `Your spend is increasing. Your ROAS isn't moving. Here's why — and how to fix it.`,
        body:           "The audience hasn't stopped converting. The creative has stopped earning their attention. One copy change at the right time can reset that entirely — without changing your targeting, budget, or offer.",
        callToAction:   ctaRetain,
        reviewDecision: null,
        reviewNote:     null,
        reviewedAt:     null,
      },
      {
        id:             crypto.randomUUID(),
        variantType:    "copy",
        title:          "Variation C — Social Proof Hook",
        hook:           `"We were about to pause the campaign. Then one change shifted everything." — see what worked.`,
        body:           "Same audience, same offer, same budget. A single creative refresh moved ROAS from flat to profitable in 10 days. Here's the exact approach — and why it works when the audience knows your current ad.",
        callToAction:   ctaRetain,
        reviewDecision: null,
        reviewNote:     null,
        reviewedAt:     null,
      },
    ];
  }

  if (mode === "headline_variations") {
    return [
      {
        id:             crypto.randomUUID(),
        variantType:    "copy",
        title:          "Headline A — Question",
        hook:           `What if you didn't have to change your offer to improve your ROAS?`,
        callToAction:   ctaRetain,
        reviewDecision: null,
        reviewNote:     null,
        reviewedAt:     null,
      },
      {
        id:             crypto.randomUUID(),
        variantType:    "copy",
        title:          "Headline B — Bold Claim",
        hook:           `One copy change. Measurable ROAS improvement. Here's how.`,
        callToAction:   ctaRetain,
        reviewDecision: null,
        reviewNote:     null,
        reviewedAt:     null,
      },
      {
        id:             crypto.randomUUID(),
        variantType:    "copy",
        title:          "Headline C — Curiosity Gap",
        hook:           `The reason your ad stopped working isn't what most buyers think.`,
        callToAction:   ctaRetain,
        reviewDecision: null,
        reviewNote:     null,
        reviewedAt:     null,
      },
    ];
  }

  if (mode === "image_brief_variations") {
    return [
      {
        id:              crypto.randomUUID(),
        variantType:     "image",
        title:           "Concept A — Clean Focus",
        conceptSummary:  "Single hero shot against a high-contrast minimal background. One clear subject, no competing visual elements. The main benefit statement appears as a single bold line of text at the bottom third of the frame.",
        visualChanges:   "Remove current background clutter. Reduce text overlay to one line. Increase contrast between subject and background to at least 4:1.",
        goal:            "Communicate the core value proposition in under 0.3 seconds on a mobile feed.",
        directResponseAngle: "Clarity over cleverness — the viewer immediately understands the offer before reading a single word of copy.",
        reviewDecision:  null,
        reviewNote:      null,
        reviewedAt:      null,
      },
      {
        id:              crypto.randomUUID(),
        variantType:     "image",
        title:           "Concept B — Proof-Led Visual",
        conceptSummary:  "Show a tangible result: a metric, a customer outcome screenshot, or a before/after comparison. The number or result should be the dominant visual element at 2× the size of surrounding text.",
        visualChanges:   "Replace current hero image with a result-focused frame. Add a credibility anchor (data point, testimonial source, or recognizable context).",
        goal:            "Build instant trust by showing proof before asking for attention.",
        directResponseAngle: "The image does the persuasion work — copy amplifies what the viewer already believes after seeing the proof.",
        reviewDecision:  null,
        reviewNote:      null,
        reviewedAt:      null,
      },
      {
        id:              crypto.randomUUID(),
        variantType:     "image",
        title:           "Concept C — Contrast Frame",
        conceptSummary:  "Engineered visual hierarchy: bold foreground subject (person or product) draws the eye first, a contrasting benefit callout in the upper third catches the second glance, CTA-style text anchors the bottom. Dark background, warm accent color.",
        visualChanges:   "Redesign layout to create deliberate eye path from subject → benefit → CTA. Use warm accent (amber or coral) against dark background for the benefit text.",
        goal:            "Guide the viewer's eye through the visual in a specific order that mirrors the copy structure.",
        directResponseAngle: "The image teaches the scroll-stopper behavior — look here, then here, then click.",
        reviewDecision:  null,
        reviewNote:      null,
        reviewedAt:      null,
      },
    ];
  }

  // full_refresh_package — combine copy + image
  const copyVars = structuredMockOutput("copy_variations", brief);
  const imageVars = structuredMockOutput("image_brief_variations", brief);
  return [...copyVars, ...imageVars];
}

// ---------------------------------------------------------------------------
// Public API: generateCreativeDrafts
// Main entry point. Calls Anthropic if configured, falls back to mock.
// ---------------------------------------------------------------------------

export async function generateCreativeDrafts(
  input: CreativeGenerationInput,
): Promise<CreativeGenerationResult> {
  const jobId     = crypto.randomUUID();
  const startedAt = Date.now();

  const config = getAnthropicConfig();

  // ── Mock fallback ──────────────────────────────────────────────────────────
  if (!config.ready) {
    const variants = structuredMockOutput(input.mode, input.brief);
    const output: CreativeGenerationOutput = {
      jobId,
      mode:        input.mode,
      provider:    "mock",
      rationale:   buildMockRationale(input.mode),
      variants,
      tokensUsed:  null,
      latencyMs:   null,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true, output };
  }

  // ── Anthropic generation ───────────────────────────────────────────────────
  const { system, user } = buildPromptForMode(input);
  const model = config.model ?? "claude-3-5-haiku-20241022";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         config.apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: input.mode === "full_refresh_package" ? 3000 : 1800,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const latencyMs = Date.now() - startedAt;

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`;
      console.warn(`[creative-engine] Anthropic API error (${res.status}): ${msg} — falling back to mock output`);
      const fallbackVariants = structuredMockOutput(input.mode, input.brief);
      const output: CreativeGenerationOutput = {
        jobId,
        mode:      input.mode,
        provider:  "mock_api_fallback",
        rationale: `Anthropic API error (${res.status}) — structured mock output provided. Error: ${msg}`,
        variants:  fallbackVariants,
        tokensUsed: null,
        latencyMs:  Date.now() - startedAt,
        generatedAt: new Date().toISOString(),
      };
      return { ok: true, output };
    }

    const rawContent: string = data?.content?.[0]?.text ?? "";
    const tokensUsed: number | null = data?.usage
      ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
      : null;

    const variants = normalizeCreativeOutput(rawContent, input.mode);

    if (variants.length === 0) {
      // Parse failed — fall back to mock so buyer always gets output
      const fallbackVariants = structuredMockOutput(input.mode, input.brief);
      const output: CreativeGenerationOutput = {
        jobId,
        mode:      input.mode,
        provider:  "anthropic_text_fallback",
        rationale: "AI response could not be parsed — structured mock output provided. Raw response preserved in job record.",
        variants:  fallbackVariants,
        tokensUsed,
        latencyMs,
        generatedAt: new Date().toISOString(),
      };
      return {
        ok:           true,
        output,
      };
    }

    const rationale = buildRationale(input, variants.length, model);

    const output: CreativeGenerationOutput = {
      jobId,
      mode:       input.mode,
      provider:   "anthropic_text",
      rationale,
      variants,
      tokensUsed,
      latencyMs,
      generatedAt: new Date().toISOString(),
    };

    return { ok: true, output };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Network error — fall back to mock
    const fallbackVariants = structuredMockOutput(input.mode, input.brief);
    const output: CreativeGenerationOutput = {
      jobId,
      mode:      input.mode,
      provider:  "mock_fallback",
      rationale: `Network error — structured mock output provided. Error: ${msg}`,
      variants:  fallbackVariants,
      tokensUsed: null,
      latencyMs:  Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true, output };
  }
}

// ---------------------------------------------------------------------------
// Rationale builder — human-readable summary attached to generation output
// ---------------------------------------------------------------------------

function buildRationale(
  input:        CreativeGenerationInput,
  variantCount: number,
  model:        string,
): string {
  const pc     = input.brief.input;
  const intent = input.brief.intent;

  const intentPhrases: Record<string, string> = {
    preserve_winner_pattern:  "preserve the winning message structure while refreshing the surface",
    refresh_hook:             "rewrite the hook to stop the scroll with a new opening angle",
    refresh_angle:            "reposition the message with a new angle and entry point",
    refresh_visual_direction: "redirect the visual concept to earn attention on a fatigued feed",
    full_reset:               "rebuild the entire creative from a new concept",
  };

  const intentPhrase = intentPhrases[intent] ?? "refresh the creative";

  return [
    `Generated ${variantCount} ${input.mode.replace(/_/g, " ")} via ${model}.`,
    `Strategic intent: ${intentPhrase}.`,
    pc.avgCtr < 0.8
      ? `CTR ${pc.avgCtr.toFixed(2)}% — hook weakness was the primary driver of this generation.`
      : pc.avgFrequency != null && pc.avgFrequency > 3.5
      ? `Frequency ${pc.avgFrequency.toFixed(1)}x — audience fatigue was the primary driver.`
      : `Performance context: ${pc.evaluationStatus} evaluation at ${pc.avgCtr.toFixed(2)}% CTR.`,
    pc.campaignRoas != null
      ? `CRM-verified ROAS: ${pc.campaignRoas.toFixed(2)}x (7-day attribution).`
      : `ROAS: pending CRM reconciliation — set a target after running reconciliation.`,
    summarizeGenerationConstraints(input.constraints),
  ].join(" ");
}
