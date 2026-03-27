"use client";

import Link from "next/link";
import { priorityBadgeClass, priorityLabel } from "../../../lib/commandCenter/priorityEngine";
import type {
  CommandCenterSummary,
  CommandCenterPriorityCard,
  CommandCenterAlertItem,
  CommandCenterExperimentItem,
} from "../../../lib/commandCenter/types";

interface MorningBriefingProps {
  summary: CommandCenterSummary;
  priorities: CommandCenterPriorityCard[];
  alertItems: CommandCenterAlertItem[];
  experiments: CommandCenterExperimentItem[];
  learningInsight: string | null;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function MorningBriefing({
  summary,
  priorities,
  alertItems,
  experiments,
  learningInsight,
}: MorningBriefingProps) {
  // Count unresolved alerts (not acknowledged)
  const unresolvedAlerts = alertItems.filter((a) => !a.isAcknowledged).length;

  // Count experiments ready for evaluation
  const readyForEvaluation = experiments.filter((e) => e.hasResult).length;

  // Count creatives ready to publish (inferred from priority cards)
  const creativesReady = priorities.filter((p) => p.type === "creative").length;

  // Build natural-language summary
  const summaryParts: string[] = [];

  if (summary.pendingApprovalsCount > 0) {
    summaryParts.push(
      `${summary.pendingApprovalsCount} critical ${summary.pendingApprovalsCount === 1 ? "priority" : "priorities"}`
    );
  }

  if (unresolvedAlerts > 0) {
    summaryParts.push(`${unresolvedAlerts} unresolved ${unresolvedAlerts === 1 ? "alert" : "alerts"}`);
  }

  if (readyForEvaluation > 0) {
    summaryParts.push(
      `${readyForEvaluation} ${readyForEvaluation === 1 ? "experiment" : "experiments"} ready for evaluation`
    );
  }

  const summaryText =
    summaryParts.length > 0
      ? `You have ${summaryParts.join(", ")}. Overall ROAS is ${summary.overallRoas?.toFixed(1) ?? "N/A"}x on $${(summary.totalSpend / 1000).toFixed(0)}k spend${creativesReady > 0 ? `. ${creativesReady} ${creativesReady === 1 ? "creative is" : "creatives are"} ready to publish.` : "."}`
      : `Overall ROAS is ${summary.overallRoas?.toFixed(1) ?? "N/A"}x on $${(summary.totalSpend / 1000).toFixed(0)}k spend. All systems nominal.`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
      {/* Header */}
      <div className="flex items-baseline justify-between border-b border-slate-800/60 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-100">Morning Briefing</h2>
        <p className="text-xs text-slate-500">Generated at {formatTime(summary.generatedAt)}</p>
      </div>

      {/* Summary paragraph */}
      <div className="px-4 py-4">
        <p className="text-sm leading-relaxed text-slate-300">{summaryText}</p>
      </div>

      {/* Learning insight callout */}
      {learningInsight && (
        <div className="border-t border-slate-800/60 bg-slate-950/50 px-4 py-3">
          <div className="flex gap-2">
            <span className="shrink-0 text-sm">💡</span>
            <p className="text-xs text-slate-400">{learningInsight}</p>
          </div>
        </div>
      )}

      {/* Top 3 Actions */}
      <div className={learningInsight ? "border-t border-slate-800/60" : ""}>
        <div className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Top 3 Actions</p>
        </div>

        {priorities.length === 0 ? (
          <div className="border-t border-slate-800/60 px-4 py-4 text-center">
            <p className="text-xs text-slate-500">No priority actions at this time</p>
          </div>
        ) : (
          <div className="border-t border-slate-800/60">
            {priorities.slice(0, 3).map((card, idx) => (
              <div
                key={card.id}
                className={`flex items-start gap-3 px-4 py-3 ${idx < Math.min(3, priorities.length) - 1 ? "border-b border-slate-800/30" : ""}`}
              >
                {/* Priority badge */}
                <div className="shrink-0 pt-0.5">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(card.priority)}`}
                  >
                    {priorityLabel(card.priority)}
                  </span>
                </div>

                {/* Title */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">{card.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{card.subtitle}</p>
                </div>

                {/* Link */}
                <Link
                  href={card.href}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs
                             font-medium text-slate-300 transition-colors hover:border-emerald-600
                             hover:bg-emerald-900/30 hover:text-emerald-300"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
