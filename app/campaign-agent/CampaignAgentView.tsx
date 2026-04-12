"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { planCampaignAction, launchApprovedDraftAction } from "./actions";
import { runOptimizationScanAction } from "./optimizationActions";
import { runAccountAuditAction } from "./auditActions";
import type { CampaignDraft, AgentStep, AgentMessage } from "../../lib/campaignAgent/types";
import type { AgentType, RiskMode, AgentRecommendation, AuditResult } from "../../lib/agentFramework/types";
import type { OptimizationAnalysis } from "../../lib/optimizationAgent/types";
import { AgentJobSelector } from "./components/AgentJobSelector";
import { RiskModeSelector } from "./components/RiskModeSelector";
import { PreflightPanel } from "./components/PreflightPanel";
import { OptimizationPanel } from "./components/OptimizationPanel";
import { AuditHealthScore } from "./components/AuditHealthScore";

// ═══════════════════════════════════════════════════════════════════════════════
// Campaign Agent View — Multi-Agent Operator
// ═══════════════════════════════════════════════════════════════════════════════

const EXAMPLE_PROMPTS = [
  "Create a retargeting campaign for Wisdom. Use the top 3 ads from the past 30 days, $300/day budget, exclude purchasers.",
  "Launch a broad prospecting campaign with a $50/day budget. Target US women 25-45. Use our best performing video ad.",
  "Set up a traffic campaign to test our new landing page. $20/day, US only, all available creatives.",
];

export function CampaignAgentView() {
  // Agent type
  const [activeAgent, setActiveAgent] = useState<AgentType>("launch");

  // Shared state
  const [isPending, startTransition] = useTransition();
  const [riskMode, setRiskMode] = useState<RiskMode>("balanced");

  // Launch Agent state
  const [step, setStep] = useState<AgentStep>("idle");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [launchErrors, setLaunchErrors] = useState<string[]>([]);
  const [launchResult, setLaunchResult] = useState<{ campaignId?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Optimization Agent state
  const [optAnalysis, setOptAnalysis] = useState<OptimizationAnalysis | null>(null);
  const [optRecommendations, setOptRecommendations] = useState<AgentRecommendation[]>([]);
  const [optSummary, setOptSummary] = useState<string>("");
  const [optError, setOptError] = useState<string>("");

  // Audit Agent state
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string>("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Launch: Submit prompt ───────────────────────────────────────────
  function handleSubmit() {
    if (!prompt.trim() || isPending) return;
    const userMsg: AgentMessage = { role: "user", content: prompt, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setStep("parsing");
    setLaunchErrors([]);

    const thinkMsg: AgentMessage = { role: "agent", content: "Parsing your request and building a campaign plan...", timestamp: new Date().toISOString(), step: "parsing" };
    setMessages((prev) => [...prev, thinkMsg]);

    startTransition(async () => {
      setStep("building_draft");
      const result = await planCampaignAction(userMsg.content, riskMode);

      if (result.ok && result.draft) {
        setDraft(result.draft);
        setCurrentJobId(result.jobId ?? null);
        setStep("ready_for_review");
        const draftMsg: AgentMessage = {
          role: "agent",
          content: "I've built a campaign draft based on your request. Review the details below and approve when ready.",
          timestamp: new Date().toISOString(),
          step: "ready_for_review",
          draft: result.draft,
        };
        setMessages((prev) => [...prev.slice(0, -1), draftMsg]);
      } else {
        setStep("failed");
        const errorMsg: AgentMessage = {
          role: "agent",
          content: `Failed to build campaign: ${result.error ?? "Unknown error"}. Try rephrasing your request.`,
          timestamp: new Date().toISOString(),
          step: "failed",
        };
        setMessages((prev) => [...prev.slice(0, -1), errorMsg]);
      }
    });
  }

  // ── Launch: Approve ─────────────────────────────────────────────────
  function handleApprove() {
    if (!draft || isPending) return;
    setStep("launching");
    const approvedDraft = { ...draft, status: "approved" as const };
    setDraft(approvedDraft);

    startTransition(async () => {
      const result = await launchApprovedDraftAction(approvedDraft);
      if (result.ok) {
        setStep("launched");
        setLaunchResult({ campaignId: result.campaignId });
        setMessages((prev) => [...prev, {
          role: "agent", content: `Campaign launched successfully! Campaign ID: ${result.campaignId}. It was created in PAUSED state — activate it in Meta Ads Manager when ready.`,
          timestamp: new Date().toISOString(), step: "launched",
        }]);
      } else {
        setStep("failed");
        setLaunchErrors(result.errors?.map((e) => e.message) ?? ["Launch failed"]);
        setMessages((prev) => [...prev, {
          role: "agent", content: `Launch failed: ${result.errors?.map((e) => e.message).join(", ")}`,
          timestamp: new Date().toISOString(), step: "failed",
        }]);
      }
    });
  }

  // ── Launch: Reset ───────────────────────────────────────────────────
  function handleReset() {
    setStep("idle");
    setDraft(null);
    setMessages([]);
    setLaunchErrors([]);
    setLaunchResult(null);
    setPrompt("");
  }

  // ── Optimization: Run scan ──────────────────────────────────────────
  function handleOptimizationScan() {
    if (isPending) return;
    setOptError("");
    setOptAnalysis(null);
    setOptRecommendations([]);

    startTransition(async () => {
      // Use first connected ad account
      const result = await runOptimizationScanAction("", riskMode);
      if (result.ok && result.analysis && result.recommendations) {
        setOptAnalysis(result.analysis);
        setOptRecommendations(result.recommendations);
        setOptSummary(result.summary ?? "");
      } else {
        setOptError(result.error ?? "Optimization scan failed");
      }
    });
  }

  // ── Audit: Run audit ────────────────────────────────────────────────
  function handleAuditRun() {
    if (isPending) return;
    setAuditError("");
    setAuditResult(null);

    startTransition(async () => {
      const result = await runAccountAuditAction("");
      if (result.ok && result.result) {
        setAuditResult(result.result);
      } else {
        setAuditError(result.error ?? "Audit failed");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Media Buying Operator</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Campaign Agent</h1>
        <p className="mt-1 text-sm text-slate-400">
          {activeAgent === "launch" && "Describe the campaign you want. The agent will plan, draft, and present it for your approval."}
          {activeAgent === "optimization" && "Scan your active campaigns for optimization opportunities and performance insights."}
          {activeAgent === "audit" && "Run a health check on your ad account to find structural issues and wasted spend."}
        </p>
      </header>

      {/* Agent selector + Risk mode */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <AgentJobSelector active={activeAgent} onChange={setActiveAgent} />
        </div>
        <div className="w-64">
          <RiskModeSelector value={riskMode} onChange={setRiskMode} />
        </div>
      </div>

      {/* ═══ LAUNCH TAB ═══ */}
      {activeAgent === "launch" && (
        <>
          {/* Messages */}
          <div className="mb-6 min-h-[200px] space-y-4">
            {messages.length === 0 && step === "idle" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">Try one of these:</p>
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => setPrompt(p)}
                    className="block w-full rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left text-sm text-slate-400 transition-all hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200">
                    &ldquo;{p}&rdquo;
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === "user"
                    ? "border border-emerald-800 bg-emerald-900/40 text-emerald-100"
                    : "border border-slate-800 bg-slate-900/80 text-slate-300"
                }`}>
                  {msg.role === "agent" && msg.step === "parsing" && (
                    <div className="mb-2 flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-[11px] font-medium text-emerald-400">Planning...</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Draft review */}
          {draft && step === "ready_for_review" && (
            <DraftReview draft={draft} onApprove={handleApprove} isPending={isPending} jobId={currentJobId} />
          )}

          {/* Launch errors */}
          {launchErrors.length > 0 && (
            <div className="mb-6 rounded-xl border border-rose-800 bg-rose-950/40 p-4">
              <p className="mb-2 text-sm font-semibold text-rose-300">Launch Failed</p>
              {launchErrors.map((e, i) => <p key={i} className="text-xs text-rose-400">{e}</p>)}
            </div>
          )}

          {/* Input bar */}
          {step !== "launched" ? (
            <div className="sticky bottom-6">
              <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-sm">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                  placeholder="Describe the campaign you want to create..."
                  disabled={isPending || step === "launching"}
                  className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
                />
                <button onClick={handleSubmit} disabled={!prompt.trim() || isPending || step === "launching"}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40">
                  {isPending && step === "parsing" ? "Planning..." : "Plan"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <button onClick={handleReset}
                className="rounded-lg border border-slate-700 px-6 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
                Start New Campaign
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══ OPTIMIZATION TAB ═══ */}
      {activeAgent === "optimization" && (
        <div className="space-y-6">
          {!optAnalysis && !optError && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800">
                <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">Scan for Optimization Opportunities</p>
                <p className="mt-1 text-xs text-slate-500">Analyzes active campaigns, detects creative fatigue, and recommends budget adjustments.</p>
              </div>
              <button onClick={handleOptimizationScan} disabled={isPending}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40">
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Scanning...
                  </span>
                ) : "Run Optimization Scan"}
              </button>
            </div>
          )}

          {optError && (
            <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4">
              <p className="text-sm font-semibold text-rose-300">Scan Failed</p>
              <p className="mt-1 text-xs text-rose-400">{optError}</p>
              <button onClick={handleOptimizationScan} className="mt-3 text-xs text-rose-300 underline hover:no-underline">
                Try again
              </button>
            </div>
          )}

          {optAnalysis && (
            <>
              <OptimizationPanel analysis={optAnalysis} recommendations={optRecommendations} summary={optSummary} />
              <div className="text-center">
                <button onClick={() => { setOptAnalysis(null); setOptRecommendations([]); setOptSummary(""); }}
                  className="rounded-lg border border-slate-700 px-6 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-white">
                  Run New Scan
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ AUDIT TAB ═══ */}
      {activeAgent === "audit" && (
        <div className="space-y-6">
          {!auditResult && !auditError && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800">
                <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">Run Account Health Audit</p>
                <p className="mt-1 text-xs text-slate-500">Checks naming conventions, goal coverage, spend efficiency, and configuration completeness.</p>
              </div>
              <button onClick={handleAuditRun} disabled={isPending}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40">
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Auditing...
                  </span>
                ) : "Run Audit"}
              </button>
            </div>
          )}

          {auditError && (
            <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4">
              <p className="text-sm font-semibold text-rose-300">Audit Failed</p>
              <p className="mt-1 text-xs text-rose-400">{auditError}</p>
              <button onClick={handleAuditRun} className="mt-3 text-xs text-rose-300 underline hover:no-underline">
                Try again
              </button>
            </div>
          )}

          {auditResult && (
            <>
              <AuditHealthScore result={auditResult} />
              <div className="text-center">
                <button onClick={() => { setAuditResult(null); setAuditError(""); }}
                  className="rounded-lg border border-slate-700 px-6 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-white">
                  Run New Audit
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Draft Review Component (enhanced with preflight)
// ═══════════════════════════════════════════════════════════════════════════════

function DraftReview({
  draft,
  onApprove,
  isPending,
  jobId,
}: {
  draft: CampaignDraft;
  onApprove: () => void;
  isPending: boolean;
  jobId?: string | null;
}) {
  const objectiveLabels: Record<string, string> = {
    OUTCOME_SALES: "Sales",
    OUTCOME_LEADS: "Leads",
    OUTCOME_TRAFFIC: "Traffic",
    OUTCOME_ENGAGEMENT: "Engagement",
    OUTCOME_AWARENESS: "Awareness",
  };

  const hasBlockingPreflight = draft.preflightResults?.some((c) => c.status === "fail" && c.blocking);

  return (
    <div className="mb-6 space-y-4">
      {/* Risk mode + account context badge */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400">
          {draft.riskMode} mode
        </span>
        {draft.accountSnapshot && (
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-500">
            Account: ${draft.accountSnapshot.avgDailySpend.toFixed(0)}/day avg, {draft.accountSnapshot.crmRoas.toFixed(1)}x ROAS
          </span>
        )}
      </div>

      {/* Preflight panel */}
      {draft.preflightResults && draft.preflightResults.length > 0 && (
        <PreflightPanel checks={draft.preflightResults} />
      )}

      {/* Agent reasoning */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-900/50">
            <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Agent Reasoning</h3>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-slate-400">
          <p><span className="font-medium text-slate-300">Creatives:</span> {draft.reasoning.creativeLogic}</p>
          <p><span className="font-medium text-slate-300">Audience:</span> {draft.reasoning.audienceLogic}</p>
          <p className="whitespace-pre-wrap"><span className="font-medium text-slate-300">Budget:</span> {draft.reasoning.budgetLogic}</p>
        </div>

        {draft.reasoning.assumptions.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500">Assumptions Made</p>
            <ul className="space-y-0.5">
              {draft.reasoning.assumptions.map((a, i) => (
                <li key={i} className="text-[11px] text-amber-400/80">- {a}</li>
              ))}
            </ul>
          </div>
        )}

        {draft.reasoning.warnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-rose-800/40 bg-rose-950/20 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-500">Warnings</p>
            <ul className="space-y-0.5">
              {draft.reasoning.warnings.map((w, i) => (
                <li key={i} className="text-[11px] text-rose-400/80">- {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Campaign details grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Campaign Draft</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewField label="Campaign Name" value={draft.campaignName} />
          <ReviewField label="Objective" value={objectiveLabels[draft.objective] ?? draft.objective} />
          <ReviewField label="Daily Budget" value={`$${draft.dailyBudget}/day`} highlight />
          <ReviewField label="Launch Mode" value={draft.launchMode === "paused" ? "Paused (safe)" : "Active"} />
          <ReviewField label="Ad Account" value={draft.adAccount?.name ?? "Not connected"} warn={!draft.adAccount} />
          <ReviewField label="Page" value={draft.page?.name ?? "Not selected"} warn={!draft.page} />
        </div>
      </div>

      {/* Audience */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Audience & Targeting</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewField label="Ad Set Name" value={draft.adSetName} />
          <ReviewField label="Optimization" value={draft.optimizationGoal.replace(/_/g, " ")} />
          <ReviewField label="Locations" value={draft.targeting.targeting.locations.join(", ")} />
          <ReviewField label="Age Range" value={`${draft.targeting.targeting.ageMin}–${draft.targeting.targeting.ageMax}`} />
          <ReviewField label="Gender" value={draft.targeting.targeting.gender} />
          <ReviewField label="Advantage+" value={draft.targeting.targeting.advantagePlus ? "Enabled" : "Disabled"} />
        </div>
        {draft.targeting.exclusions.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Exclusions</p>
            {draft.targeting.exclusions.map((e, i) => (
              <p key={i} className="text-[11px] text-slate-400">- {e}</p>
            ))}
          </div>
        )}
      </div>

      {/* Creatives */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">
          Selected Creatives <span className="ml-1 text-xs text-slate-500">({draft.ads.length})</span>
        </h3>
        {draft.ads.length === 0 ? (
          <p className="text-sm text-slate-500">No creatives selected. Add media before launching.</p>
        ) : (
          <div className="space-y-3">
            {draft.ads.map((ad, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-[10px] font-bold text-slate-500">
                  #{i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{ad.creative.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {ad.creative.source === "meta_synced" ? "From Meta" : "Internal Asset"}
                    {ad.creative.performanceData && (
                      <> &middot; {ad.creative.performanceData.reasonSelected}</>
                    )}
                  </p>
                </div>
                {ad.creative.performanceData && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-emerald-400">{ad.creative.performanceData.ctr}% CTR</p>
                    <p className="text-[10px] text-slate-500">${ad.creative.performanceData.spend.toFixed(0)} spent</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-700 bg-amber-950/40">
            <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Ready to launch?</p>
            <p className="text-[11px] text-slate-500">
              {hasBlockingPreflight
                ? "Resolve blocking preflight issues before launching."
                : "Review the details above, then approve to create on Meta."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/launch?${jobId ? `draftId=${jobId}` : draft.adAccount ? `adAccountId=${draft.adAccount.externalId}` : ""}`}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-white">
            Edit in Launcher
          </Link>
          <button onClick={onApprove} disabled={isPending || hasBlockingPreflight}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Launching...
              </span>
            ) : "Approve & Launch"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function ReviewField({ label, value, highlight, warn }: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${
        warn ? "text-amber-400" : highlight ? "text-emerald-400" : "text-white"
      }`}>{value}</p>
    </div>
  );
}
