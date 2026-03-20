// app/clients/[clientId]/setup/SetupStepCard.tsx
// Presentational card for a single setup step.
// No "use client" — all interactivity is passed in via callbacks from the parent.

import Link from "next/link";
import type { ClientSetupStep } from "../../../../types/clientSetup";

// ── Style maps ────────────────────────────────────────────────────────────────

const INDICATOR_STYLE: Record<string, string> = {
  complete: "bg-emerald-600 text-white",
  current:  "bg-sky-600 text-white ring-2 ring-sky-400/30",
  pending:  "bg-slate-800 text-slate-500",
};

const CARD_STYLE: Record<string, string> = {
  complete: "border-emerald-900/40 bg-slate-900/40",
  current:  "border-sky-800/60 bg-slate-900/60 ring-1 ring-sky-900/40",
  pending:  "border-slate-800/60 bg-slate-900/20",
};

const STATUS_BADGE: Record<string, string> = {
  complete: "bg-emerald-900/50 text-emerald-300",
  current:  "bg-sky-900/50 text-sky-300",
  pending:  "",
};

const CTA_STYLE: Record<string, string> = {
  complete: "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white",
  current:  "bg-sky-600 text-white hover:bg-sky-500",
  pending:  "",
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  step:       ClientSetupStep;
  stepNumber: number;
  /** Pass only for the "run_first_sync" step — triggers sync inline. */
  onRunSync?: () => void;
  syncing?:   boolean;
};

export function SetupStepCard({ step, stepNumber, onRunSync, syncing }: Props) {
  const { status } = step;
  const isPending  = status === "pending";
  const isSync     = step.id === "run_first_sync";

  return (
    <div
      className={`rounded-xl border p-4 transition-all sm:p-5 ${CARD_STYLE[status]} ${
        isPending ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">

        {/* Step indicator circle */}
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${INDICATOR_STYLE[status]}`}
        >
          {status === "complete" ? "✓" : stepNumber}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">

          {/* Title + status badge */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3
              className={`text-sm font-semibold ${
                isPending ? "text-slate-500" : "text-slate-100"
              }`}
            >
              {step.label}
            </h3>
            {status !== "pending" && STATUS_BADGE[status] && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[status]}`}
              >
                {status === "complete" ? "Complete" : "Current"}
              </span>
            )}
          </div>

          {/* Description — show for complete and current only */}
          {status !== "pending" && (
            <p className="mb-3 text-xs leading-relaxed text-slate-400">
              {step.description}
            </p>
          )}

          {/* Completion detail */}
          {step.completionDetail && (
            <p className="mb-2 text-xs font-medium text-emerald-400">
              {step.completionDetail}
            </p>
          )}

          {/* CTA — hidden for pending */}
          {!isPending && (
            <>
              {isSync && onRunSync ? (
                <button
                  onClick={onRunSync}
                  disabled={syncing}
                  className="inline-flex min-w-[120px] items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncing ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      Syncing…
                    </>
                  ) : (
                    step.ctaLabel
                  )}
                </button>
              ) : (
                <Link
                  href={step.ctaHref}
                  className={`inline-flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${CTA_STYLE[status]}`}
                >
                  {step.ctaLabel}
                  {status === "current" && " →"}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
