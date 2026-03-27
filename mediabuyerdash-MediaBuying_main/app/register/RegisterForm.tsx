"use client";

// app/register/RegisterForm.tsx
// Registration form. Collects name (optional), email, password, confirm password.
// On success: calls registerUser server action, then signIn() to issue a session,
// then redirects to /dashboard.

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerUser } from "./actions";

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error,           setError]           = useState<string | null>(null);
  const [signingIn,       setSigningIn]       = useState(false);

  const loading = isPending || signingIn;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side pre-checks.
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await registerUser(email.trim(), password, name.trim() || undefined);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Account created — now issue a session.
      setSigningIn(true);
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      setSigningIn(false);

      if (res?.error) {
        // Rare: account was created but sign-in failed (e.g. server restart).
        setError("Account created! Please sign in to continue.");
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm " +
    "text-slate-100 placeholder-slate-600 transition-colors " +
    "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

  const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name (optional) */}
      <div>
        <label htmlFor="name" className={labelClass}>
          Full name <span className="text-slate-600">(optional)</span>
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          disabled={loading}
          className={inputClass}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className={labelClass}>
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
          disabled={loading}
          className={inputClass}
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          disabled={loading}
          className={inputClass}
        />
      </div>

      {/* Confirm password */}
      <div>
        <label htmlFor="confirm-password" className={labelClass}>
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
          className={inputClass}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold
          text-white transition-colors hover:bg-emerald-500
          disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending
          ? "Creating account…"
          : signingIn
          ? "Signing in…"
          : "Create account"}
      </button>
    </form>
  );
}
