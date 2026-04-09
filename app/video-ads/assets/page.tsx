import Link from "next/link";
import { prisma } from "../../../lib/db";
import { AssetLibraryView } from "./AssetLibraryView";
import { getAvailableProviders } from "../../../lib/videoAdGenerator/providers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Creative Assets — Media Buying Dashboard",
};

export default async function AssetsPage() {
  const [assets, providers] = await Promise.all([
    prisma.creativeAsset.findMany({
      orderBy: { createdAt: "desc" },
      include: { concept: { select: { id: true, title: true } } },
    }),
    Promise.resolve(getAvailableProviders()),
  ]);

  const serialized = assets.map((a) => ({
    id:           a.id,
    name:         a.name,
    type:         a.type,
    sourceType:   a.sourceType,
    status:       a.status,
    provider:     a.provider,
    url:          a.url,
    thumbnailUrl: a.thumbnailUrl,
    mimeType:     a.mimeType,
    aspectRatio:  a.aspectRatio,
    headline:     a.headline,
    tags:         a.tags ? (() => { try { return JSON.parse(a.tags) as string[]; } catch { return []; } })() : [],
    conceptTitle: a.concept?.title ?? null,
    conceptId:    a.conceptId,
    createdAt:    a.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/video-ads"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back to concepts
          </Link>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Creative OS</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Creative Assets</h1>
        </div>
      </header>

      {/* Provider status bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Providers:</span>
        {providers.map((p) => (
          <span
            key={p.slug}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              p.isAvailable
                ? "border border-emerald-800 bg-emerald-950/30 text-emerald-400"
                : "border border-slate-800 bg-slate-900/50 text-slate-600"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${p.isAvailable ? "bg-emerald-400" : "bg-slate-700"}`} />
            {p.displayName}
          </span>
        ))}
      </div>

      <AssetLibraryView assets={serialized} />
    </div>
  );
}
