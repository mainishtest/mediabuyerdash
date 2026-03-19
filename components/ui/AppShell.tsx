"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Sidebar } from "./Sidebar";

// ---------------------------------------------------------------------------
// Workspace header (desktop) — shows workspace name + user + sign out
// ---------------------------------------------------------------------------

function WorkspaceHeader() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Don't render on auth pages (they are fixed overlays — keeps DOM clean).
  if (pathname === "/login" || pathname === "/register") return null;
  if (status === "loading") return (
    <div className="hidden h-12 shrink-0 items-center border-b border-slate-800 bg-slate-900/30 px-6 lg:flex" />
  );
  if (!session) return null;

  const workspaceName = session.user.workspaceName ?? "Workspace";
  const userName      = session.user.name || session.user.email || "";

  return (
    <div className="hidden h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/30 px-6 lg:flex">
      {/* Workspace */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-700 text-xs font-bold text-white">
          W
        </div>
        <span className="text-sm font-medium text-slate-300">{workspaceName}</span>
      </div>

      {/* User + sign out */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">{userName}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400
            transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Portal pages render with no chrome — clients access them via shareable link.
  const isPortal = pathname?.startsWith("/portal/");
  if (isPortal) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 overflow-hidden border-r border-slate-800 bg-slate-900 lg:flex lg:flex-col">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 flex h-full w-60 flex-col overflow-hidden border-r border-slate-800 bg-slate-900">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Workspace header (desktop) */}
        <WorkspaceHeader />

        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/50 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            aria-label="Open navigation"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600 text-xs font-bold text-white">
              MB
            </div>
            <span className="text-sm font-semibold text-white">
              Media Buying
            </span>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
