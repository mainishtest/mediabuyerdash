"use client";

import { useState } from "react";
import type { WorkspaceProfile } from "../../../lib/onboarding-types";

const INDUSTRIES = [
  { value: "",              label: "Select industry…" },
  { value: "ecommerce",     label: "E-commerce / DTC" },
  { value: "lead_gen",      label: "Lead generation" },
  { value: "saas",          label: "SaaS" },
  { value: "agency",        label: "Agency" },
  { value: "info_products", label: "Info products / courses" },
  { value: "local",         label: "Local business" },
  { value: "other",         label: "Other" },
];

const SPEND_RANGES = [
  { value: "",            label: "Select range…" },
  { value: "under_10k",   label: "Under $10K/mo" },
  { value: "10k_50k",     label: "$10K – $50K/mo" },
  { value: "50k_200k",    label: "$50K – $200K/mo" },
  { value: "200k_500k",   label: "$200K – $500K/mo" },
  { value: "500k_plus",   label: "$500K+/mo" },
];

type Props = {
  workspace: WorkspaceProfile;
  onSave: (data: {
    brandName: string;
    industry: string;
    website: string;
    monthlyAdSpend: string;
  }) => Promise<void>;
  onBack: () => void;
  isPending: boolean;
};

export function BusinessStep({ workspace, onSave, onBack, isPending }: Props) {
  const [brandName, setBrandName]           = useState(workspace.brandName ?? "");
  const [industry, setIndustry]             = useState(workspace.industry ?? "");
  const [website, setWebsite]               = useState(workspace.website ?? "");
  const [monthlyAdSpend, setMonthlyAdSpend] = useState(workspace.monthlyAdSpend ?? "");
  const [error, setError]                   = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedBrand = brandName.trim();
    if (!trimmedBrand) {
      setError("Brand or company name is required.");
      return;
    }

    onSave({
      brandName: trimmedBrand,
      industry,
      website: website.trim(),
      monthlyAdSpend,
    });
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">
        Tell us about your business
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        This helps us configure your workspace defaults. Everything can be changed later.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="brand-name" className="mb-1.5 block text-xs font-medium text-slate-400">
            Brand or company name
          </label>
          <input
            id="brand-name"
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Acme Agency"
            disabled={isPending}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="industry" className="mb-1.5 block text-xs font-medium text-slate-400">
            Industry <span className="text-slate-600">(optional)</span>
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            disabled={isPending}
            className={inputClass}
          >
            {INDUSTRIES.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="website" className="mb-1.5 block text-xs font-medium text-slate-400">
            Website <span className="text-slate-600">(optional)</span>
          </label>
          <input
            id="website"
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="e.g. youragency.com"
            disabled={isPending}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="spend" className="mb-1.5 block text-xs font-medium text-slate-400">
            Monthly ad spend <span className="text-slate-600">(optional)</span>
          </label>
          <select
            id="spend"
            value={monthlyAdSpend}
            onChange={(e) => setMonthlyAdSpend(e.target.value)}
            disabled={isPending}
            className={inputClass}
          >
            {SPEND_RANGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="flex gap-3">
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
