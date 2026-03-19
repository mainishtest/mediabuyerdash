import Link from "next/link";
import type { CommandCenterCreativeItem } from "../../../lib/commandCenter/types";

const DIRECTION_CONFIG = {
  ready_to_publish: {
    badge:  "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
    label:  "Ready to publish",
    action: "Publish",
    btn:    "hover:border-emerald-600 hover:bg-emerald-900/30 hover:text-emerald-300",
  },
  awaiting_review: {
    badge:  "border-amber-800/50 bg-amber-950/60 text-amber-300",
    label:  "Awaiting review",
    action: "Review",
    btn:    "hover:border-amber-600 hover:bg-amber-900/30 hover:text-amber-300",
  },
  in_progress: {
    badge:  "border-slate-700 bg-slate-800 text-slate-400",
    label:  "In progress",
    action: "Open",
    btn:    "hover:border-slate-600 hover:text-slate-200",
  },
};

const INTENT_LABEL: Record<string, string> = {
  preserve_winner_pattern: "Preserve winner",
  refresh_hook:            "Refresh hook",
  refresh_angle:           "Refresh angle",
  refresh_visual_direction: "Refresh visual",
  full_reset:              "Full reset",
};

function CreativeRow({ item }: { item: CommandCenterCreativeItem }) {
  const cfg = DIRECTION_CONFIG[item.direction];

  return (
    <div className="flex items-start gap-3 border-b border-slate-800/60 px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-slate-500">{item.variantType}</span>
          {item.briefIntent && (
            <span className="text-xs text-slate-600">
              · {INTENT_LABEL[item.briefIntent] ?? item.briefIntent}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-200">{item.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {item.clientName}
          {item.campaignName ? ` · ${item.campaignName}` : ""}
        </p>
      </div>
      <Link
        href={item.href}
        className={`shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5
                    text-xs font-medium text-slate-300 transition-colors ${cfg.btn}`}
      >
        {cfg.action}
      </Link>
    </div>
  );
}

export function CreativePanel({ creativeItems }: { creativeItems: CommandCenterCreativeItem[] }) {
  if (creativeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-3xl">◇</p>
        <p className="mt-2 text-sm font-medium text-slate-300">No creative actions pending</p>
        <p className="mt-1 text-xs text-slate-500">
          Creative Lab publish-prep items awaiting review or ready to publish appear here.
        </p>
        <Link
          href="/creative-lab"
          className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5
                     text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
        >
          Go to Creative Lab
        </Link>
      </div>
    );
  }

  // Surface ready_to_publish first, then awaiting_review, then in_progress
  const ORDER: Record<string, number> = { ready_to_publish: 0, awaiting_review: 1, in_progress: 2 };
  const sorted = [...creativeItems].sort(
    (a, b) => (ORDER[a.direction] ?? 9) - (ORDER[b.direction] ?? 9)
  );

  return (
    <div>
      {sorted.slice(0, 6).map((c) => (
        <CreativeRow key={c.id} item={c} />
      ))}
      {creativeItems.length > 6 && (
        <div className="border-t border-slate-800/60 px-4 py-3">
          <Link href="/creative-lab" className="text-xs text-emerald-400 hover:text-emerald-300">
            View all {creativeItems.length} creative items →
          </Link>
        </div>
      )}
    </div>
  );
}
