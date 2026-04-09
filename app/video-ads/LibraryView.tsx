"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { StatusBadge } from "./components/StatusBadge";
import { PlatformBadge } from "./components/PlatformBadge";
import { TagPill } from "./components/TagPill";
import { EmptyState } from "./components/EmptyState";
import {
  AD_STYLE_LABELS,
  STATUS_LABELS,
  type AdStyle,
  type ConceptStatus,
} from "../../lib/videoAdGenerator/types";

interface ConceptCard {
  id:          string;
  title:       string;
  status:      string;
  platform:    string;
  adStyle:     string;
  productName: string;
  bigIdea:     string | null;
  hookCount:   number;
  engineVersion: string;
  createdAt:   string; // ISO string for client
}

interface LibraryViewProps {
  concepts: ConceptCard[];
}

const STATUS_FILTERS: ConceptStatus[] = ["draft", "approved", "shot", "live", "killed"];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LibraryView({ concepts }: LibraryViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const filtered = useMemo(() => {
    let result = concepts;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.productName.toLowerCase().includes(q) ||
          (c.bigIdea && c.bigIdea.toLowerCase().includes(q))
      );
    }

    if (statusFilter) result = result.filter((c) => c.status === statusFilter);
    if (platformFilter) result = result.filter((c) => c.platform === platformFilter);

    result = [...result].sort((a, b) =>
      sort === "newest"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return result;
  }, [concepts, search, statusFilter, platformFilter, sort]);

  // Stats
  const stats = STATUS_FILTERS.slice(0, 4).map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    count: concepts.filter((c) => c.status === s).length,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Creative OS</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Video Ad Generator</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/video-ads/assets"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Assets
          </Link>
          <Link
            href="/video-ads/new"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Concept
          </Link>
        </div>
      </header>

      {/* Stats */}
      {concepts.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <button
              key={s.status}
              onClick={() => setStatusFilter(statusFilter === s.status ? null : s.status)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                statusFilter === s.status
                  ? "border-emerald-700 bg-emerald-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{s.count}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search + filters */}
      {concepts.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search concepts…"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Platform filter */}
          <div className="flex gap-1">
            {(["facebook", "rumble", "both"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                  platformFilter === p
                    ? p === "facebook" ? "border-sky-700 bg-sky-900/30 text-sky-300"
                    : p === "rumble" ? "border-orange-700 bg-orange-900/30 text-orange-300"
                    : "border-purple-700 bg-purple-900/30 text-purple-300"
                    : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                {p === "facebook" ? "Facebook" : p === "rumble" ? "Rumble" : "Both"}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 focus:border-emerald-600 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Active filter count */}
          {(statusFilter || platformFilter || search) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter(null); setPlatformFilter(null); }}
              className="text-[11px] font-medium text-slate-500 hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {concepts.length === 0 && (
        <EmptyState
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
          title="No concepts yet"
          message="Create your first concept — provide your offer, audience, and platform, and get a full creative brief in under two minutes."
          action={
            <Link href="/video-ads/new" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              Start First Concept
            </Link>
          }
        />
      )}

      {/* No results */}
      {concepts.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No concepts match your filters.</p>
        </div>
      )}

      {/* Concept grid */}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/video-ads/${c.id}`}
              className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-all hover:border-slate-700 hover:bg-slate-900"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={c.status} label={STATUS_LABELS[c.status as ConceptStatus] ?? c.status} />
                  {c.engineVersion === "v2" && (
                    <span className="rounded border border-emerald-700 bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">V2</span>
                  )}
                </div>
                <span className="text-[11px] tabular-nums text-slate-500">{formatDate(c.createdAt)}</span>
              </div>

              <h3 className="line-clamp-2 text-base font-semibold text-white transition-colors group-hover:text-emerald-400">
                {c.title}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">{c.productName}</p>

              {c.bigIdea && (
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-400">{c.bigIdea}</p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-slate-800/60 pt-3 mt-4">
                <PlatformBadge platform={c.platform} />
                <TagPill>{AD_STYLE_LABELS[c.adStyle as AdStyle] ?? c.adStyle}</TagPill>
                {c.hookCount > 0 && <TagPill>{`${c.hookCount} hooks`}</TagPill>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
