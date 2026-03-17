"use client";

import { useState, useTransition } from "react";
import { requestPasswordResetAction } from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm " +
  "text-slate-100 placeholder-slate-600 transition-colors " +
  "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

export function ForgotPasswordForm() {
  const [email,    setEmail]    = useState("");
  const [done,     setDone]     = useState(false);
  const [devUrl,   setDevUrl]   = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      if (result.devUrl) setDevUrl(result.devUrl);
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          If that email is registered you&apos;ll receive a reset link shortly.
        </div>

        {/* Dev fallback — shown only when SMTP is not configured */}
        {devUrl && (
          <div className="space-y-2 rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3">
            <p className="text-xs font-semibold text-amber-400">
              Dev mode — email not sent (SMTP not configured)
            </p>
            <p className="text-xs text-slate-400">Use this link to reset the password:</p>
            <a
              href={devUrl}
              className="block break-all text-xs text-emerald-400 hover:underline"
            >
              {devUrl}
            </a>
          </div>
        )}

        <a
          href="/login"
          className="block text-center text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          ← Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-400">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@youragency.com"
          disabled={isPending}
          className={inputClass}
        />
      </div>

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
        {isPending ? "Sending…" : "Send reset link"}
      </button>

      <a
        href="/login"
        className="block text-center text-xs text-slate-500 transition-colors hover:text-slate-300"
      >
        ← Back to sign in
      </a>
    </form>
  );
}
