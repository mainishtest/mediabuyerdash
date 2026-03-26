export function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string };
}) {
  const trendColor =
    trend?.direction === "up"   ? "text-emerald-400" :
    trend?.direction === "down" ? "text-rose-400"    : "text-slate-500";
  const trendArrow =
    trend?.direction === "up" ? "↑" : trend?.direction === "down" ? "↓" : "→";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-5">
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-500 truncate">
        {label}
      </p>
      <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {sub && <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500 truncate">{sub}</p>}
      {trend && (
        <p className={`mt-2 text-xs font-medium ${trendColor}`}>
          {trendArrow} {trend.label}
        </p>
      )}
    </div>
  );
}
