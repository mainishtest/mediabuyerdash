"use client";

import Link from "next/link";
import type { OptimizationAssistantActionLink } from "../../../lib/optimizationAssistant/types";

interface ActionLinksPanelProps {
  links: OptimizationAssistantActionLink[];
}

export function ActionLinksPanel({ links }: ActionLinksPanelProps) {
  if (links.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Quick actions</p>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm
                       bg-slate-800 border border-slate-700 rounded-lg
                       text-slate-300 hover:text-white hover:border-emerald-600 hover:bg-slate-700
                       active:scale-95 transition-all duration-150 whitespace-nowrap"
            title={link.description}
          >
            <span className="text-slate-500 text-xs">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
