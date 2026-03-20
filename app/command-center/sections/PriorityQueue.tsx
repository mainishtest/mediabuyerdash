"use client";

import Link from "next/link";
import type { CommandCenterPriorityCard, CommandCenterPriority } from "../../../lib/commandCenter/types";
import { priorityBadgeClass, priorityLabel } from "../../../lib/commandCenter/priorityEngine";

const TYPE_ICON: Record<string, string> = {
  alert:      "⚠",
  approval:   "✓",
  experiment: "⚗",
  creative:   "◇",
  pacing:     "◈",
  blocker:    "✕",
};

function PriorityCard({ card }: { card: CommandCenterPriorityCard }) {
  return (
    <Link
      href={card.href}
      className="group flex items-start gap-3 rounded-lg border border-slate-800
                 bg-slate-900/40 p-3 transition-colors hover:border-slate-700 hover:bg-slate-800/60"
    >
      {/* Icon */}
      <span className="mt-0.5 shrink-0 text-sm text-slate-500 group-hover:text-slate-400">
        {TYPE_ICON[card.type] ?? "·"}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(card.priority)}`}
          >
            {priorityLabel(card.priority)}
          </span>
          {card.clientName && (
            <span className="truncate text-xs text-slate-500">{card.clientName}</span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-200 group-hover:text-white">
          {card.title}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{card.subtitle}</p>
      </div>

      {/* Arrow */}
      <span className="mt-1 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400">
        →
      </span>
    </Link>
  );
}

type Props = {
  priorities:      CommandCenterPriorityCard[];
  filterPriority?: CommandCenterPriority;
};

export function PriorityQueue({ priorities, filterPriority }: Props) {
  const filtered = filterPriority
    ? priorities.filter((p) => p.priority === filterPriority)
    : priorities;

  const criticalOrHigh = filtered.filter((p) => p.priority === "critical" || p.priority === "high");
  const rest           = filtered.filter((p) => p.priority === "medium" || p.priority === "low");

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-3xl">✓</p>
        <p className="mt-2 text-sm font-medium text-slate-300">All clear</p>
        <p className="mt-1 text-xs text-slate-500">No priority items at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {criticalOrHigh.length > 0 && (
        <div className="space-y-2">
          {criticalOrHigh.map((card) => (
            <PriorityCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div>
          {criticalOrHigh.length > 0 && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
              Also this period
            </p>
          )}
          <div className="space-y-2">
            {rest.map((card) => (
              <PriorityCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
