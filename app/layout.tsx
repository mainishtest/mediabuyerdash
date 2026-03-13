import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Media Buying Dashboard",
  description: "Media buying analytics dashboard foundation"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        {/* Persistent top navigation */}
        <nav className="sticky top-0 z-10 flex items-center gap-1 border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur-sm">
          <span className="mr-4 text-sm font-semibold tracking-tight text-slate-200">
            Media Buying
          </span>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Dashboard
          </Link>
          <Link
            href="/integrations"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Integrations
          </Link>
          <Link
            href="/reporting"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Reporting
          </Link>
          <Link
            href="/reconciliation"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Reconciliation
          </Link>
          <Link
            href="/sync/meta"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Meta Sync
          </Link>
          <Link
            href="/creative-lab"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Creative Lab
          </Link>
          <Link
            href="/optimization-lab"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Optimization Lab
          </Link>
          <Link
            href="/creative-history"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Gen History
          </Link>
          <Link
            href="/launch-drafts"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Launch Drafts
          </Link>
          <Link
            href="/creative-intelligence"
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            Intelligence
          </Link>
        </nav>

        <main className="app-main">
          {children}
        </main>
      </body>
    </html>
  );
}
