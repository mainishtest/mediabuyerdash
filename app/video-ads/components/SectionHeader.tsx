"use client";

interface SectionHeaderProps {
  title:         string;
  count?:        number;
  isPending?:    boolean;
  onRegenerate?: () => void;
}

export function SectionHeader({ title, count, isPending, onRegenerate }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
          {title}
        </h3>
        {typeof count === "number" && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">
            {count}
          </span>
        )}
      </div>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-50"
        >
          {isPending ? (
            <>
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Regenerating…
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-5M20 15a9 9 0 01-15 5" />
              </svg>
              Regenerate
            </>
          )}
        </button>
      )}
    </div>
  );
}
