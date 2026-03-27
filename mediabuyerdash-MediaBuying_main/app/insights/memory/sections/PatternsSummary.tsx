import type { LearningPattern } from "../../../../lib/learningMemory/types";
import { CATEGORY_LABEL, CONFIDENCE_BADGE, SOURCE_LABEL } from "../../../../lib/learningMemory/patterns";

function PatternCard({ pattern }: { pattern: LearningPattern }) {
  const confBadge = CONFIDENCE_BADGE[pattern.confidence];
  const catLabel  = CATEGORY_LABEL[pattern.category] ?? pattern.category;
  const clients   = pattern.clientNames.slice(0, 3);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${confBadge}`}>
              {pattern.confidence.charAt(0).toUpperCase() + pattern.confidence.slice(1)}
            </span>
            <span className="text-xs text-slate-500">{catLabel}</span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-slate-400">{pattern.patternLabel}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{pattern.exampleInsight}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">
              {pattern.occurrences} observation{pattern.occurrences !== 1 ? "s" : ""}
            </span>
            {clients.map((c) => (
              <span key={c} className="text-xs text-slate-600">· {c}</span>
            ))}
            {pattern.clientNames.length > 3 && (
              <span className="text-xs text-slate-600">+{pattern.clientNames.length - 3} more</span>
            )}
          </div>
          {/* Source types */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pattern.sourceTypes.map((s) => (
              <span key={s} className="text-xs text-slate-600">
                {SOURCE_LABEL[s] ?? s}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-center">
          <p className="text-lg font-semibold text-white">{pattern.occurrences}</p>
          <p className="text-xs text-slate-500">times</p>
        </div>
      </div>
    </div>
  );
}

export function PatternsSummary({ patterns }: { patterns: LearningPattern[] }) {
  if (patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-2xl">◈</p>
        <p className="mt-2 text-sm font-medium text-slate-300">No patterns yet</p>
        <p className="mt-1 text-xs text-slate-500">
          Patterns emerge as more learnings are captured across experiments and campaigns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {patterns.map((p) => (
        <PatternCard key={`${p.category}:${p.patternLabel}`} pattern={p} />
      ))}
    </div>
  );
}
