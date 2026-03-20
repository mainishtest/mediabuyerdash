// lib/creativeGeneration/contextBrief.ts
// Bridges CreativeGenerationContext → CreativeBrief so the existing
// engine.ts prompt builders work without modification.
//
// The built brief is synthetic (never stored in DB by this module).
// It carries all context fields needed for performance-grounded prompts.
//
// Design rules:
//   - Pure function — no side effects, no DB calls.
//   - Always returns a valid CreativeBrief even with sparse data.
//   - CRM-verified fields (currentRoas, currentCpa) flow through unchanged.

import type {
  CreativeBrief,
  CreativeBriefInput,
  CreativeBriefSection,
} from "../../types/creativeBrief";
import type { CreativeGenerationContext } from "../../types/creativeGeneration";

// ---------------------------------------------------------------------------
// Main bridge
// ---------------------------------------------------------------------------

export function buildContextBrief(ctx: CreativeGenerationContext): CreativeBrief {
  const input: CreativeBriefInput = {
    sourceItemId:            `ctx-${ctx.clientAccountId}-${ctx.creativeId ?? "unknown"}`,
    clientAccountId:         ctx.clientAccountId,
    clientName:              ctx.clientName,
    campaignId:              ctx.campaignId,
    campaignName:            ctx.campaignName,
    creativeId:              ctx.creativeId,
    creativeName:            ctx.creativeName,
    spend:                   ctx.currentSpend,
    impressions:             0,   // not needed by prompt builders
    clicks:                  0,
    avgCtr:                  ctx.currentCtr,
    avgFrequency:            ctx.currentFrequency,
    campaignRoas:            ctx.currentRoas,    // CRM-verified
    campaignCpa:             ctx.currentCpa,     // CRM-verified
    adCopy:                  ctx.currentCopy,
    callToAction:            ctx.currentCta,
    thumbnailUrl:            ctx.hasThumbnail ? "has-thumbnail" : null,
    fatigueStatus:           ctx.fatigueStatus,
    evaluationStatus:        ctx.evaluationStatus,
    priorityReason:          ctx.triggerRationale,
    signalSummary:           buildSignalSummary(ctx),
    recommendedActionType:   triggerToActionType(ctx.triggerType),
    recommendationRationale: ctx.triggerRationale,
    notes:                   buildLearningNote(ctx),
  };

  const intent  = triggerToIntent(ctx.triggerType, ctx.evaluationStatus);
  const sections = buildSections(ctx);

  return {
    id:              `ctx-brief-${crypto.randomUUID()}`,
    sourceItemId:    input.sourceItemId,
    draftType:       "full_refresh_brief",
    intent,
    status:          "draft",
    clientAccountId: ctx.clientAccountId,
    clientName:      ctx.clientName,
    campaignId:      ctx.campaignId,
    campaignName:    ctx.campaignName,
    creativeId:      ctx.creativeId,
    creativeName:    ctx.creativeName,
    input,
    sections,
    draftSet: {
      draftType:   "full_refresh_brief",
      intent,
      generatedAt: new Date().toISOString(),
      variants:    [],
    },
    notes:     null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSignalSummary(ctx: CreativeGenerationContext): string[] {
  const signals: string[] = [];
  if (ctx.currentCtr < 0.8)                                          signals.push(`CTR ${ctx.currentCtr.toFixed(2)}% — below 0.8% threshold`);
  if (ctx.currentFrequency != null && ctx.currentFrequency > 3.5)   signals.push(`Frequency ${ctx.currentFrequency.toFixed(1)}x — high`);
  if (ctx.currentRoas != null && ctx.currentRoas < 1.5)              signals.push(`ROAS ${ctx.currentRoas.toFixed(2)}x — below 1.5x`);
  if (ctx.winningPatterns.length > 0)                                signals.push(`${ctx.winningPatterns.length} winning pattern(s) from learning memory`);
  if (ctx.losingPatterns.length > 0)                                 signals.push(`${ctx.losingPatterns.length} losing pattern(s) to avoid`);
  if (ctx.dataQuality === "sparse")                                  signals.push("Sparse data — limited performance history");
  return signals;
}

function triggerToActionType(trigger: CreativeGenerationContext["triggerType"]): string {
  switch (trigger) {
    case "fatigue":          return "refresh_creative";
    case "underperformance": return "replace_creative";
    case "opportunity":      return "scale_creative";
    case "manual":           return "generate_variants";
  }
}

function triggerToIntent(
  trigger: CreativeGenerationContext["triggerType"],
  status:  string,
): CreativeBrief["intent"] {
  if (trigger === "opportunity") return "preserve_winner_pattern";
  if (trigger === "fatigue")     return "refresh_hook";
  if (status  === "weak")        return "refresh_angle";
  return "full_reset";
}

function buildLearningNote(ctx: CreativeGenerationContext): string | null {
  if (ctx.winningPatterns.length === 0 && ctx.losingPatterns.length === 0) return null;
  const parts: string[] = [];
  if (ctx.winningPatterns.length > 0) parts.push(`Winning: ${ctx.winningPatterns.slice(0, 2).join("; ")}`);
  if (ctx.losingPatterns.length > 0)  parts.push(`Avoid: ${ctx.losingPatterns.slice(0, 2).join("; ")}`);
  return parts.join(" | ");
}

function buildSections(ctx: CreativeGenerationContext): CreativeBriefSection[] {
  const sections: CreativeBriefSection[] = [
    {
      key:     "context",
      heading: "Performance Context",
      content: [
        `**CTR:** ${ctx.currentCtr.toFixed(2)}%`,
        ctx.currentFrequency != null ? `**Frequency:** ${ctx.currentFrequency.toFixed(1)}x` : null,
        ctx.currentRoas      != null ? `**ROAS (CRM, 7-day):** ${ctx.currentRoas.toFixed(2)}x` : null,
        ctx.currentCpa       != null ? `**CPA (CRM-verified):** $${ctx.currentCpa.toFixed(2)}` : null,
        `**Spend:** $${Math.round(ctx.currentSpend)}`,
        `**Evaluation status:** ${ctx.evaluationStatus}`,
        ctx.dataQuality === "sparse" ? "⚠ Sparse data — limited performance history." : null,
      ].filter(Boolean).join("\n"),
    },
    {
      key:     "trigger",
      heading: "Generation Trigger",
      content: `**Trigger type:** ${ctx.triggerType}\n${ctx.triggerRationale}`,
    },
    {
      key:     "intent",
      heading: "Strategic Intent",
      content: triggerToIntent(ctx.triggerType, ctx.evaluationStatus).replace(/_/g, " "),
    },
  ];

  if (ctx.winningPatterns.length > 0 || ctx.losingPatterns.length > 0) {
    sections.push({
      key:     "learning",
      heading: "Learning Memory",
      content: [
        ctx.winningPatterns.length > 0
          ? `**Winning patterns:**\n${ctx.winningPatterns.map((p) => `- ${p}`).join("\n")}`
          : null,
        ctx.losingPatterns.length > 0
          ? `**Patterns to avoid:**\n${ctx.losingPatterns.map((p) => `- ${p}`).join("\n")}`
          : null,
      ].filter(Boolean).join("\n\n"),
    });
  }

  if (ctx.audienceInsights.length > 0) {
    sections.push({
      key:     "audience",
      heading: "Audience Insights",
      content: ctx.audienceInsights.map((a) => `- ${a}`).join("\n"),
    });
  }

  if (ctx.currentCopy) {
    sections.push({
      key:     "current_creative",
      heading: "Current Creative",
      content: `**Current copy:** "${ctx.currentCopy.slice(0, 300)}${ctx.currentCopy.length > 300 ? "…" : ""}"`,
    });
  }

  sections.push({
    key:     "direction",
    heading: "Creative Direction",
    content: buildCreativeDirection(ctx),
  });

  return sections;
}

function buildCreativeDirection(ctx: CreativeGenerationContext): string {
  const lines: string[] = [];

  if (ctx.triggerType === "fatigue") {
    lines.push("- **Refresh the hook** — audience has seen this enough; the opening no longer stops the scroll.");
    lines.push("- **New angle, same offer** — the audience knows the product; change how you open the conversation.");
    lines.push("- **Preserve what works** — if ROAS is still positive, the offer and targeting are fine; change only the creative surface.");
  } else if (ctx.triggerType === "underperformance") {
    lines.push("- **CTR recovery is the primary goal** — the hook is not generating enough clicks.");
    lines.push("- **Test a stronger problem statement** — name the pain before presenting the solution.");
    lines.push("- **Try a different angle** — current positioning may not match the audience's primary motivation.");
  } else if (ctx.triggerType === "opportunity") {
    lines.push("- **Preserve the winning pattern** — this creative generates strong returns; extend its life with fresh variations.");
    lines.push("- **Maintain the core angle** — the message is working; test minor surface variations, not full resets.");
    lines.push("- **Prepare for scale** — generate variations ready for expanded targeting or increased spend.");
  } else {
    lines.push("- Generate diverse variations covering different angles and hooks.");
    lines.push("- Keep each variation distinct — no two hooks should start the same way.");
  }

  if (ctx.winningPatterns.length > 0) {
    lines.push("", "**Apply winning patterns from learning memory:**");
    ctx.winningPatterns.slice(0, 2).forEach((p) => lines.push(`- ${p}`));
  }

  if (ctx.losingPatterns.length > 0) {
    lines.push("", "**Avoid these losing patterns:**");
    ctx.losingPatterns.slice(0, 2).forEach((p) => lines.push(`- ${p}`));
  }

  return lines.join("\n");
}
