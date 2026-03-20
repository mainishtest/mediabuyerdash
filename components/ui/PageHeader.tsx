import type { ReactNode } from "react";

// components/ui/PageHeader.tsx
// Responsive page header — stacks on mobile, row on sm+.
// title + badge on the first line.
// description on the second.
// actions pinned below on mobile, right-aligned on sm+.

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title:        string;
  description?: string;
  actions?:     ReactNode;
  badge?:       ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      {/* Left: title + badge + description */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            {description}
          </p>
        )}
      </div>

      {/* Right: actions — full-width row on mobile, shrink on sm+ */}
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
