import type { ExecutiveNarrativeSection } from "../../../../lib/executiveReporting/types";

type QaRow = {
  question: string;
  answer:   string;
  accent?:  "success" | "warning" | "danger" | "neutral";
};

function QaItem({ row }: { row: QaRow }) {
  const answerClass =
    row.accent === "success" ? "text-emerald-300" :
    row.accent === "warning" ? "text-amber-300"   :
    row.accent === "danger"  ? "text-rose-300"    :
    "text-slate-200";

  return (
    <div className="border-b border-slate-800/60 py-3 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {row.question}
      </p>
      <p className={`mt-1 text-sm leading-relaxed ${answerClass}`}>{row.answer}</p>
    </div>
  );
}

export function NarrativeSection({ narrative }: { narrative: ExecutiveNarrativeSection }) {
  // Detect tone from content for accent colouring
  const workedAccent: QaRow["accent"] =
    narrative.whatWorked.startsWith("No standout") ? "neutral" : "success";
  const underAccent: QaRow["accent"] =
    narrative.whatUnderperformed.startsWith("No significant") ? "neutral" : "warning";

  const rows: QaRow[] = [
    { question: "What happened this period?",  answer: narrative.whatHappened  },
    { question: "What changed?",               answer: narrative.whatChanged   },
    { question: "What worked?",                answer: narrative.whatWorked,      accent: workedAccent },
    { question: "What underperformed?",        answer: narrative.whatUnderperformed, accent: underAccent },
    { question: "What actions were taken?",    answer: narrative.actionsTaken  },
    { question: "What is next?",               answer: narrative.whatsNext     },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      {/* Headline */}
      <div className="border-b border-slate-800/60 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Executive Summary
        </p>
        <p className="mt-1 text-base font-semibold text-white">{narrative.headline}</p>
      </div>

      {/* Q&A rows */}
      <div className="px-5 pb-2">
        {rows.map((row) => (
          <QaItem key={row.question} row={row} />
        ))}
      </div>
    </div>
  );
}
