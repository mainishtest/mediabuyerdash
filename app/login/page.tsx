// app/login/page.tsx
// Login page — renders as a fixed full-screen overlay so the AppShell
// sidebar is invisible behind it. This avoids restructuring the route layout.

import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign In — Media Buying Dashboard",
};

export default function LoginPage() {
  return (
    // Fixed overlay covers the AppShell completely.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            MB
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Media Buying OS
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Sign in to your workspace
            </p>
          </div>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-slate-600">
          No account yet? Enter your email and password to get started.
          Your workspace will be created automatically.
        </p>
      </div>
    </div>
  );
}
