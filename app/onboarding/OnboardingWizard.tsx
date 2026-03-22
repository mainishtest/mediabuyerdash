"use client";

// app/onboarding/OnboardingWizard.tsx
// Multi-step onboarding wizard (7 steps). Resumable — state persists server-side.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceStep } from "./steps/WorkspaceStep";
import { BusinessStep } from "./steps/BusinessStep";
import { AccountDefaultsStep } from "./steps/AccountDefaultsStep";
import { ConnectMetaStep } from "./steps/ConnectMetaStep";
import { ConnectShopifyStep } from "./steps/ConnectShopifyStep";
import { ReviewStep } from "./steps/ReviewStep";
import {
  saveWorkspaceDetailsAction,
  saveBusinessProfileAction,
  saveAccountDefaultsAction,
  markConnectMetaDoneAction,
  markConnectShopifyDoneAction,
  completeOnboardingAction,
  saveDraftAction,
} from "./actions";

import type {
  OnboardingProgress,
  WorkspaceAccount,
  IntegrationSetupState,
  AccountSetupChecklist,
  OnboardingBlocker,
  AccountDefaults,
} from "../../lib/onboarding-types";
import type { MetaSetupChecklistItem } from "../../lib/meta/types";
import type { ShopifySetupChecklistItem } from "../../lib/shopify/types";
import { VISIBLE_ONBOARDING_STEPS, type OnboardingStepId } from "../../lib/onboarding-types";

type Props = {
  progress: OnboardingProgress;
  workspace: WorkspaceAccount;
  integrations: IntegrationSetupState;
  checklist: AccountSetupChecklist;
  blockers: OnboardingBlocker[];
  accountDefaults: AccountDefaults;
  metaChecklist: MetaSetupChecklistItem[];
  metaConfigured: boolean;
  shopifyChecklist: ShopifySetupChecklistItem[];
};

export function OnboardingWizard({
  progress,
  workspace,
  integrations,
  checklist,
  blockers,
  accountDefaults,
  metaChecklist,
  metaConfigured,
  shopifyChecklist,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<OnboardingStepId>(
    progress.completedAt ? "review_setup" : progress.currentStep
  );
  const [error, setError] = useState<string | null>(null);

  const stepIndex = VISIBLE_ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

  function isStepDone(stepId: OnboardingStepId): boolean {
    switch (stepId) {
      case "create_workspace":            return progress.createWorkspaceDone;
      case "business_details":            return progress.businessDetailsDone;
      case "account_defaults":            return progress.accountDefaultsDone;
      case "connect_meta_placeholder":    return progress.connectMetaPlaceholderDone;
      case "connect_shopify_placeholder": return progress.connectShopifyPlaceholderDone;
      case "review_setup":                return progress.reviewSetupDone;
      case "onboarding_complete":         return !!progress.completedAt;
    }
  }

  function goTo(step: OnboardingStepId) {
    setError(null);
    setCurrentStep(step);
  }

  // Save partial form data for later resume
  function saveDraft(formData: Record<string, string>) {
    startTransition(async () => {
      try {
        await saveDraftAction(formData);
      } catch {
        // Silent — draft save is best-effort
      }
    });
  }

  // ── Step handlers ──────────────────────────────────────────────────────────

  async function handleWorkspaceSave(data: { name: string; timezone: string }) {
    startTransition(async () => {
      try {
        await saveWorkspaceDetailsAction(data);
        setCurrentStep("business_details");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save workspace details.");
      }
    });
  }

  async function handleBusinessSave(data: {
    brandName: string;
    industry: string;
    website: string;
    monthlyAdSpend: string;
  }) {
    startTransition(async () => {
      try {
        await saveBusinessProfileAction(data);
        setCurrentStep("account_defaults");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save business details.");
      }
    });
  }

  async function handleAccountDefaultsSave(data: AccountDefaults) {
    startTransition(async () => {
      try {
        await saveAccountDefaultsAction(data);
        setCurrentStep("connect_meta_placeholder");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save account defaults.");
      }
    });
  }

  async function handleConnectMetaContinue() {
    startTransition(async () => {
      try {
        await markConnectMetaDoneAction();
        setCurrentStep("connect_shopify_placeholder");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save progress.");
      }
    });
  }

  async function handleConnectShopifyContinue() {
    startTransition(async () => {
      try {
        await markConnectShopifyDoneAction();
        setCurrentStep("review_setup");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save progress.");
      }
    });
  }

  async function handleComplete() {
    startTransition(async () => {
      try {
        await completeOnboardingAction();
        router.push("/readiness");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to complete onboarding.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
              MB
            </div>
            <span className="text-sm font-semibold text-white">MediaBuyerDash</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Set up your account
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Complete these steps to get your workspace ready. You can save and come back anytime.
          </p>
        </div>

        {/* Blockers */}
        {blockers.length > 0 && (
          <div className="mb-6 space-y-2">
            {blockers.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3"
              >
                <p className="text-sm text-amber-300">{b.message}</p>
                {b.actionLabel && b.actionHref && (
                  <a
                    href={b.actionHref}
                    className="mt-1 inline-block text-xs font-medium text-amber-400 underline hover:text-amber-300"
                  >
                    {b.actionLabel}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-8">
          {/* Desktop step indicators */}
          <div className="hidden sm:flex sm:items-center sm:gap-0.5">
            {VISIBLE_ONBOARDING_STEPS.map((step, i) => {
              const done = isStepDone(step.id);
              const active = step.id === currentStep;
              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <button
                    onClick={() => (done || active) && goTo(step.id)}
                    disabled={!done && !active}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-left transition-colors ${
                      active
                        ? "bg-emerald-950/40 ring-1 ring-emerald-800/40"
                        : done
                        ? "cursor-pointer hover:bg-slate-800/60"
                        : "cursor-default opacity-50"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        done
                          ? "bg-emerald-700 text-emerald-100"
                          : active
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={`text-[11px] font-medium leading-tight ${
                      active ? "text-white" : done ? "text-slate-300" : "text-slate-500"
                    }`}>
                      {step.label}
                    </span>
                  </button>
                  {i < VISIBLE_ONBOARDING_STEPS.length - 1 && (
                    <div className={`mx-0.5 h-px flex-1 ${done ? "bg-emerald-800/40" : "bg-slate-800"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile progress */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Step {stepIndex + 1} of {VISIBLE_ONBOARDING_STEPS.length}</span>
              <span>{VISIBLE_ONBOARDING_STEPS[stepIndex]?.label}</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${((stepIndex + 1) / VISIBLE_ONBOARDING_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Step content */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
          {currentStep === "create_workspace" && (
            <WorkspaceStep
              workspace={workspace}
              onSave={handleWorkspaceSave}
              isPending={isPending}
            />
          )}

          {currentStep === "business_details" && (
            <BusinessStep
              workspace={workspace}
              onSave={handleBusinessSave}
              onBack={() => goTo("create_workspace")}
              isPending={isPending}
            />
          )}

          {currentStep === "account_defaults" && (
            <AccountDefaultsStep
              defaults={accountDefaults}
              onSave={handleAccountDefaultsSave}
              onBack={() => goTo("business_details")}
              isPending={isPending}
            />
          )}

          {currentStep === "connect_meta_placeholder" && (
            <ConnectMetaStep
              integrations={integrations}
              metaChecklist={metaChecklist}
              metaConfigured={metaConfigured}
              onContinue={handleConnectMetaContinue}
              onBack={() => goTo("account_defaults")}
              isPending={isPending}
            />
          )}

          {currentStep === "connect_shopify_placeholder" && (
            <ConnectShopifyStep
              integrations={integrations}
              shopifyChecklist={shopifyChecklist}
              onContinue={handleConnectShopifyContinue}
              onBack={() => goTo("connect_meta_placeholder")}
              isPending={isPending}
            />
          )}

          {currentStep === "review_setup" && (
            <ReviewStep
              workspace={workspace}
              integrations={integrations}
              checklist={checklist}
              onComplete={handleComplete}
              onBack={() => goTo("connect_shopify_placeholder")}
              isPending={isPending}
            />
          )}
        </div>

        {/* Save and continue later */}
        <div className="mt-6 text-center">
          <a
            href="/home"
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            Save and continue later
          </a>
        </div>
      </div>
    </div>
  );
}
