// components/ui/GoalSourceBadge.tsx
// Reusable badge showing where a resolved goal came from.
// Used on campaign cards, creative rows, and the settings page.
//
// Mobile: compact chip (label only).
// Desktop: chip with optional description text alongside.

import type { GoalSource } from "../../lib/goals/types";

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const BADGE_STYLES: Record<GoalSource, string> = {
  campaign:       "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
  client:         "bg-indigo-900/40  text-indigo-300  border-indigo-800/60",
  system_default: "bg-slate-800/60   text-slate-400   border-slate-700/60",
};

const BADGE_LABELS: Record<GoalSource, string> = {
  campaign:       "Campaign Goal",
  client:         "Client Default",
  system_default: "System Default",
};

const BADGE_DESCRIPTIONS: Record<GoalSource, string> = {
  campaign:       "Override set directly on this campaign",
  client:         "Inherited from client-level defaults",
  system_default: "No goal set — using system fallback (ROAS 2.0×)",
};

const BADGE_DOTS: Record<GoalSource, string> = {
  campaign:       "bg-emerald-400",
  client:         "bg-indigo-400",
  system_default: "bg-slate-500",
};

// ---------------------------------------------------------------------------
// GoalSourceBadge
// ---------------------------------------------------------------------------

export function GoalSourceBadge({
  source,
  showDescription = false,
  size = "sm",
}: {
  source:          GoalSource;
  showDescription?: boolean;
  size?:           "xs" | "sm";
}) {
  const textSize = size === "xs" ? "text-xs" : "text-xs";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${textSize} font-medium ${BADGE_STYLES[source]}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${BADGE_DOTS[source]}`} />
        {BADGE_LABELS[source]}
      </span>
      {showDescription && (
        <span className="text-xs text-slate-500">
          {BADGE_DESCRIPTIONS[source]}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GoalSourceLegend
// Used on settings pages to explain the hierarchy.
// ---------------------------------------------------------------------------

export function GoalSourceLegend() {
  const items: { source: GoalSource; desc: string }[] = [
    { source: "campaign",       desc: "Set directly on the campaign — highest priority" },
    { source: "client",         desc: "Client-wide defaults — applies when no campaign goal is set" },
    { source: "system_default", desc: "System fallback (ROAS 2.0×) — applies when nothing is set" },
  ];

  return (
    <div className="space-y-2">
      {items.map(({ source, desc }) => (
        <div key={source} className="flex items-start gap-2">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${BADGE_DOTS[source]}`} />
          <div>
            <span className="text-xs font-medium text-slate-300">{BADGE_LABELS[source]}</span>
            <span className="text-xs text-slate-600"> — {desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
