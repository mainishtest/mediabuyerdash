type DashboardCardProps = {
  title: string;
  description: string;
};

export function DashboardCard({ title, description }: DashboardCardProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-slate-900/40">
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </section>
  );
}
