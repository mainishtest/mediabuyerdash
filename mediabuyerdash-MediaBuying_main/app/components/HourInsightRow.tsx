import type { HourClassification } from "../../lib/daypartingUtils";

type HourInsightRowProps = {
  formattedHour: string;
  formattedCpa: string;
  formattedRoas: string;
  classification: HourClassification;
};

const classificationStyles: Record<
  HourClassification,
  { label: string; badge: string }
> = {
  best: {
    label: "Best Hour",
    badge: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
  },
  weak: {
    label: "Weak Hour",
    badge: "bg-rose-900/60 text-rose-300 border border-rose-700/50"
  },
  neutral: {
    label: "Neutral",
    badge: "bg-slate-800 text-slate-400 border border-slate-700"
  }
};

export function HourInsightRow({
  formattedHour,
  formattedCpa,
  formattedRoas,
  classification
}: HourInsightRowProps) {
  const { label, badge } = classificationStyles[classification];

  return (
    <div className="grid grid-cols-4 gap-4 border-b border-slate-800 py-3 text-sm last:border-none">
      <span className="text-slate-200">{formattedHour}</span>
      <span className="text-slate-300">{formattedCpa}</span>
      <span className="text-slate-300">{formattedRoas}</span>
      <span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>
          {label}
        </span>
      </span>
    </div>
  );
}
