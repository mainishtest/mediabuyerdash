"use client";

import type { AgentRecommendation } from "../../../lib/agentFramework/types";
import type { OptimizationAnalysis } from "../../../lib/optimizationAgent/types";
import { RecommendationCard } from "./RecommendationCard";

export function OptimizationPanel({
  analysis,
  recommendations,
  summary,
}: {
  analysis: OptimizationAnalysis;
  recommendations: AgentRecommendation[];
  summary: string;
}) {
  const highImpact = recommendations.filter((r) => r.impact === "high");
  const mediumImpact = recommendations.filter((r) => r.impact === "medium");
  const lowImpact = recommendations.filter((r) => r.impact === "low");

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active Campaigns" value={String(analysis.campaigns.length)} />
        <StatCard
          label="Total Spend (7d)"
          value={`$${analysis.campaigns.reduce((s, c) => s + c.spend, 0).toFixed(0)}`}
        />
        <StatCard label="Recommendations" value={String(recommendations.length)} />
        <StatCard label="Fatigue Alerts" value={String(analysis.fatigueSignals.length)} />
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-400">{summary}</p>

      {/* Recommendations by priority */}
      {recommendations.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
          <p className="text-sm text-slate-500">
            No recommendations at this time. Your account looks healthy.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {highImpact.length > 0 && (
            <Section label="High Impact" count={highImpact.length} recs={highImpact} />
          )}
          {mediumImpact.length > 0 && (
            <Section label="Medium Impact" count={mediumImpact.length} recs={mediumImpact} />
          )}
          {lowImpact.length > 0 && (
            <Section label="Low Impact" count={lowImpact.length} recs={lowImpact} />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Section({ label, count, recs }: { label: string; count: number; recs: AgentRecommendation[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label} ({count})
      </h4>
      <div className="space-y-3">
        {recs.map((rec) => (
          <RecommendationCard key={rec.id} rec={rec} />
        ))}
      </div>
    </div>
  );
}
