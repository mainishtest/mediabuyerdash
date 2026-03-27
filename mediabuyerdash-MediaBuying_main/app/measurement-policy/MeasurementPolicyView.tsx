"use client";

import type {
  MeasurementPolicy,
  EvaluationMetricSet,
  MetricOwnershipMap,
} from "../../types/measurementPolicy";

type Props = {
  policy:           MeasurementPolicy;
  ownership:        MetricOwnershipMap;
  evaluatedMetrics: EvaluationMetricSet;
};

const SOURCE_STYLES: Record<string, string> = {
  crm:     "bg-emerald-900/60 text-emerald-300",
  meta:    "bg-blue-900/60 text-blue-300",
  blended: "bg-amber-900/60 text-amber-300",
};

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${SOURCE_STYLES[source] ?? "bg-slate-700 text-slate-400"}`}>
      {source}
    </span>
  );
}

export function MeasurementPolicyView({ policy, ownership, evaluatedMetrics }: Props) {
  const fmt = (n: number, prefix = "$") =>
    `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">

      {/* Core principle banner */}
      <section className="rounded-xl border border-sky-800/40 bg-sky-950/20 p-5">
        <p className="text-sm font-medium text-sky-200">
          <strong>Core principle:</strong> Meta is used for delivery analysis only.
          CRM is the source of truth for all business performance decisions.
        </p>
      </section>

      {/* Policy overview */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Policy Overview</h2>
          <span className="text-xs text-slate-600">v{policy.version}</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <PolicyCard
            label="Attribution window"
            value={`${policy.attribution.attributionWindowDays} days`}
            detail={policy.attribution.attributionModel}
          />
          <PolicyCard
            label="Dayparting timezone"
            value="Ad account timezone"
            detail={`Source: ${policy.timezone.daypartingTimezoneSource}`}
          />
          <PolicyCard
            label="Reporting timezone"
            value="Ad account timezone"
            detail={`Source: ${policy.timezone.reportingTimezoneSource}`}
          />
        </div>
      </section>

      {/* Source of truth */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Source of Truth by Metric
        </h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-widest text-slate-500">Metric</th>
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-widest text-slate-500">Source</th>
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-widest text-slate-500">Rule</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {[
              { metric: "Revenue",     source: policy.sourceOfTruth.revenue,     rule: "CRM-verified orders only. Meta-reported revenue is for comparison." },
              { metric: "Conversions", source: policy.sourceOfTruth.conversions, rule: "CRM-matched conversion events within the attribution window." },
              { metric: "CPA",         source: policy.sourceOfTruth.cpa,         rule: "Spend ÷ CRM conversions. Never computed from Meta conversions." },
              { metric: "ROAS",        source: policy.sourceOfTruth.roas,        rule: "CRM revenue ÷ spend. Never computed from Meta-reported revenue." },
              { metric: "Spend",       source: "meta",                           rule: "Meta ad account spend is accepted as accurate for delivery." },
              { metric: "Impressions / Clicks / Frequency", source: "meta",      rule: "Delivery data from Meta. Used for reach and efficiency analysis." },
            ].map(({ metric, source, rule }) => (
              <tr key={metric}>
                <td className="py-2.5 pr-4 font-medium text-white">{metric}</td>
                <td className="py-2.5 pr-4"><SourceBadge source={source} /></td>
                <td className="py-2.5 text-xs text-slate-400">{rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Metric ownership map */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Metric Ownership
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <OwnershipGroup
            label="Meta — Delivery"
            color="blue"
            metrics={ownership.delivery}
          />
          <OwnershipGroup
            label="CRM — Business Outcomes"
            color="emerald"
            metrics={ownership.outcomes}
          />
          <OwnershipGroup
            label="Computed from CRM"
            color="violet"
            metrics={ownership.computed}
          />
        </div>
      </section>

      {/* Sample comparison */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Sample Comparison
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Illustrates the attribution gap between Meta-reported and CRM-verified figures.
          The system always uses CRM figures for optimization decisions.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="pb-2 text-left text-xs font-medium uppercase tracking-widest text-slate-500">Metric</th>
                <th className="pb-2 text-left text-xs font-medium uppercase tracking-widest text-blue-500">Meta-reported</th>
                <th className="pb-2 text-left text-xs font-medium uppercase tracking-widest text-emerald-500">CRM-verified</th>
                <th className="pb-2 text-left text-xs font-medium uppercase tracking-widest text-violet-400">System uses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <CompRow label="Spend"       meta={fmt(evaluatedMetrics.spend)} crm={fmt(evaluatedMetrics.spend)} system={fmt(evaluatedMetrics.spend)} systemSource="meta" />
              <CompRow label="Impressions" meta={evaluatedMetrics.impressions.toLocaleString()} crm="—" system={evaluatedMetrics.impressions.toLocaleString()} systemSource="meta" />
              <CompRow label="Clicks"      meta={evaluatedMetrics.clicks.toLocaleString()} crm="—" system={evaluatedMetrics.clicks.toLocaleString()} systemSource="meta" />
              <CompRow label="CTR"         meta={`${evaluatedMetrics.ctr}%`} crm="—" system={`${evaluatedMetrics.ctr}%`} systemSource="meta" />
              <CompRow label="Revenue"     meta={fmt(evaluatedMetrics.metaRevenue ?? 0)} crm={fmt(evaluatedMetrics.crmRevenue)} system={fmt(evaluatedMetrics.crmRevenue)} systemSource="crm" />
              <CompRow label="Conversions" meta={String(evaluatedMetrics.metaConversions ?? 0)} crm={String(evaluatedMetrics.crmConversions)} system={String(evaluatedMetrics.crmConversions)} systemSource="crm" />
              <CompRow label="CPA"         meta={fmt(evaluatedMetrics.metaCpa ?? 0)} crm={fmt(evaluatedMetrics.cpa)} system={fmt(evaluatedMetrics.cpa)} systemSource="crm" />
              <CompRow label="ROAS"        meta={`${evaluatedMetrics.metaRoas ?? 0}x`} crm={`${evaluatedMetrics.roas}x`} system={`${evaluatedMetrics.roas}x`} systemSource="crm" />
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-amber-400">
          ⚠ In this example, Meta over-attributes by{" "}
          {Math.round(((evaluatedMetrics.metaRoas ?? 0) / evaluatedMetrics.roas - 1) * 100)}% on ROAS
          and {Math.round((1 - evaluatedMetrics.cpa / (evaluatedMetrics.metaCpa ?? 1)) * 100)}% on CPA.
          Using Meta figures for budget decisions would lead to incorrect scaling.
        </p>
      </section>

      {/* Policy notes */}
      <section className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Policy Notes
        </h2>
        <ul className="space-y-2">
          {policy.notes.map((note, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-400">
              <span className="mt-0.5 shrink-0 text-slate-600">•</span>
              {note}
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PolicyCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function OwnershipGroup({
  label,
  color,
  metrics,
}: {
  label:   string;
  color:   "blue" | "emerald" | "violet";
  metrics: string[];
}) {
  const colors = {
    blue:    "border-blue-800/40 bg-blue-950/20 text-blue-300",
    emerald: "border-emerald-800/40 bg-emerald-950/20 text-emerald-300",
    violet:  "border-violet-800/40 bg-violet-950/20 text-violet-300",
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="mb-2 text-xs font-semibold">{label}</p>
      <ul className="space-y-1">
        {metrics.map((m) => (
          <li key={m} className="text-xs opacity-80">{m}</li>
        ))}
      </ul>
    </div>
  );
}

function CompRow({
  label, meta, crm, system, systemSource,
}: {
  label:        string;
  meta:         string;
  crm:          string;
  system:       string;
  systemSource: "meta" | "crm";
}) {
  return (
    <tr>
      <td className="py-2 pr-4 font-medium text-white">{label}</td>
      <td className="py-2 pr-4 text-blue-300">{meta}</td>
      <td className="py-2 pr-4 text-emerald-300">{crm}</td>
      <td className="py-2">
        <span className={`font-medium ${systemSource === "crm" ? "text-emerald-300" : "text-blue-300"}`}>
          {system}
        </span>
        <span className="ml-2 text-xs text-slate-600">({systemSource})</span>
      </td>
    </tr>
  );
}
