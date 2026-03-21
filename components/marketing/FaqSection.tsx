"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Who is MediaBuyerDash for?",
    a: "Experienced media buyers, agencies, and operators running paid acquisition across Meta (Facebook/Instagram) and other channels. If you manage $50K+ in monthly ad spend and need real performance visibility — this is built for you.",
  },
  {
    q: "What integrations are supported?",
    a: "Currently we support Meta Ads (Facebook & Instagram) and Shopify for CRM-based revenue reconciliation. Google Ads, TikTok, and additional CRM integrations are on the roadmap.",
  },
  {
    q: "How does the 14-day trial work?",
    a: "You pay $1 today and get full access to the entire platform for 14 days. Connect your accounts, explore every feature, and see real results. If you don\u2019t love it, cancel before day 14 and you\u2019re never charged again.",
  },
  {
    q: "What happens after the 14-day trial?",
    a: "After 14 days, your subscription automatically continues at $495/month. You can cancel anytime with one click — no contracts, no cancellation fees, no hassle.",
  },
  {
    q: "Can I connect my own ad accounts?",
    a: "Yes. During onboarding, you\u2019ll connect your Meta Business Manager and select which ad accounts to sync. Your data stays private and is never shared with other users.",
  },
  {
    q: "Can I connect Shopify for revenue data?",
    a: "Yes. Shopify integration lets us reconcile your ad platform\u2019s reported revenue against actual orders and revenue in your store — giving you true ROAS and CPA numbers.",
  },
  {
    q: "Do I need a CRM to use MediaBuyerDash?",
    a: "No. Shopify integration covers most e-commerce use cases. If you have a custom CRM or use HubSpot, those integrations are coming soon. The platform works with Meta data alone — CRM integration just makes the numbers more accurate.",
  },
  {
    q: "Can agencies use this for multiple clients?",
    a: "Absolutely. MediaBuyerDash is built for multi-client management. Each client gets their own workspace with separate ad accounts, budgets, governance rules, and performance tracking. Your daily summary shows all clients in one view.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-800/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-sm font-medium text-white sm:text-base">{q}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="pb-5 pr-8 text-sm leading-relaxed text-slate-400">
          {a}
        </div>
      )}
    </div>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-400 sm:text-lg">
            Everything you need to know before getting started.
          </p>
        </div>

        <div className="mt-12">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
