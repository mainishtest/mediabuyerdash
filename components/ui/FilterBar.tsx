import type { ReactNode } from "react";

// A horizontal bar that wraps filter controls with consistent spacing.
// Pass label+select pairs or any arbitrary ReactNode children.
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
    </div>
  );
}

// Convenience label for use inside FilterBar
export function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium text-slate-500">{children}</span>
  );
}

// Convenience select for use inside FilterBar
export function FilterSelect({
  value,
  onChange,
  children,
}: {
  value:    string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200
        focus:border-slate-600 focus:outline-none"
    >
      {children}
    </select>
  );
}
