import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                MB
              </div>
              <span className="text-base font-semibold tracking-tight text-white">
                MediaBuyerDash
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              The decision-first operating system for media buying teams, agencies, and operators.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Product
            </h4>
            <ul className="mt-3 space-y-2">
              <li><a href="#features" className="text-sm text-slate-500 transition-colors hover:text-white">Features</a></li>
              <li><a href="#how-it-works" className="text-sm text-slate-500 transition-colors hover:text-white">How It Works</a></li>
              <li><a href="#pricing" className="text-sm text-slate-500 transition-colors hover:text-white">Pricing</a></li>
              <li><a href="#faq" className="text-sm text-slate-500 transition-colors hover:text-white">FAQ</a></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Account
            </h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/login" className="text-sm text-slate-500 transition-colors hover:text-white">Login</Link></li>
              <li><Link href="/signup" className="text-sm text-slate-500 transition-colors hover:text-white">Start Trial</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Legal
            </h4>
            <ul className="mt-3 space-y-2">
              <li><Link href="/privacy" className="text-sm text-slate-500 transition-colors hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-slate-500 transition-colors hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800/60 pt-8 sm:flex-row">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} MediaBuyerDash. All rights reserved.
          </p>
          <Link
            href="/signup"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Start 14-Day $1 Trial
          </Link>
        </div>
      </div>
    </footer>
  );
}
