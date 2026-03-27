import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  children,
  actions,
  flush = false,
  className = "",
}: {
  title?:       string;
  description?: string;
  children:     ReactNode;
  actions?:     ReactNode;
  // flush=true removes inner padding — useful for tables that span edge-to-edge
  flush?:       boolean;
  className?:   string;
}) {
  const hasHeader = title || description || actions;
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/60 px-5 py-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-white">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={flush ? "overflow-hidden" : "p-5"}>{children}</div>
    </div>
  );
}
