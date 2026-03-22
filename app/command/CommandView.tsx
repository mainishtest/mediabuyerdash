"use client";

// CommandView — AI Command Center: natural-language operator surface.
// Combines status cards (dashboard-style) with conversational AI.
// Decision-first: status at top, ask questions, get grounded answers.

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import type {
  OptimizationAssistantResponse,
  OptimizationAssistantContextSummary,
} from "../../lib/optimizationAssistant/types";
import { STARTER_SUGGESTIONS } from "../../lib/optimizationAssistant/suggestions";
import { StatusCards }   from "./sections/StatusCards";
import { QuickActions }  from "./sections/QuickActions";
import { ResponsePanel } from "./sections/ResponsePanel";

// ── Types ───────────────────────────────────────────────────────────────────

type StatusData = {
  totalSpend: number;
  roas: number | null;
  openAlerts: number;
  pendingApprovals: number;
  scaleReady: number;
  winnersCount: number;
  losersCount: number;
  activeExperiments: number;
  blockedActions: number;
};

type ConversationEntry = {
  id: string;
  question: string;
  response: OptimizationAssistantResponse | null;
  loading: boolean;
  error: string | null;
  createdAt: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2, 10); }

// ── Input form ──────────────────────────────────────────────────────────────

function InputForm({ onSubmit, loading }: { onSubmit: (q: string) => void; loading: boolean }) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || loading) return;
    setText("");
    onSubmit(q);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const q = text.trim();
      if (!q || loading) return;
      setText("");
      onSubmit(q);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your accounts, campaigns, tests, creative, approvals…"
        disabled={loading}
        rows={2}
        className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2
                   text-sm text-slate-100 placeholder-slate-500 leading-relaxed
                   focus:border-emerald-600 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white
                   transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "…" : "Ask"}
      </button>
    </form>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export function CommandView({ statusData }: { statusData: StatusData }) {
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const handleAsk = useCallback(async (question: string) => {
    if (loading) return;

    const id = makeId();
    const entry: ConversationEntry = {
      id, question, response: null, loading: true, error: null,
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => [...prev, entry]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as OptimizationAssistantResponse;

      setEntries((prev) => prev.map((e) =>
        e.id === id ? { ...e, response: data, loading: false } : e
      ));
    } catch {
      setEntries((prev) => prev.map((e) =>
        e.id === id ? { ...e, error: "Failed to generate response. Please try again.", loading: false } : e
      ));
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const isEmpty = entries.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">AI Command Center</h1>
              <p className="text-xs text-slate-500">Natural-language operator console — grounded in live data</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/command-center" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                Dashboard
              </Link>
              <Link href="/briefs" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                Brief
              </Link>
              <Link href="/weekly" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                Weekly
              </Link>
              <Link href="/history" className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                History
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-4 sm:px-6">
        {/* Status cards */}
        <StatusCards data={statusData} />

        {/* Empty state: quick actions */}
        {isEmpty && (
          <div className="space-y-4 py-4 text-center">
            <div>
              <div className="text-2xl text-emerald-700">◈</div>
              <p className="mt-1 text-sm text-slate-400">
                Ask operational questions. Answers are grounded in your live dashboard data.
              </p>
            </div>
            <QuickActions suggestions={STARTER_SUGGESTIONS} onSelect={handleAsk} />
          </div>
        )}

        {/* Conversation entries */}
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-3">
            {/* User question */}
            <div className="flex justify-end">
              <div className="max-w-lg rounded-xl bg-emerald-900/30 border border-emerald-800/30 px-4 py-2.5">
                <p className="text-sm text-slate-200">{entry.question}</p>
              </div>
            </div>

            {/* Response or loading */}
            {entry.loading && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500" />
                <p className="mt-2 text-xs text-slate-500">Assembling context and generating response…</p>
              </div>
            )}

            {entry.error && (
              <div className="rounded-xl border border-rose-800/30 bg-rose-950/20 px-4 py-3">
                <p className="text-sm text-rose-400">{entry.error}</p>
              </div>
            )}

            {entry.response && (
              <ResponsePanel response={entry.response} onFollowUp={handleAsk} />
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Sticky input at bottom */}
      <div className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-5xl">
          {!isEmpty && !loading && (
            <div className="mb-2">
              <QuickActions suggestions={STARTER_SUGGESTIONS.slice(0, 5)} onSelect={handleAsk} compact />
            </div>
          )}
          <InputForm onSubmit={handleAsk} loading={loading} />
        </div>
      </div>
    </div>
  );
}
