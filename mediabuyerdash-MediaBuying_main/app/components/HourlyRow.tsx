type HourlyRowProps = {
  hour: string;
  spend: string;
  conversions: number;
  roas: string;
};

export function HourlyRow({ hour, spend, conversions, roas }: HourlyRowProps) {
  return (
    <div className="grid grid-cols-4 gap-4 border-b border-slate-800 py-3 text-sm last:border-none">
      <span className="text-slate-300">{hour}</span>
      <span className="text-slate-300">{spend}</span>
      <span className="text-slate-300">{conversions}</span>
      <span className="text-slate-300">{roas}</span>
    </div>
  );
}
