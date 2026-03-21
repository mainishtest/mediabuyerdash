import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════════════
   Section 2: What It Does
   ═══════════════════════════════════════════════════════════════════════════ */

export function WhatItDoesSection() {
  return (
    <section className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Not another dashboard.{" "}
            <span className="text-emerald-400">A decision engine.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            Most media buying tools show you data. MediaBuyerDash shows you
            what to do about it. Every morning, you open a single view that
            tells you exactly which accounts need attention, which creatives
            are fatiguing, what to test next, and where to scale — based on
            real CRM revenue, not platform-reported vanity metrics.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: "◈",
              title: "Decision-First UX",
              body: "Every screen starts with what to do, not what happened. Decisions surface automatically from your real performance data.",
            },
            {
              icon: "◎",
              title: "CRM Source of Truth",
              body: "ROAS and CPA calculated from your actual CRM revenue — Shopify, HubSpot, or your custom pipeline. Not Facebook\u2019s guesswork.",
            },
            {
              icon: "⟳",
              title: "Closed-Loop Learning",
              body: "Every test, scale, and pause feeds back into the system. Your playbook gets smarter every week, automatically.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-950/60 text-lg text-emerald-400">
                {card.icon}
              </div>
              <h3 className="text-base font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 3: Yesterday → Today workflow
   ═══════════════════════════════════════════════════════════════════════════ */

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "See yesterday clearly",
    body: "Your daily executive summary shows spend, CRM-based ROAS, CPA, and trend direction for every client and ad account. Issues are flagged automatically.",
    color: "text-emerald-400",
    border: "border-emerald-800/40",
    bg: "bg-emerald-950/30",
  },
  {
    step: "02",
    title: "Drill into issues",
    body: "Click any flagged metric to see exactly what\u2019s happening: which campaigns degraded, which creatives fatigued, which audiences saturated. No digging through ad managers.",
    color: "text-sky-400",
    border: "border-sky-800/40",
    bg: "bg-sky-950/30",
  },
  {
    step: "03",
    title: "Launch tests from real problems",
    body: "When performance drops, the system suggests tests rooted in the actual diagnosis — new angles for fatigued creatives, fresh audiences for saturated segments, budget shifts for underperformers.",
    color: "text-violet-400",
    border: "border-violet-800/40",
    bg: "bg-violet-950/30",
  },
  {
    step: "04",
    title: "Scale what\u2019s working",
    body: "When campaigns are strong, structured scale workflows help you increase budgets with guardrails — governance approvals, pacing limits, and rollback triggers built in.",
    color: "text-amber-400",
    border: "border-amber-800/40",
    bg: "bg-amber-950/30",
  },
];

export function WorkflowSection() {
  return (
    <section className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Yesterday&apos;s performance.{" "}
            <span className="text-emerald-400">Today&apos;s actions.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            Every morning, your dashboard transforms raw performance into
            prioritized decisions. Here&apos;s the workflow that replaces your
            spreadsheets, Slack threads, and ad manager tab-switching.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {WORKFLOW_STEPS.map((s) => (
            <div
              key={s.step}
              className={`rounded-xl border ${s.border} ${s.bg} p-6`}
            >
              <div className={`text-xs font-bold uppercase tracking-widest ${s.color}`}>
                Step {s.step}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 4: Why it\u2019s different
   ═══════════════════════════════════════════════════════════════════════════ */

const DIFFERENTIATORS = [
  {
    title: "CRM-based ROAS & CPA",
    body: "Your real revenue from Shopify or your CRM — not the inflated numbers Meta reports. Know your actual cost per acquisition and return on ad spend.",
  },
  {
    title: "Decision-first, not data-first",
    body: "Other tools dump data on you. We surface the 3\u20135 decisions you need to make today, with the context to make them confidently.",
  },
  {
    title: "Structured scaling workflows",
    body: "Move from \u201cbudget +20%\u201d guesswork to governed, step-by-step scale playbooks with pacing limits and rollback triggers.",
  },
  {
    title: "Creative fatigue detection",
    body: "Know exactly when an ad is losing effectiveness — before it craters. Get replacement suggestions based on your historical creative performance.",
  },
  {
    title: "Creative Lab & experimentation",
    body: "Design, launch, and track creative experiments in a structured flow. Every test ties back to a real performance problem and feeds learnings into your playbook.",
  },
  {
    title: "Governance & approvals",
    body: "Agency-grade controls for budget changes, campaign launches, and scaling decisions. Set thresholds, require approvals, enforce guardrails across clients.",
  },
];

export function WhyDifferentSection() {
  return (
    <section id="features" className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Why operators choose{" "}
            <span className="text-emerald-400">MediaBuyerDash</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            Built by media buyers who were tired of stitching together ad
            managers, spreadsheets, and Slack. This is the platform we wanted
            but couldn&apos;t find.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DIFFERENTIATORS.map((d) => (
            <div
              key={d.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
            >
              <h3 className="text-base font-semibold text-white">{d.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{d.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 5: Core feature blocks
   ═══════════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: "📊",
    title: "Daily Executive Summary",
    body: "One screen to see every client, every account, every metric — with CRM-reconciled ROAS front and center.",
  },
  {
    icon: "🔍",
    title: "Issue Diagnosis",
    body: "Automatic detection of spend anomalies, CPA spikes, creative fatigue, and audience saturation with drill-down context.",
  },
  {
    icon: "🧪",
    title: "Experiment Creation",
    body: "Launch structured creative and audience tests tied to real performance problems — not hunches.",
  },
  {
    icon: "📈",
    title: "Scale Workflows",
    body: "Governed, step-by-step scaling playbooks with budget pacing, approval gates, and automatic rollback triggers.",
  },
  {
    icon: "🎨",
    title: "Creative Lab",
    body: "Full creative lifecycle management — from brief to launch to performance tracking to refresh queue.",
  },
  {
    icon: "👁️",
    title: "Portfolio Visibility",
    body: "Cross-client, cross-account portfolio view with governance controls and risk monitoring.",
  },
  {
    icon: "✅",
    title: "Approvals & Guardrails",
    body: "Set budget thresholds, require team approvals, enforce scaling limits, and maintain audit trails across every action.",
  },
];

export function CoreFeaturesSection() {
  return (
    <section className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything you need.{" "}
            <span className="text-emerald-400">Nothing you don&apos;t.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            Seven core pillars that replace your spreadsheets, ad manager
            tab-switching, and Slack-based decision making.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Section 6: How It Works
   ═══════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    num: "1",
    title: "Connect your accounts",
    body: "Link your Meta ad accounts, Shopify stores, or CRM. Data syncs automatically every day.",
  },
  {
    num: "2",
    title: "See yesterday clearly",
    body: "Your daily executive summary shows every client, every account, and every metric — reconciled against real revenue.",
  },
  {
    num: "3",
    title: "Take action quickly",
    body: "Drill into flagged issues, launch tests, adjust budgets, and approve changes — all from one place.",
  },
  {
    num: "4",
    title: "Scale with confidence",
    body: "Use structured scaling workflows with governance, pacing, and rollback triggers to grow spend safely.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Up and running in{" "}
            <span className="text-emerald-400">minutes</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            No implementation consultants. No six-week onboarding.
            Connect your accounts and start making better decisions today.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-800/40 bg-emerald-950/40 text-lg font-bold text-emerald-400">
                {s.num}
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="inline-flex rounded-lg bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500"
          >
            Get Started — $1 for 14 Days
          </Link>
        </div>
      </div>
    </section>
  );
}
