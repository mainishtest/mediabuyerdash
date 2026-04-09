"use client";

import type { PreflightCheck } from "../../../lib/agentFramework/types";

const STATUS_STYLES = {
  pass: { icon: "\u2713", color: "text-emerald-400" },
  warn: { icon: "!", color: "text-amber-400" },
  fail: { icon: "\u2717", color: "text-red-400" },
} as const;

export function PreflightPanel({ checks }: { checks: PreflightCheck[] }) {
  const passed = checks.filter((c) => c.status === "pass").length;
  const total = checks.length;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">Preflight Checks</h4>
        <span className="text-xs text-slate-400">
          {passed}/{total} passed
        </span>
      </div>
      <div className="space-y-2">
        {checks.map((check, i) => {
          const style = STATUS_STYLES[check.status];
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 text-xs font-bold ${style.color}`}>
                {style.icon}
              </span>
              <div className="flex-1">
                <span className="font-medium text-slate-300">{check.name}</span>
                <p className="text-xs text-slate-500">{check.message}</p>
              </div>
              {check.blocking && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                  Blocking
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
