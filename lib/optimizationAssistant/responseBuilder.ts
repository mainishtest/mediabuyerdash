// ─── Optimization Assistant — Response Builder ────────────────────────────────
//
// Server-side only. Calls Anthropic API (or falls back to templates) to generate
// the summary text. Evidence, entities, and action links are built deterministically
// from context — they do not come from the LLM.

import { getAnthropicConfig } from "../providerExecution/config";
import { buildContextPrompt } from "./contextPrompt";
import { summarizeAssistantEvidence } from "./evidence";
import { buildOptimizationAssistantActionLinks, buildOptimizationAssistantEntityReferences } from "./actionLinks";
import { buildOptimizationAssistantSuggestions } from "./suggestions";
import type {
  OptimizationAssistantContext,
  OptimizationAssistantIntent,
  OptimizationAssistantResponse,
} from "./types";

// ── Anthropic call ────────────────────────────────────────────────────────────

const ANTHROPIC_VERSION = "2023-06-01";
const ASSISTANT_MODEL   = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are an AI assistant embedded in a media buying dashboard used by performance marketing operators.

Your role is to answer operational questions about campaign performance, budget pacing, experiments, creative, and approval workflows.

Rules:
- Answer using ONLY the data context provided. Do not fabricate metrics, campaign names, or dates.
- Be concise: 2–5 sentences. Lead with the most important finding.
- If data is missing or sparse, say so clearly and suggest what to check.
- Do not repeat the question back. Jump straight to the answer.
- Attribute numbers to their source (e.g. "CRM revenue", "7-day attribution").
- Do not recommend external tools, report styles, or features not in the data.
- Timezone note: dayparting uses the ad account timezone. Attribution window is 7 days. CRM is the source of truth for ROAS and CPA.`;

async function callAnthropic(contextText: string, question: string): Promise<string | null> {
  const config = getAnthropicConfig();
  if (!config.ready || !config.apiKey) return null;

  const model = config.model ?? ASSISTANT_MODEL;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         config.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role:    "user",
            content: `${contextText}\n\n---\n\nQuestion: ${question}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    const text = data?.content?.find((c) => c.type === "text")?.text ?? null;
    return text ? text.trim() : null;
  } catch {
    return null;
  }
}

// ── Template fallback ─────────────────────────────────────────────────────────
// Grounded text responses built from context data — available when no LLM key.

function buildTemplateResponse(
  ctx: OptimizationAssistantContext,
  intent: OptimizationAssistantIntent
): string {
  const s = ctx.summary;

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  switch (intent) {
    case "summarize_account_state": {
      const roasStr = s.overallRoas !== null ? ` Overall ROAS is ${s.overallRoas.toFixed(2)}× (CRM, 7-day).` : "";
      return `For ${ctx.dateFrom} to ${ctx.dateTo}, total spend was ${fmtCurrency(s.totalSpend)} with CRM revenue of ${fmtCurrency(s.totalRevenue)}.${roasStr} There are ${s.openAlerts} open alert${s.openAlerts !== 1 ? "s" : ""} and ${s.pendingApprovals} pending approval${s.pendingApprovals !== 1 ? "s" : ""}.${ctx.narrative ? " " + ctx.narrative.headline : ""}`;
    }

    case "explain_performance_drop": {
      const topAlert = ctx.alerts[0];
      const topKpiDrop = ctx.kpis.find((k) => k.deltaDirection === "down" && k.deltaPositive === true);
      if (topKpiDrop) {
        return `${topKpiDrop.label} is down${topKpiDrop.deltaLabel ? ` ${topKpiDrop.deltaLabel}` : ""} vs the prior period.${topAlert ? ` Top alert: ${topAlert.alertType.replace(/_/g, " ")} for ${topAlert.clientName}.` : ""} Review the alerts panel and pacing dashboard for contributing factors.`;
      }
      if (topAlert) {
        return `The top active alert is a ${topAlert.severity} severity ${topAlert.alertType.replace(/_/g, " ")} for ${topAlert.clientName}. ${topAlert.body.slice(0, 120)} Check reconciliation data for the full picture.`;
      }
      return `No significant performance drops detected in the current period. ROAS is ${s.overallRoas !== null ? s.overallRoas.toFixed(2) + "×" : "not available"} and spend is ${fmtCurrency(s.totalSpend)}.`;
    }

    case "identify_goal_risk": {
      const risky = ctx.pacingItems.filter((p) => p.status !== "on_pacing");
      if (risky.length === 0) return `All ${ctx.pacingItems.length} tracked client${ctx.pacingItems.length !== 1 ? "s" : ""} are on-pacing for the current period. No immediate goal risk detected.`;
      const top = risky[0];
      return `${risky.length} client${risky.length !== 1 ? "s" : ""} show pacing risk. Most urgent: ${top.clientName} at ${top.pacingPct.toFixed(0)}% paced (${top.status.replace(/_/g, " ")}). Review the pacing dashboard and consider budget or bid adjustments.`;
    }

    case "recommend_next_actions": {
      const critPriorities = ctx.topPriorities.filter((p) => p.priority === "critical" || p.priority === "high");
      if (critPriorities.length > 0) {
        const top = critPriorities[0];
        return `Your highest priority is: ${top.title} — ${top.subtitle}${top.clientName ? ` (${top.clientName})` : ""}. There are ${s.pendingApprovals} approval${s.pendingApprovals !== 1 ? "s" : ""} waiting and ${s.openAlerts} open alert${s.openAlerts !== 1 ? "s" : ""}. Start with the approval queue and Command Center.`;
      }
      return `No critical issues found. ${s.pendingApprovals} approval${s.pendingApprovals !== 1 ? "s" : ""} are pending review. Check the Command Center for the full priority queue.`;
    }

    case "explain_winner": {
      const winners = ctx.experiments.filter((e) => e.outcome === "winner_found");
      const highLearning = ctx.learnings.find((l) => l.confidence === "high" && !l.category.includes("poor") && !l.category.includes("fatigue"));
      if (winners.length > 0) {
        const w = winners[0];
        return `${w.name} has a declared winner${w.winningVariant ? `: ${w.winningVariant}` : ""}. ${highLearning ? `Top learning: ${highLearning.insightText.slice(0, 100)}` : ""} Open the experiments page to see the full outcome and recommendations.`;
      }
      if (highLearning) {
        return `No experiment winners declared in this period. Top high-confidence learning: ${highLearning.insightText.slice(0, 120)} See learning memory for the full pattern library.`;
      }
      return `No winners or high-confidence learnings found in this period. ${s.activeExperiments} experiment${s.activeExperiments !== 1 ? "s" : ""} are currently running.`;
    }

    case "explain_loser": {
      const drops = ctx.kpis.filter((k) => k.deltaDirection === "down" && k.deltaPositive === true);
      const fatigueLearning = ctx.learnings.find((l) => l.category === "fatigue_pattern" || l.category === "poor_performer_pattern");
      if (drops.length > 0) {
        return `${drops.map((k) => `${k.label} is down${k.deltaLabel ? ` ${k.deltaLabel}` : ""}`).join(", ")} vs prior period.${fatigueLearning ? ` Possible cause: ${fatigueLearning.insightText.slice(0, 100)}` : ""} Review alerts and optimization recommendations.`;
      }
      return `No significant underperformers detected this period based on available data. Check the optimization dashboard for campaign-level detail.`;
    }

    case "summarize_creative_fatigue": {
      const readyCount = ctx.creativeItems.filter((c) => c.direction === "ready_to_publish").length;
      const fatigue = ctx.learnings.filter((l) => l.category === "fatigue_pattern");
      return `${ctx.creativeItems.length} creative${ctx.creativeItems.length !== 1 ? "s" : ""} are in the pipeline; ${readyCount} ready to publish.${fatigue.length > 0 ? ` ${fatigue.length} fatigue pattern${fatigue.length !== 1 ? "s" : ""} captured in learning memory.` : ""} Open Creative Lab for refresh queue and new brief options.`;
    }

    case "summarize_experiment_status": {
      const active  = ctx.experiments.filter((e) => e.status === "active" || e.status === "evaluating").length;
      const winners = ctx.experiments.filter((e) => e.outcome === "winner_found").length;
      return `${ctx.experiments.length} experiment${ctx.experiments.length !== 1 ? "s" : ""} tracked: ${active} active, ${winners} with a declared winner. ${ctx.learningSummary} Open the experiments page for outcome details and recommended actions.`;
    }

    case "identify_pending_approvals": {
      if (s.pendingApprovals === 0) return "No approvals are currently pending. The automation queue is clear.";
      const top = ctx.approvals[0];
      return `${s.pendingApprovals} approval${s.pendingApprovals !== 1 ? "s" : ""} pending. Top item: ${top?.clientName} — ${top?.actionType.replace(/_/g, " ")}: ${top?.rationale.slice(0, 100)} Open the automation page to review and approve.`;
    }

    case "find_highest_priority_issue":
    default: {
      const top = ctx.topPriorities[0];
      if (!top) return `No high-priority issues detected in the current period. All metrics appear stable. Spend: ${fmtCurrency(s.totalSpend)}, ROAS: ${s.overallRoas !== null ? s.overallRoas.toFixed(2) + "×" : "N/A"}.`;
      return `Highest priority: [${top.priority.toUpperCase()}] ${top.title} — ${top.subtitle}${top.clientName ? ` (${top.clientName})` : ""}. There are ${s.pendingApprovals} pending approval${s.pendingApprovals !== 1 ? "s" : ""} and ${s.openAlerts} open alert${s.openAlerts !== 1 ? "s" : ""}.`;
    }
  }
}

// ── Main response builder ─────────────────────────────────────────────────────

export async function buildOptimizationAssistantResponse(
  ctx: OptimizationAssistantContext,
  intent: OptimizationAssistantIntent,
  question: string
): Promise<OptimizationAssistantResponse> {
  // 1. Build deterministic parts (evidence, entities, action links, suggestions)
  const evidence    = summarizeAssistantEvidence(ctx, intent);
  const entities    = buildOptimizationAssistantEntityReferences(ctx, intent);
  const actionLinks = buildOptimizationAssistantActionLinks(ctx, intent);
  const suggestions = buildOptimizationAssistantSuggestions(intent);

  // 2. Try LLM summary; fall back to template
  const contextText  = buildContextPrompt(ctx);
  const aiSummary    = await callAnthropic(contextText, question);
  const isGrounded   = true; // always true — evidence is deterministic
  const summary      = aiSummary ?? buildTemplateResponse(ctx, intent);

  return {
    summary,
    intent,
    evidence,
    entities,
    actionLinks,
    suggestions,
    dataWarnings: ctx.dataWarnings,
    isGrounded,
    generatedAt: new Date().toISOString(),
  };
}
