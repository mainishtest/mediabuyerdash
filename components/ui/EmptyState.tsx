import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon = "○",
}: {
  title:        string;
  description?: string;
  action?:      ReactNode;
  icon?:        string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 text-3xl text-slate-700" aria-hidden>
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
