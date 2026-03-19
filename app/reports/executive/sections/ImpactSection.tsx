import type { ExecutiveImpactSummary, ExecutiveAlertItem } from "../../../../lib/executiveReporting/types";

const ALERT_TYPE_LABEL: Record<string, string> = {
  roas_drop:           "ROAS Drop",
  cpa_spike:           "CPA Spike",
  spend_drop:          "Spend Drop",
  spend_spike:         "Spend Spike",
  stale_sync:          "Stale Sync",
  no_data:             "No Data",
  campaign_below_goal: "Below Goal",
  campaign_above_goal: "Above Goal",
  integration_failure: "Integration Failure",
};

const SEV_BADGE: Record<string, string> = {
  high:   "border-rose-800/50 bg-rose-950/60 text-rose-300",
  medium: "border-amber-800/50 bg-amber-950/60 text-amber-300",
  low:    "border-slate-700 bg-slate-800 text-slate-400",
};

function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1)  return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Stat row ──────────────────────────────────────────────────────────────────

function StatRow({ label, value, variant }: { label: string; value: string | number; variant?: "danger" | "warning" | "success" | "neutral" }) {
  const cls =
    variant === "danger"  ? "text-rose-300"    :
    variant === "warning" ? "text-amber-300"   :
    variant === "success" ? "text-emerald-300" :
    "text-slate-300";
  return (
    <div className="flex items-center justify-between border-b border-slate-800/60 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ item }: { item: ExecutiveAlertItem }) {
  const badge = SEV_BADGE[item.severity] ?? SEV_BADGE.low;
  return (
    <div className="border-b border-slate-800/60 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}>
          {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
        </span>
        <span className="text-xs text-slate-500">
          {ALERT_TYPE_LABEL[item.alertType] ?? item.alertType.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-200">{item.entityName}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.summary}</p>
      <p className="mt-1 text-xs text-slate-600">
        {item.clientName} · {timeAgo(item.detectedAt)}
      </p>
    </div>
  );
}

// ── Data warnings ─────────────────────────────────────────────────────────────

function DataWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 p-3">
      <p className="text-xs font-semibold text-amber-400">Data notices</p>
      <ul className="mt-1 space-y-1">
        {warnings.map((w) => (
          <li key={w} className="text-xs text-amber-300/80">· {w}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function ImpactSection({ impact }: { impact: ExecutiveImpactSummary }) {
  return (
    <div className="space-y-4">
      {/* Data warnings first */}
      <DataWarnings warnings={impact.dataWarnings} />

      {/* Operational stats */}
      <div>
        <StatRow
          label="Unresolved alerts"
          value={impact.unresolvedAlertsCount}
          variant={impact.unresolvedAlertsCount > 0 ? "danger" : "neutral"}
        />
        <StatRow
          label="Pacing risks"
          value={impact.pacingRisksCount}
          variant={impact.pacingRisksCount > 0 ? "warning" : "neutral"}
        />
        <StatRow
          label="Auto-executions (period)"
          value={`${impact.autoExecutionSuccessCount} / ${impact.autoExecutionsThisPeriod} succeeded`}
          variant={impact.autoExecutionsThisPeriod > 0 ? "success" : "neutral"}
        />
        {impact.guardrailBlocksCount > 0 && (
          <StatRow
            label="Guardrail blocks"
            value={impact.guardrailBlocksCount}
            variant="warning"
          />
        )}
      </div>

      {/* Notable alerts */}
      {impact.notableAlerts.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
            Notable alerts
          </p>
          {impact.notableAlerts.slice(0, 4).map((a) => (
            <AlertRow key={a.id} item={a} />
          ))}
          {impact.notableAlerts.length > 4 && (
            <p className="mt-2 text-xs text-slate-600">
              + {impact.notableAlerts.length - 4} more alert{impact.notableAlerts.length - 4 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {impact.notableAlerts.length === 0 && impact.unresolvedAlertsCount === 0 && (
        <p className="text-sm text-slate-500">No notable risks detected for this period.</p>
      )}
    </div>
  );
}
