"use client";

import { useState } from "react";
import type { WorkspaceProfile } from "../../../lib/onboarding-types";

const TIMEZONES = [
  { value: "America/New_York",    label: "Eastern (ET)" },
  { value: "America/Chicago",     label: "Central (CT)" },
  { value: "America/Denver",      label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage",   label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu",    label: "Hawaii (HST)" },
  { value: "Europe/London",       label: "London (GMT/BST)" },
  { value: "Europe/Berlin",       label: "Central Europe (CET)" },
  { value: "Australia/Sydney",    label: "Sydney (AEST)" },
  { value: "Asia/Tokyo",          label: "Tokyo (JST)" },
];

type Props = {
  workspace: WorkspaceProfile;
  onSave: (data: { name: string; timezone: string }) => Promise<void>;
  isPending: boolean;
};

export function WorkspaceStep({ workspace, onSave, isPending }: Props) {
  const [name, setName]     = useState(workspace.name);
  const [tz, setTz]         = useState(workspace.timezone);
  const [error, setError]   = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name is required.");
      return;
    }
    onSave({ name: trimmed, timezone: tz });
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Set up your workspace
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Your workspace is where your team, clients, and campaigns live.
        You can change these later.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="ws-name" className="mb-1.5 block text-xs font-medium text-slate-400">
            Workspace name
          </label>
          <input
            id="ws-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Agency"
            disabled={isPending}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div>
          <label htmlFor="ws-tz" className="mb-1.5 block text-xs font-medium text-slate-400">
            Timezone
          </label>
          <select
            id="ws-tz"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            {TIMEZONES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
