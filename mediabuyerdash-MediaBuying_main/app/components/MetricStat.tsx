type MetricStatProps = {
  label: string;
  value: string;
};

export function MetricStat({ label, value }: MetricStatProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-900/40">
      <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
    </div>
  );
}
