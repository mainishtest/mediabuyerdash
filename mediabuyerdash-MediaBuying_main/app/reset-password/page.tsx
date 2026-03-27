// app/reset-password/page.tsx
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Reset Password — Media Buying Dashboard" };

type Props = { searchParams: { token?: string } };

export default function ResetPasswordPage({ searchParams }: Props) {
  const token = searchParams.token ?? "";

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
              Set a new password
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Choose a strong password for your account.
            </p>
          </div>
        </div>

        <ResetPasswordForm token={token} />

        <p className="mt-6 text-center text-xs text-slate-500">
          Remembered it?{" "}
          <a href="/login" className="text-emerald-500 transition-colors hover:text-emerald-400">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
