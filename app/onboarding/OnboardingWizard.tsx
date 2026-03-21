"use client";

// app/onboarding/OnboardingWizard.tsx
// Multi-step onboarding wizard. Resumable — state persists server-side.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceStep } from "./steps/WorkspaceStep";
import { BusinessStep } from "./steps/BusinessStep";
import { IntegrationsStep } from "./steps/IntegrationsStep";
import { ReviewStep } from "./steps/ReviewStep";
import {
  saveWorkspaceDetailsAction,
  saveBusinessProfileAction,
  markIntegrationsDoneAction,
  completeOnboardingAction,
} from "./actions";

import type { OnboardingProgress, WorkspaceProfile, IntegrationStatus, SetupChecklist } from "../../lib/onboarding-types";
import { ONBOARDING_STEPS, type OnboardingStepId } from "../../lib/onboarding-types";

type Props = {
  progress: OnboardingProgress;
  workspace: WorkspaceProfile;
  integrations: IntegrationStatus;
  checklist: SetupChecklist;
};

export function OnboardingWizard({ progress, workspace, integrations, checklist }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<OnboardingStepId>(
    progress.completedAt ? "review" : progress.currentStep
  );
  const [error, setError] = useState<string | null>(null);

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

  function isStepDone(stepId: OnboardingStepId): boolean {
    switch (stepId) {
      case "workspace_details": return progress.workspaceDetailsDone;
      case "business_profile":  return progress.businessProfileDone;
      case "integrations":      return progress.integrationsDone;
      case "review":            return progress.reviewDone;
    }
  }

  function goTo(step: OnboardingStepId) {
    setError(null);
    setCurrentStep(step);
  }

  // ── Step handlers ──────────────────────────────────────────────────────────

  async function handleWorkspaceSave(data: { name: string; timezone: string }) {
    startTransition(async () => {
      try {
        await saveWorkspaceDetailsAction(data);
        setCurrentStep("business_profile");
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
        setCurrentStep("integrations");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save business details.");
      }
    });
  }

  async function handleIntegrationsContinue() {
    startTransition(async () => {
      try {
        await markIntegrationsDoneAction();
        setCurrentStep("review");
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
        router.push("/home");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to complete onboarding.");
      }
    });
  }

  return (
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
          Complete these steps to get your workspace ready. You can always come back and finish later.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        {/* Desktop step indicators */}
        <div className="hidden sm:flex sm:items-center sm:gap-1">
          {ONBOARDING_STEPS.map((step, i) => {
            const done = isStepDone(step.id);
            const active = step.id === currentStep;
            return (
              <div key={step.id} className="flex flex-1 items-center">
                <button
                  onClick={() => (done || active) && goTo(step.id)}
                  disabled={!done && !active}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    active
                      ? "bg-emerald-950/40 ring-1 ring-emerald-800/40"
                      : done
                      ? "cursor-pointer hover:bg-slate-800/60"
                      : "cursor-default opacity-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-emerald-700 text-emerald-100"
                        : active
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className={`text-xs font-medium ${active ? "text-white" : done ? "text-slate-300" : "text-slate-500"}`}>
                    {step.label}
                  </span>
                </button>
                {i < ONBOARDING_STEPS.length - 1 && (
                  <div className={`mx-1 h-px flex-1 ${done ? "bg-emerald-800/40" : "bg-slate-800"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile progress */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Step {stepIndex + 1} of {ONBOARDING_STEPS.length}</span>
            <span>{ONBOARDING_STEPS[stepIndex]?.label}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${((stepIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }}
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
        {currentStep === "workspace_details" && (
          <WorkspaceStep
            workspace={workspace}
            onSave={handleWorkspaceSave}
            isPending={isPending}
          />
        )}

        {currentStep === "business_profile" && (
          <BusinessStep
            workspace={workspace}
            onSave={handleBusinessSave}
            onBack={() => goTo("workspace_details")}
            isPending={isPending}
          />
        )}

        {currentStep === "integrations" && (
          <IntegrationsStep
            integrations={integrations}
            onContinue={handleIntegrationsContinue}
            onBack={() => goTo("business_profile")}
            isPending={isPending}
          />
        )}

        {currentStep === "review" && (
          <ReviewStep
            workspace={workspace}
            integrations={integrations}
            checklist={checklist}
            onComplete={handleComplete}
            onBack={() => goTo("integrations")}
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
  );
}
