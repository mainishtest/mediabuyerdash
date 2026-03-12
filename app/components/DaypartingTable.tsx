import type { WeekdayHourGroup } from "../../lib/daypartingUtils";
import type { HourClassification } from "../../lib/daypartingUtils";

type DaypartingTableProps = {
  groups: WeekdayHourGroup[];
};

const badgeStyles: Record<
  HourClassification,
  { label: string; className: string }
> = {
  best: {
    label: "Best Hour",
    className: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
  },
  weak: {
    label: "Weak Hour",
    className: "bg-rose-900/60 text-rose-300 border border-rose-700/50"
  },
  neutral: {
    label: "Neutral",
    className: "bg-slate-800 text-slate-400 border border-slate-700"
  }
};

export function DaypartingTable({ groups }: DaypartingTableProps) {
  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-slate-50">
        Hourly Dayparting View
      </h2>
      <p className="mb-5 text-sm text-slate-400">
        All hours across sampled weekdays, sorted by day and time. Status is
        derived by comparing each row against the CPA and ROAS averages for the
        selected range.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              {["Weekday", "Hour", "Spend", "Conversions", "CPA", "ROAS", "Status"].map(
                (heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400"
                  >
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-slate-400">
                  No hourly data available for the selected range.
                </td>
              </tr>
            ) : (
              groups.map((g, index) => {
                const { label, className } = badgeStyles[g.classification];
                const isLast = index === groups.length - 1;
                return (
                  <tr
                    key={`${g.weekday}-${g.hour}`}
                    className={!isLast ? "border-b border-slate-800" : ""}
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">{g.weekday}</td>
                    <td className="px-4 py-3 text-slate-300">{g.formattedHour}</td>
                    <td className="px-4 py-3 text-slate-300">{g.formattedSpend}</td>
                    <td className="px-4 py-3 text-slate-300">{g.conversions}</td>
                    <td className="px-4 py-3 text-slate-300">{g.formattedCpa}</td>
                    <td className="px-4 py-3 text-slate-300">{g.formattedRoas}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
