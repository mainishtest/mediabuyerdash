"use client";

import Link from "next/link";
import type { DecisionOutputType } from "../../../../lib/decisionTrace/types";

interface TraceSurfaceCardProps {
  outputType:  DecisionOutputType;
  title:       string;
  description: string;
  href:        string;
  icon:        string;
  examples:    readonly string[];
  statusNote:  string;
}

export function TraceSurfaceCard({
  outputType, title, description, href, icon, examples, statusNote,
}: TraceSurfaceCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-xl text-slate-500 mt-0.5">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          <p className="text-xs text-slate-500 font-mono">{outputType}</p>
        </div>
      </div>

      <p className="text-sm text-slate-400 leading-snug">{description}</p>

      <div className="space-y-1">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">What the trace shows</p>
        <ul className="space-y-0.5">
          {examples.map((ex, i) => (
            <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
              <span className="text-slate-600 mt-0.5">·</span>
              <span>{ex}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-500 italic">{statusNote}</span>
        <Link
          href={href}
          className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          Open surface →
        </Link>
      </div>
    </div>
  );
}
