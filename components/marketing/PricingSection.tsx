import Link from "next/link";

const INCLUDED = [
  "Daily executive summary & decision engine",
  "CRM-reconciled ROAS & CPA",
  "Creative Lab & experimentation",
  "Scale workflows with governance",
  "Issue diagnosis & drill-down",
  "Portfolio visibility across clients",
  "Approval workflows & guardrails",
  "Meta Ads & Shopify integrations",
  "Unlimited team members",
  "Priority support",
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            One plan. Full access. No per-seat fees. No hidden charges.
          </p>
        </div>

        {/* Pricing card */}
        <div className="relative mx-auto mt-14 max-w-md">
          {/* Glow */}
          <div className="absolute -inset-3 rounded-2xl bg-emerald-600/10 blur-xl" />

          <div className="relative overflow-hidden rounded-2xl border border-emerald-800/40 bg-slate-900">
            {/* Header */}
            <div className="border-b border-slate-800 bg-emerald-950/30 px-8 py-6 text-center">
              <div className="mb-2 inline-flex rounded-full border border-emerald-700/50 bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-300">
                Most popular
              </div>
              <div className="mt-3 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold tracking-tight text-white">$1</span>
                <span className="text-base text-slate-400">for 14 days</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Then <span className="font-semibold text-white">$495/month</span> · Cancel anytime
              </p>
            </div>

            {/* Features list */}
            <div className="px-8 py-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Everything included
              </p>
              <ul className="space-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <div className="px-8 pb-8">
              <Link
                href="/signup"
                className="block w-full rounded-lg bg-emerald-600 py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500"
              >
                Start 14-Day $1 Trial
              </Link>
              <p className="mt-3 text-center text-xs text-slate-500">
                No commitment. Cancel in one click. Full access from day one.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
