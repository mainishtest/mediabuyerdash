// app/signup/page.tsx
// Trial signup page — branded for the 14-day $1 trial.
// Uses the same registration logic but with trial-specific messaging.

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "Start Your 14-Day Trial — MediaBuyerDash",
  description: "Start your 14-day $1 trial of MediaBuyerDash. Full access to the decision-first media buying operating system.",
};

export default async function SignupPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/onboarding");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            MB
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Start your 14-day trial
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Full access for $1. Then $495/mo. Cancel anytime.
            </p>
          </div>
        </div>

        {/* Trial badge */}
        <div className="mb-6 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-center">
          <div className="text-sm font-medium text-emerald-300">
            14 days — $1
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            No commitment. Cancel in one click.
          </div>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-emerald-500 transition-colors hover:text-emerald-400"
          >
            Sign in
          </a>
        </p>

        <p className="mt-4 text-center text-xs text-slate-600">
          By creating an account, you agree to our{" "}
          <a href="/terms" className="text-slate-500 underline hover:text-slate-400">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="text-slate-500 underline hover:text-slate-400">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
