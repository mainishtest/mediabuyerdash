import type { ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize    = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:   "border-transparent bg-emerald-600 text-white hover:bg-emerald-500",
  secondary: "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white",
  ghost:     "border-transparent bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200",
  danger:    "border-transparent bg-rose-700 text-white hover:bg-rose-600",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export function ActionButton({
  children,
  variant = "secondary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg border font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-40
        ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
