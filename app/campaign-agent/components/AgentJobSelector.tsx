"use client";

import type { AgentType } from "../../../lib/agentFramework/types";
import { AGENT_CAPABILITIES } from "../../../lib/agentFramework/constants";

const TABS: { type: AgentType; label: string }[] = [
  { type: "launch", label: "Launch" },
  { type: "optimization", label: "Optimize" },
  { type: "audit", label: "Audit" },
];

export function AgentJobSelector({
  active,
  onChange,
}: {
  active: AgentType;
  onChange: (type: AgentType) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
      {TABS.map((tab) => {
        const cap = AGENT_CAPABILITIES[tab.type];
        return (
          <button
            key={tab.type}
            onClick={() => onChange(tab.type)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.type
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
            title={cap.description}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
