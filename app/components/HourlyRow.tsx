type HourlyRowProps = {
  hour: string;
  spend: string;
  conversions: number;
  roas: string;
};

export function HourlyRow({ hour, spend, conversions, roas }: HourlyRowProps) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-slate-800 py-3 text-sm last:border-none sm:grid-cols-4 sm:gap-4">
      <span className="text-slate-300">{hour}</span>
      <span className="text-slate-300">{spend}</span>
      <span className="text-slate-300">{conversions}</span>
      <span className="text-slate-300">{roas}</span>
    </div>
  );
}
