"use client";

import { useState, useTransition } from "react";
import { PageHeader }   from "../../components/ui/PageHeader";
import { SectionCard }  from "../../components/ui/SectionCard";
import { ActionButton } from "../../components/ui/ActionButton";
import { changePasswordAction } from "./actions";

interface Props {
  userId:        string;
  name:          string | null;
  email:         string;
  workspaceName: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm " +
  "text-slate-100 placeholder-slate-600 transition-colors " +
  "focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const readonlyClass =
  "w-full rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-sm text-slate-400 cursor-default";

export function ProfileView({ userId, name, email, workspaceName }: Props) {
  const [current,    setCurrent]    = useState("");
  const [newPass,    setNewPass]    = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [message,    setMessage]    = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPass !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction(userId, current, newPass);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Password updated successfully.");
      setCurrent("");
      setNewPass("");
      setConfirm("");
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Profile"
        description="Manage your account information and security settings."
      />

      {/* Account info */}
      <SectionCard title="Account" description="Your identity in the workspace.">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">Name</p>
            <div className={readonlyClass}>{name || "—"}</div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">Email address</p>
            <div className={readonlyClass}>{email}</div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">Workspace</p>
            <div className={readonlyClass}>{workspaceName}</div>
          </div>
        </div>
      </SectionCard>

      {/* Change password */}
      <SectionCard
        title="Change Password"
        description="Use a strong password you don't use anywhere else."
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="current" className="mb-1.5 block text-xs font-medium text-slate-400">
              Current password
            </label>
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
              disabled={isPending}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="newPass" className="mb-1.5 block text-xs font-medium text-slate-400">
              New password
            </label>
            <input
              id="newPass"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
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
              placeholder="Repeat new password"
              disabled={isPending}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-2.5 text-sm text-emerald-300">
              {message}
            </div>
          )}

          <ActionButton type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Update password"}
          </ActionButton>
        </form>
      </SectionCard>
    </div>
  );
}
