// app/forgot-password/page.tsx
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Forgot Password — Media Buying Dashboard" };

export default function ForgotPasswordPage() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            MB
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Forgot your password?
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}
