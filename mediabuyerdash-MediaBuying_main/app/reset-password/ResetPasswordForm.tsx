"use client";

import { useState, useTransition } from "react";
import { resetPasswordAction } from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm " +
  "text-slate-100 placeholder-slate-600 transition-colors " +
  "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

interface Props {
  token: string;
}

export function ResetPasswordForm({ token }: Props) {
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await resetPasswordAction(token, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          No reset token found. Please request a new reset link.
        </div>
        <a href="/forgot-password" className="block text-center text-xs text-emerald-500 hover:text-emerald-400">
          Request reset link →
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          Password updated successfully.
        </div>
        <a
          href="/login"
          className="block w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm
            font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          Sign in with new password
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-slate-400">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          disabled={isPending}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-slate-400">
          Confirm new password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
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
        {isPending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
