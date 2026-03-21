import Link from "next/link";

export function CtaSection() {
  return (
    <section className="border-t border-slate-800/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-800/30 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-900 px-8 py-16 text-center sm:px-16 sm:py-20">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to stop guessing?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Join the media buyers who replaced their spreadsheets, Slack
              threads, and ad manager tab-switching with a single operating
              system built for decisions.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/signup"
                className="w-full rounded-lg bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-500 sm:w-auto"
              >
                Start My $1 Trial
              </Link>
              <Link
                href="/login"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-8 py-3.5 text-base font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white sm:w-auto"
              >
                Login to Existing Account
              </Link>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              $1 for 14 days · Then $495/month · Cancel anytime · Full access from day one
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
