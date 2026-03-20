"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConversationThread } from "./sections/ConversationThread";
import { SuggestedPrompts }   from "./sections/SuggestedPrompts";
import { STARTER_SUGGESTIONS } from "../../lib/optimizationAssistant/suggestions";
import type {
  OptimizationAssistantMessage,
  OptimizationAssistantResponse,
} from "../../lib/optimizationAssistant/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  clientId,
  dateFrom,
  dateTo,
  onApply,
}: {
  clientId?: string;
  dateFrom: string;
  dateTo: string;
  onApply: (f: { clientId?: string; dateFrom: string; dateTo: string }) => void;
}) {
  const [cid, setCid]  = useState(clientId ?? "");
  const [from, setFrom]= useState(dateFrom);
  const [to, setTo]    = useState(dateTo);

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide shrink-0">Context:</span>
      <input
        value={cid}
        onChange={(e) => setCid(e.target.value)}
        placeholder="Client ID (optional)"
        className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200
                   placeholder-slate-500 focus:outline-none focus:border-emerald-600 w-36"
      />
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200
                   focus:outline-none focus:border-emerald-600"
      />
      <span className="text-slate-600 text-xs">→</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200
                   focus:outline-none focus:border-emerald-600"
      />
      <button
        onClick={() => onApply({ clientId: cid || undefined, dateFrom: from, dateTo: to })}
        className="px-3 py-1 text-xs bg-emerald-800 hover:bg-emerald-700 text-white rounded transition-colors"
      >
        Apply
      </button>
    </div>
  );
}

// ── Input form ────────────────────────────────────────────────────────────────

function InputForm({
  onSubmit,
  loading,
}: {
  onSubmit: (q: string) => void;
  loading: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

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
    <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/90 backdrop-blur">
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your campaigns, pacing, experiments, approvals…"
        disabled={loading}
        rows={2}
        className="flex-1 resize-none px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl
                   text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-600
                   disabled:opacity-50 leading-relaxed"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed
                   text-white text-sm font-medium rounded-xl transition-colors shrink-0"
      >
        {loading ? "…" : "Ask"}
      </button>
    </form>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4 space-y-6">
      <div className="space-y-1">
        <div className="text-3xl text-emerald-700">◈</div>
        <h2 className="text-lg font-semibold text-slate-200">AI Optimization Assistant</h2>
        <p className="text-sm text-slate-400 max-w-xs">
          Ask operational questions about your campaigns, experiments, creative, pacing, and approvals.
          Responses are grounded in your live dashboard data.
        </p>
      </div>
      <SuggestedPrompts
        suggestions={STARTER_SUGGESTIONS}
        onSelect={onSelect}
        label="Start with a question"
      />
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface AssistantViewProps {
  clientId?: string;
  dateFrom: string;
  dateTo: string;
}

export function AssistantView({ clientId, dateFrom, dateTo }: AssistantViewProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<OptimizationAssistantMessage[]>([]);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState<{ clientId: string | undefined; dateFrom: string; dateTo: string }>({ clientId, dateFrom, dateTo });
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleApplyFilter = useCallback(
    (f: { clientId?: string; dateFrom: string; dateTo: string }) => {
      setFilter({ clientId: f.clientId, dateFrom: f.dateFrom, dateTo: f.dateTo });
      const params = new URLSearchParams();
      if (f.clientId) params.set("clientId", f.clientId);
      params.set("from", f.dateFrom);
      params.set("to", f.dateTo);
      router.replace(`/assistant?${params.toString()}`);
    },
    [router]
  );

  const handleAsk = useCallback(
    async (question: string) => {
      if (loading) return;

      // Add user message
      const userMsg: OptimizationAssistantMessage = {
        id: makeId(), role: "user", content: question, createdAt: new Date().toISOString(),
      };
      // Add loading placeholder
      const loadingMsg: OptimizationAssistantMessage = {
        id: makeId(), role: "assistant", content: "__loading__", createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/assistant", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            question,
            clientId:  filter.clientId,
            dateFrom:  filter.dateFrom,
            dateTo:    filter.dateTo,
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as OptimizationAssistantResponse;

        const assistantMsg: OptimizationAssistantMessage = {
          id:       makeId(),
          role:     "assistant",
          content:  data.summary,
          intent:   data.intent,
          response: data,
          createdAt: new Date().toISOString(),
        };

        // Replace loading placeholder with real response
        setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);
      } catch {
        const errorMsg: OptimizationAssistantMessage = {
          id:      makeId(),
          role:    "assistant",
          content: "Sorry, I couldn't generate a response. Please check your connection and try again.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev.slice(0, -1), errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, filter]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-950">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold text-slate-100">AI Assistant</h1>
        <p className="text-sm text-slate-500 mt-0.5">Operational Q&amp;A grounded in your live dashboard data</p>
      </div>

      {/* Filter bar */}
      <FilterBar
        clientId={filter.clientId}
        dateFrom={filter.dateFrom}
        dateTo={filter.dateTo}
        onApply={handleApplyFilter}
      />

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {isEmpty ? (
            <EmptyState onSelect={handleAsk} />
          ) : (
            <ConversationThread messages={messages} onFollowUp={handleAsk} />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 max-w-3xl mx-auto w-full">
        {!isEmpty && !loading && messages.length > 0 && (
          <div className="px-4 pb-2">
            <SuggestedPrompts
              suggestions={STARTER_SUGGESTIONS.slice(0, 4)}
              onSelect={handleAsk}
              label="Ask another question"
            />
          </div>
        )}
        <InputForm onSubmit={handleAsk} loading={loading} />
      </div>
    </div>
  );
}
