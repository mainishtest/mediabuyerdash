"use client";

// StatusCards — Quick-glance operator status cards for the AI command surface.
// Shows key counts that drive the most common operator questions.

import Link from "next/link";

type StatusData = {
  totalSpend:      number;
  roas:            number | null;
  openAlerts:      number;
  pendingApprovals: number;
  scaleReady:      number;
  winnersCount:    number;
  losersCount:     number;
  activeExperiments: number;
  blockedActions:  number;
};

function Card({
  label, value, accent, href,
}: {
  label: string; value: string | number; accent?: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5
                 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${accent ?? "text-slate-100"}`}>{value}</p>
    </Link>
  );
}

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function StatusCards({ data }: { data: StatusData }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
      <Card label="Spend" value={fmtCurrency(data.totalSpend)} href="/home" />
      <Card label="ROAS" value={data.roas != null ? `${data.roas.toFixed(2)}×` : "N/A"} href="/reconciliation"
            accent={data.roas != null && data.roas >= 2 ? "text-emerald-400" : data.roas != null && data.roas < 1 ? "text-rose-400" : undefined} />
      <Card label="Alerts" value={data.openAlerts} href="/alerts"
            accent={data.openAlerts > 0 ? "text-rose-400" : "text-slate-400"} />
      <Card label="Approvals" value={data.pendingApprovals} href="/automation"
            accent={data.pendingApprovals > 0 ? "text-amber-400" : "text-slate-400"} />
      <Card label="Scale Ready" value={data.scaleReady} href="/creative-lab/outcomes"
            accent={data.scaleReady > 0 ? "text-emerald-400" : "text-slate-400"} />
      <Card label="Winners" value={data.winnersCount} href="/creative-lab/outcomes"
            accent={data.winnersCount > 0 ? "text-emerald-400" : "text-slate-400"} />
      <Card label="Losers" value={data.losersCount} href="/creative-lab/outcomes"
            accent={data.losersCount > 0 ? "text-amber-400" : "text-slate-400"} />
      <Card label="Experiments" value={data.activeExperiments} href="/creative-lab/results" />
      <Card label="Blocked" value={data.blockedActions} href="/history"
            accent={data.blockedActions > 0 ? "text-rose-400" : "text-slate-400"} />
    </div>
  );
}
