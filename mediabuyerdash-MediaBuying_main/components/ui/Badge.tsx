import type { ReactNode } from "react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

const STYLES: Record<BadgeVariant, string> = {
  success: "border-emerald-800/50 bg-emerald-950/60 text-emerald-300",
  warning: "border-amber-800/50 bg-amber-950/60 text-amber-300",
  danger:  "border-rose-800/50 bg-rose-950/60 text-rose-300",
  info:    "border-sky-800/50 bg-sky-950/60 text-sky-300",
  neutral: "border-slate-700 bg-slate-800 text-slate-400",
  purple:  "border-violet-800/50 bg-violet-950/60 text-violet-300",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[variant]}`}
    >
      {children}
    </span>
  );
}
