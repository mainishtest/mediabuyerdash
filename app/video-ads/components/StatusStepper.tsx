"use client";

import { STATUS_PIPELINE, STATUS_LABELS, type ConceptStatus } from "../../../lib/videoAdGenerator/types";

const STEP_COLORS: Record<string, { dot: string; line: string }> = {
  done:    { dot: "bg-emerald-500",   line: "bg-emerald-600/40" },
  active:  { dot: "bg-emerald-400 ring-2 ring-emerald-400/30", line: "bg-slate-700" },
  pending: { dot: "bg-slate-700",     line: "bg-slate-800" },
};

interface StatusStepperProps {
  currentStatus: string;
  onAdvance?: () => void;
  isPending?: boolean;
}

export function StatusStepper({ currentStatus, onAdvance, isPending }: StatusStepperProps) {
  const currentIndex = STATUS_PIPELINE.indexOf(currentStatus as ConceptStatus);
  const isArchived = currentStatus === "archived";

  return (
    <div className="space-y-1">
      {STATUS_PIPELINE.map((status, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        const state = isDone ? "done" : isActive ? "active" : "pending";
        const colors = STEP_COLORS[state];
        const isLast = i === STATUS_PIPELINE.length - 1;

        return (
          <div key={status} className="flex items-start gap-2.5">
            {/* Dot + line */}
            <div className="flex flex-col items-center">
              <div className={`h-2 w-2 rounded-full ${colors.dot} shrink-0 mt-1`} />
              {!isLast && <div className={`w-px h-4 ${colors.line}`} />}
            </div>
            {/* Label */}
            <span className={`text-[11px] leading-tight ${
              isActive ? "font-semibold text-emerald-300" : isDone ? "text-slate-400" : "text-slate-600"
            }`}>
              {STATUS_LABELS[status]}
            </span>
          </div>
        );
      })}

      {isArchived && (
        <div className="flex items-start gap-2.5">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-slate-600 shrink-0 mt-1" />
          </div>
          <span className="text-[11px] font-semibold text-slate-500">Archived</span>
        </div>
      )}

      {onAdvance && currentIndex >= 0 && currentIndex < STATUS_PIPELINE.length - 1 && (
        <button
          onClick={onAdvance}
          disabled={isPending}
          className="mt-2 w-full rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-900/30 disabled:opacity-50"
        >
          {isPending ? "Advancing…" : `Advance to ${STATUS_LABELS[STATUS_PIPELINE[currentIndex + 1]]}`}
        </button>
      )}
    </div>
  );
}
