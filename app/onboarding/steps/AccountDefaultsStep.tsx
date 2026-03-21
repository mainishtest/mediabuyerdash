"use client";

import { useState } from "react";
import type { AccountDefaults } from "../../../lib/onboarding-types";

const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
];

const REPORTING_WINDOWS = [
  { value: "7d",  label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
];

type Props = {
  defaults: AccountDefaults;
  onSave: (data: AccountDefaults) => Promise<void>;
  onBack: () => void;
  isPending: boolean;
};

export function AccountDefaultsStep({ defaults, onSave, onBack, isPending }: Props) {
  const [currency, setCurrency]           = useState(defaults.defaultCurrency);
  const [timezone, setTimezone]           = useState(defaults.defaultTimezone);
  const [reportingWindow, setReportingWindow] = useState(defaults.reportingWindow);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      defaultCurrency: currency,
      defaultTimezone: timezone,
      reportingWindow,
    });
  }

  const selectClass =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 " +
    "transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Account defaults
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Set your workspace defaults for currency and reporting. These apply to
        new clients and can be overridden per-client later.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="currency" className="mb-1.5 block text-xs font-medium text-slate-400">
            Default currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isPending}
            className={selectClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="reporting" className="mb-1.5 block text-xs font-medium text-slate-400">
            Default reporting window
          </label>
          <select
            id="reporting"
            value={reportingWindow}
            onChange={(e) => setReportingWindow(e.target.value)}
            disabled={isPending}
            className={selectClass}
          >
            {REPORTING_WINDOWS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
          <p className="text-xs text-slate-500">
            Your timezone was set to <span className="font-medium text-slate-300">{timezone.replace(/_/g, " ")}</span> in
            the previous step. You can change it from workspace settings later.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isPending}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
