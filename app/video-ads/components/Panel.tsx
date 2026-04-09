import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Panel({ children, className = "", noPadding }: PanelProps) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/50 ${noPadding ? "" : "p-6"} ${className}`}>
      {children}
    </div>
  );
}
