// app/page.tsx — Public marketing landing page for mediabuyerdash.com
import { MarketingNav } from "../components/marketing/Nav";
import { MarketingFooter } from "../components/marketing/Footer";
import { HeroSection } from "../components/marketing/HeroSection";
import {
  WhatItDoesSection,
  WorkflowSection,
  WhyDifferentSection,
  CoreFeaturesSection,
  HowItWorksSection,
} from "../components/marketing/FeatureSections";
import { PricingSection } from "../components/marketing/PricingSection";
import { FaqSection } from "../components/marketing/FaqSection";
import { CtaSection } from "../components/marketing/CtaSection";

export const metadata = {
  title: "MediaBuyerDash — The Decision-First Media Buying Operating System",
  description:
    "Stop guessing. Start deciding. The operating system that turns yesterday's real CRM performance into today's scaling actions, creative tests, and portfolio decisions.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <MarketingNav />
      <main>
        <HeroSection />
        <WhatItDoesSection />
        <WorkflowSection />
        <WhyDifferentSection />
        <CoreFeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <CtaSection />
        <FaqSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
