"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Run = {
  id: string;
  clientAccountId: string | null;
  campaignId: string;
  adSetId: string | null;
  adId: string;
  adName: string;
  requestType: string;
  provider: string;
  mode: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  promptSnapshot: { renderedPrompt: string; contextSnapshotJson: string; templateType: string; templateVersion: string } | null;
  providerRequest: { requestPayloadJson: string; provider: string } | null;
  providerResponse: { responsePayloadJson: string; executionStatus: string; errorMessage: string | null } | null;
  copyVariations: Array<{ id: string; title: string; hook: string; body: string; callToAction: string; approvalStatus: string }>;
  imageVariations: Array<{ id: string; title: string; conceptSummary: string; visualChanges: string; goal: string; approvalStatus: string }>;
  approvalDecisions: Array<{ variationType: string; variationId: string; decision: string; decidedAt: Date }>;
  selectedVariants: Array<{ variationType: string; variationId: string }>;
};

type ClientAccount = { id: string; name: string };

type Props = {
  runs: Run[];
  clientAccounts: ClientAccount[];
  filters: {
    clientAccountId?: string;
    requestType?: string;
    provider?: string;
    status?: string;
  };
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-900/60 text-emerald-300",
  failed: "bg-rose-900/60 text-rose-300",
  partial: "bg-amber-900/60 text-amber-300"
};

export function GenerationHistoryView({ runs, clientAccounts, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/creative-history?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Audit note */}
      <section className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
        <p className="text-sm text-amber-200">
          <strong>Audit trail purpose:</strong> This history supports human review, traceability, future testing workflow, and future publishing workflow.
          All generated variations require approval before use.
        </p>
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Filters</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-400">Client:</label>
          <select
            value={filters.clientAccountId ?? ""}
            onChange={(e) => updateFilter("clientAccount", e.target.value || undefined)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
          >
            <option value="">All</option>
            {clientAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <label className="text-sm text-slate-400">Request type:</label>
          <select
            value={filters.requestType ?? ""}
            onChange={(e) => updateFilter("requestType", e.target.value || undefined)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
          >
            <option value="">All</option>
            <option value="copy_generation">Copy</option>
            <option value="image_variation_generation">Image</option>
          </select>
          <label className="text-sm text-slate-400">Provider:</label>
          <select
            value={filters.provider ?? ""}
            onChange={(e) => updateFilter("provider", e.target.value || undefined)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
          >
            <option value="">All</option>
            <option value="openai_text">OpenAI</option>
            <option value="anthropic_text">Anthropic</option>
            <option value="image_provider_placeholder">Image placeholder</option>
          </select>
          <label className="text-sm text-slate-400">Status:</label>
          <select
            value={filters.status ?? ""}
            onChange={(e) => updateFilter("status", e.target.value || undefined)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-600 focus:outline-none"
          >
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </section>

      {/* List */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60">
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Run</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Type</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Provider</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Ad</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Created</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Variations</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400">Approval</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    No generation runs yet. Run the pipeline in Creative Lab to create history.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const [expanded, setExpanded] = useState(false);
  const variationCount = run.copyVariations.length + run.imageVariations.length;
  const approved = run.approvalDecisions.filter((d) => d.decision === "approved").length;
  const rejected = run.approvalDecisions.filter((d) => d.decision === "rejected").length;
  const approvalSummary = variationCount > 0 ? `${approved} approved, ${rejected} rejected` : "—";

  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-800 last:border-0 hover:bg-slate-800/40"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-3">
          <span className="text-slate-400">{expanded ? "▼" : "▶"}</span>
        </td>
        <td className="px-3 py-3 text-slate-300">
          {run.requestType === "copy_generation" ? "Copy" : "Image"}
        </td>
        <td className="px-3 py-3 font-mono text-xs text-slate-400">{run.provider}</td>
        <td className="px-3 py-3">
          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[run.status] ?? "bg-slate-700 text-slate-400"}`}>
            {run.status}
          </span>
        </td>
        <td className="px-3 py-3 text-slate-300">{run.adName}</td>
        <td className="px-3 py-3 text-slate-500">
          {new Date(run.createdAt).toLocaleString()}
        </td>
        <td className="px-3 py-3 text-slate-400">{variationCount}</td>
        <td className="px-3 py-3 text-slate-400">{approvalSummary}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-slate-950/60 p-4">
            <RunDetail run={run} />
          </td>
        </tr>
      )}
    </>
  );
}

function RunDetail({ run }: { run: Run }) {
  return (
    <div className="space-y-4 text-sm">
      {run.promptSnapshot && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Prompt snapshot</p>
          <p className="text-xs text-slate-400">
            {run.promptSnapshot.templateType} v{run.promptSnapshot.templateVersion}
          </p>
          <pre className="mt-2 max-h-32 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300 whitespace-pre-wrap">
            {run.promptSnapshot.renderedPrompt.slice(0, 500)}
            {run.promptSnapshot.renderedPrompt.length > 500 ? "…" : ""}
          </pre>
        </div>
      )}
      {run.providerRequest && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Provider request</p>
          <pre className="max-h-24 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300">
            {run.providerRequest.requestPayloadJson.slice(0, 400)}
            {run.providerRequest.requestPayloadJson.length > 400 ? "…" : ""}
          </pre>
        </div>
      )}
      {run.providerResponse && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Provider response</p>
          <p className="text-xs text-slate-400">
            Status: {run.providerResponse.executionStatus}
            {run.providerResponse.errorMessage && ` — ${run.providerResponse.errorMessage}`}
          </p>
          <pre className="mt-2 max-h-24 overflow-auto rounded border border-slate-800 bg-slate-900/80 p-2 font-mono text-xs text-slate-300">
            {run.providerResponse.responsePayloadJson.slice(0, 400)}
            {run.providerResponse.responsePayloadJson.length > 400 ? "…" : ""}
          </pre>
        </div>
      )}
      {(run.copyVariations.length > 0 || run.imageVariations.length > 0) && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Generated variations</p>
          <div className="grid gap-3 md:grid-cols-3">
            {run.copyVariations.map((v) => (
              <div key={v.id} className="rounded-lg border border-violet-800/40 bg-violet-950/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-violet-400">{v.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    v.approvalStatus === "approved" ? "bg-emerald-900/60 text-emerald-300" :
                    v.approvalStatus === "rejected" ? "bg-rose-900/60 text-rose-300" :
                    "bg-slate-700 text-slate-400"
                  }`}>
                    {v.approvalStatus}
                  </span>
                </div>
                <p className="text-xs font-medium text-violet-300">CTA: {v.callToAction}</p>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{v.hook}</p>
              </div>
            ))}
            {run.imageVariations.map((v) => (
              <div key={v.id} className="rounded-lg border border-blue-800/40 bg-blue-950/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-400">{v.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    v.approvalStatus === "approved" ? "bg-emerald-900/60 text-emerald-300" :
                    v.approvalStatus === "rejected" ? "bg-rose-900/60 text-rose-300" :
                    "bg-slate-700 text-slate-400"
                  }`}>
                    {v.approvalStatus}
                  </span>
                </div>
                <p className="text-xs font-medium text-blue-300">Goal: {v.goal}</p>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{v.conceptSummary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {run.approvalDecisions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Approval decisions</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {run.approvalDecisions.map((d, i) => (
              <li key={i}>
                {d.variationType} {d.variationId.slice(0, 8)}… → {d.decision} ({new Date(d.decidedAt).toLocaleString()})
              </li>
            ))}
          </ul>
        </div>
      )}
      {run.selectedVariants.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">Selected variant(s)</p>
          <ul className="space-y-1 text-xs text-amber-300">
            {run.selectedVariants.map((s) => (
              <li key={s.variationType}>
                {s.variationType}: {s.variationId.slice(0, 8)}…
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
