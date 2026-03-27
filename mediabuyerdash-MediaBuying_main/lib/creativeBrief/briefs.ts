// lib/creativeBrief/briefs.ts
// Creative brief generation logic — pure functions, no DB, no side effects.
//
// Input:  CreativeBriefInput (assembled from CreativeRefreshQueueItem context)
// Output: CreativeBrief with structured sections + generated draft variants
//
// Architecture rules:
//   - All functions are pure — deterministic from the same input.
//   - Reuses existing copyVariationGenerator and imageVariationGenerator.
//   - CRM is the source of truth for ROAS/CPA throughout.
//   - Designed to accept real AI generation in place of mock functions later.

import { generateCopyVariations }  from "../copyVariationGenerator";
import { generateImageVariations } from "../imageVariationGenerator";
import type { CreativeDiagnosisInput } from "../../types/creativeDiagnosis";
import type {
  CreativeBriefInput,
  CreativeBrief,
  CreativeBriefSection,
  CreativeDraftSet,
  CreativeDraftVariant,
  CreativeDraftType,
  CreativeGenerationIntent,
  CreativeDraftSummary,
  CreativeBriefStatus,
} from "../../types/creativeBrief";

// ---------------------------------------------------------------------------
// Thresholds (aligned with fatigue detector and performance evaluator)
// ---------------------------------------------------------------------------

const WEAK_CTR   = 0.8;
const POOR_ROAS  = 1.0;
const WATCH_FREQ = 2.5;
const HIGH_FREQ  = 3.5;

// ---------------------------------------------------------------------------
// 1. inferGenerationIntent
// Maps signal context to a strategic generation intent.
// First match wins — most severe case takes precedence.
// ---------------------------------------------------------------------------

export function inferGenerationIntent(input: CreativeBriefInput): CreativeGenerationIntent {
  const { fatigueStatus, evaluationStatus, avgCtr, avgFrequency, campaignRoas } = input;

  // Complete reset: multiple critical failures
  if (
    fatigueStatus === "severe_fatigue" ||
    (evaluationStatus === "weak" && campaignRoas !== null && campaignRoas < POOR_ROAS)
  ) {
    return "full_reset";
  }

  // Fatigued audience + weak CTR → visual hook is exhausted
  if (
    fatigueStatus === "fatigued" &&
    avgFrequency !== null && avgFrequency > HIGH_FREQ &&
    avgCtr < WEAK_CTR
  ) {
    return "refresh_visual_direction";
  }

  // Fatigued audience + OK CTR → copy angle wearing thin
  if (fatigueStatus === "fatigued" || (avgFrequency !== null && avgFrequency > HIGH_FREQ)) {
    return "refresh_angle";
  }

  // Weak CTR only (no severe fatigue) → hook is the problem
  if (avgCtr < WEAK_CTR) {
    return "refresh_hook";
  }

  // Watch + strong ROAS → winning pattern, just prevent fatigue
  if (
    fatigueStatus === "watch" &&
    campaignRoas !== null && campaignRoas >= 2.0
  ) {
    return "preserve_winner_pattern";
  }

  // Default for watch and mild underperformance
  return "refresh_hook";
}

// ---------------------------------------------------------------------------
// 2. summarizeCreativeWeaknesses
// Derives human-readable weakness statements from signal context.
// ---------------------------------------------------------------------------

export function summarizeCreativeWeaknesses(input: CreativeBriefInput): string[] {
  const weaknesses: string[] = [];
  const { avgCtr, avgFrequency, campaignRoas, campaignCpa, fatigueStatus, evaluationStatus } = input;

  if (avgCtr < 0.5) {
    weaknesses.push(`CTR ${avgCtr.toFixed(2)}% — engagement has collapsed well below the 0.8% baseline`);
  } else if (avgCtr < WEAK_CTR) {
    weaknesses.push(`CTR ${avgCtr.toFixed(2)}% — below the 0.8% effective threshold; hook is not stopping the scroll`);
  }

  if (avgFrequency !== null && avgFrequency > HIGH_FREQ) {
    weaknesses.push(`Frequency ${avgFrequency.toFixed(1)}x — audience is overexposed and tuning out the creative`);
  } else if (avgFrequency !== null && avgFrequency > WATCH_FREQ) {
    weaknesses.push(`Frequency ${avgFrequency.toFixed(1)}x — approaching the fatigue threshold; audience is tiring of this creative`);
  }

  if (campaignRoas !== null && campaignRoas < POOR_ROAS) {
    weaknesses.push(`Campaign ROAS ${campaignRoas.toFixed(2)}x (CRM-verified) — spending more than earning`);
  } else if (campaignRoas !== null && campaignRoas < 1.5) {
    weaknesses.push(`Campaign ROAS ${campaignRoas.toFixed(2)}x (CRM-verified) — below comfortable threshold`);
  }

  if (fatigueStatus === "severe_fatigue") {
    weaknesses.push("Severe audience fatigue — multiple critical signals converging simultaneously");
  } else if (fatigueStatus === "fatigued") {
    weaknesses.push("Audience fatigue confirmed — the creative needs replacement before performance drops further");
  }

  if (evaluationStatus === "weak") {
    weaknesses.push("Overall evaluation: weak — the creative is underperforming against goal");
  }

  if (input.signalSummary.length > 0) {
    for (const sig of input.signalSummary.slice(0, 3)) {
      if (!weaknesses.some((w) => w.includes(sig.substring(0, 20)))) {
        weaknesses.push(sig);
      }
    }
  }

  return weaknesses.length > 0
    ? weaknesses
    : ["Performance is below the threshold that triggered this refresh review"];
}

// ---------------------------------------------------------------------------
// 3. summarizeCreativeStrengths
// Identifies what is still working — preserved in the refresh brief.
// ---------------------------------------------------------------------------

export function summarizeCreativeStrengths(input: CreativeBriefInput): string[] {
  const strengths: string[] = [];
  const { avgCtr, campaignRoas, fatigueStatus, avgFrequency } = input;

  // CTR is holding despite fatigue
  if (avgCtr >= 1.5 && fatigueStatus !== "healthy") {
    strengths.push(`CTR ${avgCtr.toFixed(2)}% — the hook is still engaging; visual direction is working`);
  } else if (avgCtr >= 0.8) {
    strengths.push(`CTR ${avgCtr.toFixed(2)}% — hook engagement is reasonable; the opening frame is working`);
  }

  // ROAS is acceptable
  if (campaignRoas !== null && campaignRoas >= 2.0) {
    strengths.push(`ROAS ${campaignRoas.toFixed(2)}x (CRM-verified) — the offer converts when the audience is fresh`);
  } else if (campaignRoas !== null && campaignRoas >= 1.0) {
    strengths.push(`ROAS ${campaignRoas.toFixed(2)}x (CRM-verified) — the offer is profitable; creative is the constraint`);
  }

  // Frequency is manageable
  if (avgFrequency !== null && avgFrequency < WATCH_FREQ) {
    strengths.push(`Frequency ${avgFrequency.toFixed(1)}x — audience exposure is still within a healthy range`);
  }

  if (input.callToAction) {
    strengths.push(`CTA "${input.callToAction}" — retain this in the refreshed variant unless testing a new angle`);
  }

  return strengths.length > 0
    ? strengths
    : ["No clear strengths identified — consider a full reset approach"];
}

// ---------------------------------------------------------------------------
// 4. buildCreativeBriefSections
// Assembles the structured brief document from input context.
// ---------------------------------------------------------------------------

function buildCreativeBriefSections(
  input:   CreativeBriefInput,
  intent:  CreativeGenerationIntent,
  draftType: CreativeDraftType,
): CreativeBriefSection[] {
  const weaknesses = summarizeCreativeWeaknesses(input);
  const strengths  = summarizeCreativeStrengths(input);

  const intentLabel: Record<CreativeGenerationIntent, string> = {
    preserve_winner_pattern:  "Preserve winner pattern — extend creative life",
    refresh_hook:             "Refresh the hook — new opening that stops the scroll",
    refresh_angle:            "Refresh the message angle — new positioning and framing",
    refresh_visual_direction: "Refresh visual direction — new image concept or scene",
    full_reset:               "Full reset — new hook, new visual, new copy angle",
  };

  const spendStr = `$${Math.round(input.spend)}`;
  const roasStr  = input.campaignRoas != null ? `${input.campaignRoas.toFixed(2)}x ROAS (CRM)` : "ROAS: pending reconciliation";
  const ctrStr   = `${input.avgCtr.toFixed(2)}% CTR`;
  const freqStr  = input.avgFrequency != null ? `${input.avgFrequency.toFixed(1)}x frequency` : "frequency: unavailable";

  const sections: CreativeBriefSection[] = [
    {
      key:     "context",
      heading: "Source Creative Context",
      content: [
        `**Client:** ${input.clientName}`,
        input.campaignName ? `**Campaign:** ${input.campaignName}` : null,
        input.creativeName ? `**Creative:** ${input.creativeName}` : null,
        input.adCopy       ? `**Current copy:** "${input.adCopy.slice(0, 200)}${input.adCopy.length > 200 ? "…" : ""}"` : null,
        input.callToAction ? `**Current CTA:** ${input.callToAction}` : null,
      ].filter(Boolean).join("\n"),
    },
    {
      key:     "performance",
      heading: "Performance Summary",
      content: [
        `14-day window: **${spendStr} spend**, **${ctrStr}**, **${freqStr}**`,
        `Conversion: **${roasStr}**${input.campaignCpa != null ? `, **$${input.campaignCpa.toFixed(2)} CPA (CRM)**` : ""}`,
        `Evaluation: **${input.evaluationStatus}** | Fatigue: **${input.fatigueStatus ?? "not assessed"}**`,
        "",
        `**Priority reason:** ${input.priorityReason}`,
      ].join("\n"),
    },
    {
      key:     "diagnosis",
      heading: "What is Not Working",
      content: weaknesses.map((w) => `- ${w}`).join("\n"),
    },
    {
      key:     "strengths",
      heading: "What to Preserve",
      content: strengths.map((s) => `- ${s}`).join("\n"),
    },
    {
      key:     "intent",
      heading: "Strategic Intent",
      content: [
        `**${intentLabel[intent]}**`,
        "",
        directionGuidance(intent, input, draftType),
      ].join("\n"),
    },
    {
      key:     "direction",
      heading: "Creative Direction",
      content: buildCreativeDirection(intent, input, draftType),
    },
    {
      key:     "success",
      heading: "Success Criteria",
      content: buildSuccessCriteria(input),
    },
  ];

  if (input.notes) {
    sections.push({
      key:     "notes",
      heading: "Buyer Notes",
      content: input.notes,
    });
  }

  return sections;
}

function directionGuidance(
  intent:    CreativeGenerationIntent,
  input:     CreativeBriefInput,
  draftType: CreativeDraftType,
): string {
  switch (intent) {
    case "preserve_winner_pattern":
      return "The offer and core message are working. The goal is to create fresh variants that look new to the audience while preserving the winning message structure. Do not change the offer or the CTA meaning.";
    case "refresh_hook":
      return "The opening is not stopping the scroll. The body and CTA may be acceptable. Focus variation effort on testing new hook angles — different emotional entry points, questions, or bold statements. Keep the body tight.";
    case "refresh_angle":
      return "The current message angle is not resonating. The audience needs to see this offer positioned differently. Explore new entry points: the problem they feel, the outcome they want, or the identity they aspire to.";
    case "refresh_visual_direction":
      return "The image is the bottleneck. CTR may be weak or frequency is building on an overexposed visual. The new image must stop the scroll in the first 0.3 seconds. Keep the copy structure but redesign the visual concept.";
    case "full_reset":
      return `This creative needs a complete rethink. The current hook, angle, and visual are not working together. Brief all three elements as if starting from zero — new concept, new positioning, new image direction. Spent ${input.spend > 0 ? `$${Math.round(input.spend)}` : "meaningful budget"} on the current version with insufficient return.`;
  }
}

function buildCreativeDirection(
  intent:    CreativeGenerationIntent,
  input:     CreativeBriefInput,
  draftType: CreativeDraftType,
): string {
  const lines: string[] = [];

  if (draftType === "copy_variation" || draftType === "headline_variation" || draftType === "angle_variation") {
    lines.push("**Approach for copy variants:**");
    lines.push("- Variation A: Outcome-led — open with the result the buyer most wants to achieve");
    lines.push("- Variation B: Problem-first — name the specific pain before presenting the solution");
    lines.push("- Variation C: Social proof — open with credibility signal or community validation");
    lines.push("");
    if (input.callToAction) {
      lines.push(`**Retain CTA:** "${input.callToAction}" — unless testing a CTA-specific angle`);
    }
    if (intent === "refresh_hook") {
      lines.push("**Hook only:** Keep body length and structure similar to original. Change the opening line and 1–2 supporting lines.");
    }
    if (intent === "refresh_angle") {
      lines.push("**Full copy:** Each variation should have a distinct entry angle. Do not use similar opening words across variations.");
    }
  }

  if (draftType === "image_brief" || draftType === "full_refresh_brief") {
    lines.push("**Approach for image variants:**");
    lines.push("- Concept A: Clean single focus — one subject, minimal text, maximum clarity");
    lines.push("- Concept B: Proof-led visual — show a result, metric, or customer moment");
    lines.push("- Concept C: Contrast frame — engineered eye path from visual → benefit → CTA");
    lines.push("");
    lines.push("**Visual requirements:**");
    lines.push("- Must communicate value in < 0.3 seconds on a mobile feed");
    lines.push("- Avoid text-heavy overlays that compress on small screens");
    lines.push("- Use high contrast between foreground subject and background");
  }

  return lines.join("\n");
}

function buildSuccessCriteria(input: CreativeBriefInput): string {
  const lines: string[] = [];

  const targetCtr  = Math.max(input.avgCtr * 1.3, 1.0).toFixed(2);
  const targetFreq = "< 3.5x over 14 days (avoid fatigue)";

  lines.push(`- **CTR target:** ≥ ${targetCtr}% (30% improvement on current ${input.avgCtr.toFixed(2)}%)`);
  lines.push(`- **Frequency:** ${targetFreq}`);

  if (input.campaignRoas !== null) {
    const targetRoas = Math.max(input.campaignRoas * 1.2, 1.5).toFixed(2);
    lines.push(`- **ROAS target:** ≥ ${targetRoas}x (CRM-verified, 20% improvement on ${input.campaignRoas.toFixed(2)}x)`);
  } else {
    lines.push("- **ROAS:** Run CRM reconciliation to set a specific target");
  }

  lines.push("- **Attribution window:** 7-day CRM click-to-conversion");
  lines.push("- **Evaluation window:** Review after 7–14 days with ≥ $50 spend per variant");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 5. buildCreativeBriefInput
// Assembles a CreativeBriefInput from a refresh queue item's fields.
// The caller passes the item's flat fields — no lib imports needed.
// ---------------------------------------------------------------------------

export function buildCreativeBriefInput(opts: {
  sourceItemId:            string;
  clientAccountId:         string;
  clientName:              string;
  campaignId:              string | null;
  campaignName:            string | null;
  creativeId:              string | null;
  creativeName:            string | null;
  spend:                   number;
  impressions:             number;
  clicks:                  number;
  avgCtr:                  number;
  avgFrequency:            number | null;
  campaignRoas:            number | null;
  campaignCpa:             number | null;
  adCopy:                  string | null;
  callToAction:            string | null;
  thumbnailUrl:            string | null;
  fatigueStatus:           string | null;
  evaluationStatus:        string;
  priorityReason:          string;
  signalLabels:            string[];
  recommendedActionType:   string;
  recommendationRationale: string;
  notes?:                  string | null;
}): CreativeBriefInput {
  return {
    sourceItemId:            opts.sourceItemId,
    clientAccountId:         opts.clientAccountId,
    clientName:              opts.clientName,
    campaignId:              opts.campaignId,
    campaignName:            opts.campaignName,
    creativeId:              opts.creativeId,
    creativeName:            opts.creativeName,
    spend:                   opts.spend,
    impressions:             opts.impressions,
    clicks:                  opts.clicks,
    avgCtr:                  opts.avgCtr,
    avgFrequency:            opts.avgFrequency,
    campaignRoas:            opts.campaignRoas,
    campaignCpa:             opts.campaignCpa,
    adCopy:                  opts.adCopy,
    callToAction:            opts.callToAction,
    thumbnailUrl:            opts.thumbnailUrl,
    fatigueStatus:           opts.fatigueStatus,
    evaluationStatus:        opts.evaluationStatus,
    priorityReason:          opts.priorityReason,
    signalSummary:           opts.signalLabels,
    recommendedActionType:   opts.recommendedActionType,
    recommendationRationale: opts.recommendationRationale,
    notes:                   opts.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// 6. buildCreativeDraftSet
// Generates draft variants for the given draft type.
// Uses existing copy/image generators — replace function bodies for real AI.
// ---------------------------------------------------------------------------

export function buildCreativeDraftSet(
  input:     CreativeBriefInput,
  draftType: CreativeDraftType,
  intent:    CreativeGenerationIntent,
): CreativeDraftSet {
  const generatedAt = new Date().toISOString();

  // Build a CreativeDiagnosisInput compatible with existing generators.
  // Generators only use adId, adName, and cpaGoalValue — other fields use safe defaults.
  const diagInput: CreativeDiagnosisInput = {
    adId:         input.creativeId   ?? input.sourceItemId,
    adName:       input.creativeName ?? "Creative",
    campaignId:   input.campaignId   ?? "",
    campaignName: input.campaignName ?? "",
    actualCpa:    input.campaignCpa  ?? 0,
    actualRoas:   input.campaignRoas ?? 0,
    spend:        input.spend,
    conversions:  0,
    cpaGoalValue: input.campaignCpa  ?? 0,
    cpaGoalType:  "low",
    roasGoalValue: input.campaignRoas ?? 0,
    roasGoalType:  "high",
    copy: {
      hook:         input.adCopy?.slice(0, 100) ?? "",
      body:         input.adCopy ?? "",
      callToAction: input.callToAction ?? "",
    },
    image: {
      imageHeadline:   "",
      imageStyle:      "",
      dominantMessage: "",
      visualTheme:     "",
    },
  };

  let variants: CreativeDraftVariant[];

  if (draftType === "image_brief" || draftType === "full_refresh_brief") {
    const imageConcepts = generateImageVariations(diagInput);
    variants = imageConcepts.map((c) => ({
      id:            c.id,
      variantType:   "image" as const,
      title:         c.title,
      conceptSummary: c.conceptSummary,
      visualChanges:  c.visualChanges,
      goal:           c.goal,
      reviewDecision: null,
      reviewNote:     null,
      reviewedAt:     null,
    }));

    // For full_refresh_brief, also include one copy variant
    if (draftType === "full_refresh_brief") {
      const copyVars = generateCopyVariations(diagInput);
      const copyVariants: CreativeDraftVariant[] = copyVars.slice(0, 1).map((v) => ({
        id:            v.id + "_brief",
        variantType:   "copy" as const,
        title:         "Copy Direction — " + v.title,
        hook:          v.hook,
        body:          v.body,
        callToAction:  v.callToAction,
        reviewDecision: null,
        reviewNote:    null,
        reviewedAt:    null,
      }));
      variants = [...copyVariants, ...variants];
    }
  } else {
    const copyVars = generateCopyVariations(diagInput);
    variants = copyVars.map((v) => ({
      id:            v.id,
      variantType:   "copy" as const,
      title:         v.title,
      hook:          v.hook,
      body:          v.body,
      callToAction:  v.callToAction,
      reviewDecision: null,
      reviewNote:    null,
      reviewedAt:    null,
    }));
  }

  return { draftType, intent, generatedAt, variants };
}

// ---------------------------------------------------------------------------
// 7. buildCreativeBrief
// Assembles the complete brief document.
// id should be a pre-generated cuid (from the DB insert or a client-generated id).
// ---------------------------------------------------------------------------

export function buildCreativeBrief(
  input:     CreativeBriefInput,
  draftType: CreativeDraftType,
  id:        string,
  now?:      string,
): CreativeBrief {
  const ts      = now ?? new Date().toISOString();
  const intent  = inferGenerationIntent(input);
  const sections = buildCreativeBriefSections(input, intent, draftType);
  const draftSet = buildCreativeDraftSet(input, draftType, intent);

  return {
    id,
    sourceItemId:    input.sourceItemId,
    draftType,
    intent,
    status:          "draft",
    clientAccountId: input.clientAccountId,
    clientName:      input.clientName,
    campaignId:      input.campaignId,
    campaignName:    input.campaignName,
    creativeId:      input.creativeId,
    creativeName:    input.creativeName,
    input,
    sections,
    draftSet,
    notes:           input.notes,
    createdAt:       ts,
    updatedAt:       ts,
  };
}

// ---------------------------------------------------------------------------
// 8. buildCreativeReviewSummary
// Aggregate counts for stat cards.
// ---------------------------------------------------------------------------

export function buildCreativeReviewSummary(briefs: CreativeBrief[]): CreativeDraftSummary {
  let draft = 0, inReview = 0, approved = 0, rejected = 0, revisionRequested = 0;

  for (const b of briefs) {
    switch (b.status) {
      case "draft":              draft++;             break;
      case "in_review":          inReview++;          break;
      case "approved":           approved++;          break;
      case "rejected":           rejected++;          break;
      case "revision_requested": revisionRequested++; break;
    }
  }

  return {
    total: briefs.length,
    draft,
    inReview,
    approved,
    rejected,
    revisionRequested,
  };
}
