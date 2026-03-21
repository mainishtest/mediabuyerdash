"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "../ui/Badge";
import type {
  ScaleRecommendation,
  ScaleGuardrail,
  GuardrailStatus,
  ScaleStrategy,
} from "../../types/scale";
import { SCALE_GUARDRAILS } from "../../types/scale";

// ── Props ───────────────────────────────────────────────────────────────────

type ScaleModalProps = {
  isOpen:              boolean;
  onClose:             () => void;
  clientAccountId:     string;
  clientName:          string;
  campaignId:          string;
  externalCampaignId:  string;
  campaignName:        string;
};

// ── State ───────────────────────────────────────────────────────────────────

type ModalPhase = "loading" | "configure" | "submitting" | "submitted" | "error";

// ── Format helpers ──────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function guardrailStatusBadge(status: GuardrailStatus): { variant: "success" | "warning" | "danger" | "neutral"; label: string } {
  switch (status) {
    case "pass": return { variant: "success", label: "Pass" };
    case "warn": return { variant: "warning", label: "Warn" };
    case "fail": return { variant: "danger",  label: "Fail" };
    default:     return { variant: "neutral",  label: "Skip" };
  }
}

function confidenceColor(c: string): string {
  if (c === "high")   return "text-emerald-400";
  if (c === "medium") return "text-amber-400";
  return "text-rose-400";
}

function readinessColor(r: string): string {
  if (r === "ready")       return "text-emerald-400";
  if (r === "needs_review") return "text-amber-400";
  return "text-rose-400";
}

// ── Component ───────────────────────────────────────────────────────────────

export function ScaleModal({
  isOpen,
  onClose,
  clientAccountId,
  clientName,
  campaignId,
  externalCampaignId,
  campaignName,
}: ScaleModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("loading");
  const [recommendation, setRecommendation] = useState<ScaleRecommendation | null>(null);
  const [increasePct, setIncreasePct] = useState(0);
  const [strategy, setStrategy] = useState<ScaleStrategy>("increase_budget");
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // ── Load recommendation on open ──────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    setPhase("loading");
    setError(null);
    setActionId(null);

    fetch(`/api/scale/recommend?clientAccountId=${clientAccountId}&externalCampaignId=${externalCampaignId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load recommendation: ${res.status}`);
        const data = await res.json();
        setRecommendation(data);
        setIncreasePct(data.suggestedIncreasePct);
        setStrategy(data.strategy);
        setPhase("configure");
      })
      .catch((err) => {
        setError(err.message);
        setPhase("error");
      });
  }, [isOpen, clientAccountId, externalCampaignId]);

  // ── Submit handler ───────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!recommendation) return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/scale/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientAccountId,
          clientName,
          campaignId,
          externalCampaignId,
          campaignName,
          increasePct,
          strategy,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Submit failed: ${res.status}`);
      }
      const data = await res.json();
      setActionId(data.actionId);
      setPhase("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [recommendation, clientAccountId, clientName, campaignId, externalCampaignId, campaignName, increasePct, strategy]);

  // ── Don't render if closed ───────────────────────────────────────────

  if (!isOpen) return null;

  const projectedSpend = recommendation
    ? recommendation.currentDailySpend * (1 + increasePct / 100)
    : 0;

  const canSubmit =
    phase === "configure" &&
    recommendation &&
    recommendation.readiness !== "blocked" &&
    recommendation.readiness !== "insufficient_data" &&
    increasePct > 0 &&
    increasePct <= SCALE_GUARDRAILS.MAX_INCREASE_PCT &&
    recommendation.guardrails.every((g) => g.status !== "fail");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[5vh] z-50 mx-auto max-w-xl sm:inset-x-auto sm:w-full">
        <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-white">Scale Campaign</h2>
              <p className="mt-0.5 truncate text-xs text-slate-400">{campaignName}</p>
              <p className="text-xs text-slate-600">{clientName}</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Loading */}
            {phase === "loading" && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <span className="ml-3 text-sm text-slate-400">Analyzing performance...</span>
              </div>
            )}

            {/* Error */}
            {phase === "error" && (
              <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 px-4 py-3">
                <p className="text-sm text-rose-300">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            )}

            {/* Submitted */}
            {phase === "submitted" && (
              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-6 text-center">
                <p className="text-lg font-semibold text-emerald-300">Scale plan submitted</p>
                <p className="mt-2 text-sm text-emerald-400/80">
                  +{increasePct}% budget increase sent to the approval queue.
                </p>
                <p className="mt-1 text-xs text-slate-500">Action ID: {actionId}</p>
                <button
                  onClick={onClose}
                  className="mt-5 rounded-lg border border-emerald-700 bg-emerald-700/20 px-6 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-700/40"
                >
                  Done
                </button>
              </div>
            )}

            {/* Configure */}
            {(phase === "configure" || phase === "submitting") && recommendation && (
              <>
                {/* Readiness + Confidence badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs font-semibold ${readinessColor(recommendation.readiness)}`}>
                    {recommendation.readiness.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className={`text-xs font-medium ${confidenceColor(recommendation.confidence)}`}>
                    {recommendation.confidence} confidence
                  </span>
                </div>

                {/* Reasoning */}
                <p className="text-sm leading-relaxed text-slate-300">{recommendation.reasoning}</p>

                {/* Blockers */}
                {recommendation.blockers.length > 0 && (
                  <div className="rounded-lg border border-rose-800/40 bg-rose-950/20 px-4 py-3">
                    <p className="text-xs font-semibold text-rose-400">Blocked</p>
                    {recommendation.blockers.map((b, i) => (
                      <p key={i} className="mt-1 text-xs text-rose-300">{b}</p>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {recommendation.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-400">Warnings</p>
                    {recommendation.warnings.map((w, i) => (
                      <p key={i} className="mt-1 text-xs text-amber-300">{w}</p>
                    ))}
                  </div>
                )}

                {/* Current → Projected spend */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Current Daily</p>
                    <p className="mt-1 text-lg font-semibold text-white">{fmtCurrency(recommendation.currentDailySpend)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Projected Daily</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-300">{fmtCurrency(projectedSpend)}</p>
                    <p className="text-xs text-emerald-500">+{increasePct}%</p>
                  </div>
                </div>

                {/* Strategy selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-400">Strategy</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStrategy("increase_budget")}
                      className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                        strategy === "increase_budget"
                          ? "border-emerald-600 bg-emerald-950/30 text-emerald-300"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <p className="font-medium">Increase Budget</p>
                      <p className="mt-0.5 text-xs opacity-70">Raise daily budget by %</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrategy("duplicate_adset")}
                      className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                        strategy === "duplicate_adset"
                          ? "border-emerald-600 bg-emerald-950/30 text-emerald-300"
                          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      <p className="font-medium">Duplicate Winners</p>
                      <p className="mt-0.5 text-xs opacity-70">Clone winning ad sets</p>
                    </button>
                  </div>
                </div>

                {/* Increase % slider */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400">Budget Increase</label>
                    <span className="text-sm font-semibold text-emerald-400">+{increasePct}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={SCALE_GUARDRAILS.MAX_INCREASE_PCT}
                    step={5}
                    value={increasePct}
                    onChange={(e) => setIncreasePct(Number(e.target.value))}
                    className="mt-2 w-full accent-emerald-600"
                  />
                  <div className="mt-1 flex justify-between text-xs text-slate-600">
                    <span>5%</span>
                    <span>{SCALE_GUARDRAILS.MAX_INCREASE_PCT}%</span>
                  </div>
                </div>

                {/* Guardrails */}
                <div>
                  <p className="text-xs font-semibold text-slate-400">Guardrails</p>
                  <div className="mt-2 space-y-2">
                    {recommendation.guardrails.map((g) => {
                      const badge = guardrailStatusBadge(g.status);
                      return (
                        <div
                          key={g.name}
                          className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-800/20 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-300">{g.name}</p>
                            <p className="text-xs text-slate-500">{g.actual} — {g.threshold}</p>
                          </div>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {(phase === "configure" || phase === "submitting") && recommendation && (
            <div className="sticky bottom-0 border-t border-slate-800 bg-slate-900 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || phase === "submitting"}
                  className={`rounded-lg px-6 py-2.5 text-sm font-medium transition-colors ${
                    canSubmit && phase !== "submitting"
                      ? "border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
                      : "border border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {phase === "submitting" ? "Submitting..." : "Submit to Approval Queue"}
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-slate-600">
                Routes through governance approval before execution.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
