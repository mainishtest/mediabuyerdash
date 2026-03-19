import Link from "next/link";
import type { CommandCenterAlertItem } from "../../../lib/commandCenter/types";
import { formatAlertType } from "../../../lib/commandCenter/priorityEngine";

const SEVERITY_BADGE: Record<string, string> = {
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

function AlertRow({ item }: { item: CommandCenterAlertItem }) {
  const badge = SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.low;

  return (
    <div className="flex items-start gap-3 border-b border-slate-800/60 px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}>
            {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
          </span>
          <span className="text-xs text-slate-500">{formatAlertType(item.alertType)}</span>
          {item.isAcknowledged && (
            <span className="text-xs text-slate-600">· ack'd</span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-200">{item.entityName}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.body}</p>
        <p className="mt-1 text-xs text-slate-600">
          {item.clientName} · {timeAgo(item.detectedAt)}
        </p>
      </div>
      <Link
        href={item.href}
        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
                   text-xs font-medium text-slate-300 transition-colors
                   hover:border-rose-700 hover:bg-rose-900/20 hover:text-rose-300"
      >
        View
      </Link>
    </div>
  );
}

export function AlertsPanel({ alertItems }: { alertItems: CommandCenterAlertItem[] }) {
  if (alertItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-3xl">✓</p>
        <p className="mt-2 text-sm font-medium text-slate-300">No open alerts</p>
        <p className="mt-1 text-xs text-slate-500">
          Anomaly detection runs on each sync. Alerts will appear here when issues are detected.
        </p>
      </div>
    );
  }

  const unack = alertItems.filter((a) => !a.isAcknowledged);
  const ack   = alertItems.filter((a) =>  a.isAcknowledged);

  return (
    <div>
      {unack.slice(0, 8).map((a) => (
        <AlertRow key={a.id} item={a} />
      ))}
      {ack.length > 0 && unack.length > 0 && (
        <p className="border-t border-slate-800/60 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-widest text-slate-600">
          Acknowledged
        </p>
      )}
      {ack.slice(0, 3).map((a) => (
        <AlertRow key={a.id} item={a} />
      ))}
      {alertItems.length > 11 && (
        <div className="border-t border-slate-800/60 px-4 py-3">
          <Link href="/alerts" className="text-xs text-emerald-400 hover:text-emerald-300">
            View all {alertItems.length} alerts →
          </Link>
        </div>
      )}
    </div>
  );
}
