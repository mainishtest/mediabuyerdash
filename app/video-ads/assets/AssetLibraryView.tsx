"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "../components/EmptyState";
import { TagPill } from "../components/TagPill";
import {
  ASSET_TYPE_LABELS,
  ASSET_SOURCE_LABELS,
  ASSET_STATUS_LABELS,
  type AssetType,
  type AssetSourceType,
  type AssetStatus,
} from "../../../lib/videoAdGenerator/types";
import { createAssetAction, deleteAssetAction, updateAssetAction } from "../actions";

interface AssetCard {
  id:           string;
  name:         string;
  type:         string;
  sourceType:   string;
  status:       string;
  provider:     string | null;
  url:          string | null;
  thumbnailUrl: string | null;
  mimeType:     string | null;
  aspectRatio:  string | null;
  headline:     string | null;
  tags:         string[];
  conceptTitle: string | null;
  conceptId:    string | null;
  createdAt:    string;
}

interface Props {
  assets: AssetCard[];
}

const TYPE_FILTERS: AssetType[] = ["video", "image", "carousel", "text"];
const SOURCE_FILTERS: AssetSourceType[] = ["generated", "imported", "external_url"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_ICONS: Record<string, string> = {
  video:    "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
  image:    "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  carousel: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2",
  text:     "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
};

const STATUS_COLORS: Record<string, string> = {
  draft:    "border-slate-700 bg-slate-800/50 text-slate-400",
  ready:    "border-emerald-800 bg-emerald-950/40 text-emerald-400",
  in_use:   "border-sky-800 bg-sky-950/40 text-sky-400",
  archived: "border-slate-700 bg-slate-900/50 text-slate-500",
};

export function AssetLibraryView({ assets }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Import form state
  const [importName, setImportName] = useState("");
  const [importType, setImportType] = useState<AssetType>("video");
  const [importUrl, setImportUrl] = useState("");

  const filtered = useMemo(() => {
    let result = assets;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.headline && a.headline.toLowerCase().includes(q)) ||
          (a.conceptTitle && a.conceptTitle.toLowerCase().includes(q))
      );
    }
    if (typeFilter) result = result.filter((a) => a.type === typeFilter);
    if (sourceFilter) result = result.filter((a) => a.sourceType === sourceFilter);
    return result;
  }, [assets, search, typeFilter, sourceFilter]);

  // Stats
  const typeCounts = TYPE_FILTERS.map((t) => ({
    type: t,
    label: ASSET_TYPE_LABELS[t],
    count: assets.filter((a) => a.type === t).length,
  }));

  async function handleImport() {
    if (!importName.trim()) return;
    startTransition(async () => {
      const result = await createAssetAction({
        name: importName.trim(),
        type: importType,
        sourceType: importUrl.trim() ? "external_url" : "imported",
        url: importUrl.trim() || undefined,
      });
      if (result.ok) {
        setShowImport(false);
        setImportName("");
        setImportUrl("");
        router.refresh();
      }
    });
  }

  async function handleDelete(assetId: string) {
    startTransition(async () => {
      await deleteAssetAction(assetId);
      router.refresh();
    });
  }

  async function handleStatusChange(assetId: string, status: string) {
    startTransition(async () => {
      await updateAssetAction(assetId, { status });
      router.refresh();
    });
  }

  return (
    <>
      {/* Stats */}
      {assets.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {typeCounts.map((t) => (
            <button
              key={t.type}
              onClick={() => setTypeFilter(typeFilter === t.type ? null : t.type)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                typeFilter === t.type
                  ? "border-emerald-700 bg-emerald-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{t.count}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search + filters + import button */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {assets.length > 0 && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        )}

        {/* Source filter */}
        {assets.length > 0 && (
          <div className="flex gap-1">
            {SOURCE_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                  sourceFilter === s
                    ? "border-emerald-700 bg-emerald-900/30 text-emerald-300"
                    : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                {ASSET_SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowImport(!showImport)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Import Asset
        </button>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/80 p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Import Creative Asset</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Name</label>
              <input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Asset name..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Type</label>
              <select
                value={importType}
                onChange={(e) => setImportType(e.target.value as AssetType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
              >
                {TYPE_FILTERS.map((t) => (
                  <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">URL (optional)</label>
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleImport}
              disabled={!importName.trim() || isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPending ? "Importing..." : "Import"}
            </button>
            <button
              onClick={() => setShowImport(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {assets.length === 0 && !showImport && (
        <EmptyState
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          title="No creative assets yet"
          message="Import assets from files or URLs, or promote generated concepts to standalone creative assets."
          action={
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Import First Asset
            </button>
          }
        />
      )}

      {/* No results */}
      {assets.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-12 text-center">
          <p className="text-sm text-slate-400">No assets match your filters.</p>
        </div>
      )}

      {/* Asset grid */}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-all hover:border-slate-700 hover:bg-slate-900"
            >
              {/* Header row */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[a.status] ?? STATUS_COLORS.draft}`}>
                    {ASSET_STATUS_LABELS[a.status as AssetStatus] ?? a.status}
                  </span>
                  <span className="rounded border border-slate-700 bg-slate-800/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-400">
                    {ASSET_TYPE_LABELS[a.type as AssetType] ?? a.type}
                  </span>
                </div>
                <span className="text-[11px] tabular-nums text-slate-500">{formatDate(a.createdAt)}</span>
              </div>

              {/* Type icon + name */}
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg border border-slate-800 bg-slate-950 p-2">
                  <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={TYPE_ICONS[a.type] ?? TYPE_ICONS.text} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-base font-semibold text-white">{a.name}</h3>
                  {a.headline && <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{a.headline}</p>}
                </div>
              </div>

              {/* Source info */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <TagPill>{ASSET_SOURCE_LABELS[a.sourceType as AssetSourceType] ?? a.sourceType}</TagPill>
                {a.provider && <TagPill>{a.provider}</TagPill>}
                {a.aspectRatio && <TagPill>{a.aspectRatio}</TagPill>}
                {a.tags.map((tag) => <TagPill key={tag}>{tag}</TagPill>)}
              </div>

              {/* Concept link */}
              {a.conceptTitle && a.conceptId && (
                <Link
                  href={`/video-ads/${a.conceptId}`}
                  className="mt-2 text-[11px] text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  From: {a.conceptTitle}
                </Link>
              )}

              {/* Actions */}
              <div className="mt-auto flex items-center gap-2 border-t border-slate-800/60 pt-3 mt-4">
                <select
                  value={a.status}
                  onChange={(e) => handleStatusChange(a.id, e.target.value)}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-400 focus:border-emerald-600 focus:outline-none"
                >
                  {(["draft", "ready", "in_use", "archived"] as AssetStatus[]).map((s) => (
                    <option key={s} value={s}>{ASSET_STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="ml-auto text-[11px] font-medium text-slate-600 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
