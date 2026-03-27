import type { ExecutiveCreativeSummary, ExecutiveCreativeItem } from "../../../../lib/executiveReporting/types";

const INTENT_LABEL: Record<string, string> = {
  preserve_winner_pattern:  "Preserve winner",
  refresh_hook:             "Refresh hook",
  refresh_angle:            "Refresh angle",
  refresh_visual_direction: "Refresh visual",
  full_reset:               "Full reset",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ creative }: { creative: ExecutiveCreativeSummary }) {
  const chips = [
    { label: "Briefs",    value: creative.briefsCreated,     cls: "border-slate-700 bg-slate-800 text-slate-300" },
    { label: "Generated", value: creative.variantsGenerated, cls: "border-slate-700 bg-slate-800 text-slate-300" },
    { label: "Approved",  value: creative.variantsApproved,  cls: "border-sky-800/50 bg-sky-950/60 text-sky-300" },
    {
      label: "Launched",
      value: creative.variantsLaunched,
      cls: creative.variantsLaunched > 0
        ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-300"
        : "border-slate-700 bg-slate-800 text-slate-400",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <div
          key={c.label}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${c.cls}`}
        >
          <span className="text-sm font-semibold">{c.value}</span>
          <span className="text-xs">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Creative item row ─────────────────────────────────────────────────────────

function CreativeRow({ item }: { item: ExecutiveCreativeItem }) {
  const badge =
    item.isLaunched
      ? "border-emerald-800/50 bg-emerald-950/60 text-emerald-300"
      : item.status === "guardrails_passed" || item.status === "validated"
        ? "border-amber-800/50 bg-amber-950/60 text-amber-300"
        : "border-slate-700 bg-slate-800 text-slate-400";

  const badgeLabel =
    item.isLaunched     ? "Launched" :
    item.status === "guardrails_passed" ? "Ready to publish" :
    item.status === "validated"         ? "Validated"        :
    item.status === "draft"             ? "Draft"            : item.status;

  return (
    <div className="border-b border-slate-800/60 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge}`}>
          {badgeLabel}
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
        {item.publishedAt ? ` · Launched ${fmtDate(item.publishedAt)}` : ""}
      </p>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function CreativeSection({ creative }: { creative: ExecutiveCreativeSummary }) {
  // Surface launched items first
  const sorted = [...creative.items].sort((a, b) => {
    if (a.isLaunched && !b.isLaunched) return -1;
    if (!a.isLaunched && b.isLaunched) return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      <SummaryChips creative={creative} />

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">
          No creative activity found for this period. Creative Lab workflow items appear here.
        </p>
      ) : (
        <div>
          {sorted.slice(0, 6).map((c) => (
            <CreativeRow key={c.id} item={c} />
          ))}
          {sorted.length > 6 && (
            <p className="mt-2 text-xs text-slate-600">
              + {sorted.length - 6} more variant{sorted.length - 6 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
