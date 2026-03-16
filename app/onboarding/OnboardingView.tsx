"use client";

// app/onboarding/OnboardingView.tsx
// First-login guided setup. Step 1: create a client.
// Steps 2 (Meta) and 3 (Shopify) are shown as "coming soon" placeholders.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFirstClientAction } from "./actions";

type Props = {
  workspaceName: string;
};

// ── Step progress UI ──────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Create client",    active: true  },
  { n: 2, label: "Connect Meta",     active: false },
  { n: 3, label: "Connect Shopify",  active: false },
];

function StepBadge({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
          ${done    ? "bg-emerald-700 text-emerald-100" :
            active  ? "bg-emerald-600 text-white"        :
                      "bg-slate-800 text-slate-500"}`}
      >
        {done ? "✓" : n}
      </span>
      <span
        className={`text-sm font-medium ${
          active ? "text-slate-200" : "text-slate-600"
        }`}
      >
        {label}
      </span>
      {!active && !done && (
        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-600">
          Soon
        </span>
      )}
    </div>
  );
}

// ── Input helper ─────────────────────────────────────────────────────────────

function Field({
  id,
  label,
  optional,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  id:           string;
  label:        string;
  optional?:    boolean;
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  multiline?:   boolean;
}) {
  const cls =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm " +
    "text-slate-100 placeholder-slate-600 transition-colors " +
    "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {label}
        {optional && (
          <span className="font-normal text-slate-600">(optional)</span>
        )}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OnboardingView({ workspaceName }: Props) {
  const router = useRouter();

  const [name,      setName]      = useState("");
  const [brandName, setBrandName] = useState("");
  const [notes,     setNotes]     = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Client name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const { clientId } = await createFirstClientAction({
          name:      trimmed,
          brandName: brandName.trim(),
          notes:     notes.trim(),
        });
        router.push(`/clients/${clientId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {/* Welcome header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
            MB
          </div>
          <span className="text-xs text-slate-500">{workspaceName}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Welcome — let&apos;s get you set up
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Start by creating your first client. You can connect Meta and Shopify
          afterwards.
        </p>
      </div>

      {/* Step progress */}
      <div className="mb-8 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        {STEPS.map((s) => (
          <StepBadge key={s.n} n={s.n} label={s.label} active={s.active} done={false} />
        ))}
      </div>

      {/* Step 1 form */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-200">
          Step 1 — Create your first client
        </h2>
        <p className="mb-5 text-xs text-slate-500">
          A client represents one brand or advertiser. You&apos;ll connect their Meta
          account and Shopify store to it.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="name"
            label="Client Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Acme Brand"
          />
          <Field
            id="brandName"
            label="Brand Name"
            optional
            value={brandName}
            onChange={setBrandName}
            placeholder="e.g. Acme"
          />
          <Field
            id="notes"
            label="Notes"
            optional
            value={notes}
            onChange={setNotes}
            placeholder="Internal notes about this client…"
            multiline
          />

          {error && (
            <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold
              text-white transition-colors hover:bg-emerald-500
              disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Creating client…" : "Create client →"}
          </button>
        </form>
      </div>
    </div>
  );
}
