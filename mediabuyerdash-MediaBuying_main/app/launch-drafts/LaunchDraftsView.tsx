"use client";

import Link from "next/link";

type Variant = { selectedForLaunch: boolean };

type Draft = {
  id:          string;
  draftName:   string;
  baseAdName:  string;
  campaignId:  string;
  source:      string;
  status:      string;
  createdAt:   Date;
  variants:    Variant[];
};

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-amber-900/60 text-amber-300",
  ready:    "bg-emerald-900/60 text-emerald-300",
  archived: "bg-slate-700 text-slate-400",
};

const SOURCE_LABELS: Record<string, string> = {
  generated_copy:  "Copy",
  generated_image: "Image",
  generated_both:  "Copy + Image",
  manual:          "Manual",
};

export function LaunchDraftsView({ drafts }: { drafts: Draft[] }) {
  if (drafts.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <p className="text-slate-400">No launch drafts yet.</p>
        <p className="mt-2 text-sm text-slate-500">
          Go to <Link href="/creative-history" className="underline text-sky-400">Generation History</Link> and click
          &ldquo;Create Launch Draft&rdquo; on a run with approved variants.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/60">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Draft name</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Base ad</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Source</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Variants</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => {
            const selected = d.variants.filter((v) => v.selectedForLaunch).length;
            return (
              <tr
                key={d.id}
                className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30"
              >
                <td className="px-4 py-3 font-medium text-white">{d.draftName}</td>
                <td className="px-4 py-3 text-slate-300">{d.baseAdName}</td>
                <td className="px-4 py-3 text-slate-400">
                  {SOURCE_LABELS[d.source] ?? d.source}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[d.status] ?? "bg-slate-700 text-slate-400"}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {selected}/{d.variants.length} selected
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/launch-drafts/${d.id}`}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
