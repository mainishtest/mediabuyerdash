// app/register/page.tsx
// Registration page — same fixed overlay approach as /login.
// Already-authenticated users are redirected to /dashboard.

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../lib/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata = {
  title: "Create Account — Media Buying Dashboard",
};

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

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
              Create your account
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Get started with Media Buying OS
            </p>
          </div>
        </div>

        <RegisterForm />

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-emerald-500 transition-colors hover:text-emerald-400"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
