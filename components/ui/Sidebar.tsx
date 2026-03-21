"use client";

import Link          from "next/link";
import { useState }  from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useRouter }  from "next/navigation";

// ---------------------------------------------------------------------------
// Nav structure
// ---------------------------------------------------------------------------

type NavLeaf = {
  kind:  "leaf";
  href:  string;
  label: string;
};

type NavGroup = {
  kind:     "group";
  label:    string;
  icon:     string;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

const NAV: NavEntry[] = [
  {
    kind:  "leaf",
    href:  "/portfolio",
    label: "Portfolio",
  },
  {
    kind:  "leaf",
    href:  "/portfolio/governance",
    label: "Portfolio Governance",
  },
  {
    kind:  "leaf",
    href:  "/portfolio/controls",
    label: "Portfolio Controls",
  },
  {
    kind:  "leaf",
    href:  "/assistant",
    label: "AI Assistant",
  },
  {
    kind:  "leaf",
    href:  "/command-center",
    label: "Command Center",
  },
  {
    kind:  "leaf",
    href:  "/dashboard",
    label: "Dashboard",
  },
  {
    kind:  "group",
    label: "Performance",
    icon:  "◈",
    children: [
      { kind: "leaf", href: "/reports/executive", label: "Executive Report" },
      { kind: "leaf", href: "/reconciliation",  label: "Reconciliation"  },
      { kind: "leaf", href: "/optimization",    label: "Optimization"    },
      { kind: "leaf", href: "/pacing",          label: "Pacing"          },
    ],
  },
  {
    kind:  "group",
    label: "Creative",
    icon:  "◇",
    children: [
      { kind: "leaf", href: "/creative-lab",              label: "Creative Lab"         },
      { kind: "leaf", href: "/creative-lab/launch",      label: "Experiment Launch"    },
      { kind: "leaf", href: "/creative-lab/results",     label: "Test Results"         },
      { kind: "leaf", href: "/creative-lab/outcomes",   label: "Outcome Routing"      },
      { kind: "leaf", href: "/creative-fatigue",         label: "Creative Fatigue"     },
      { kind: "leaf", href: "/insights/memory",          label: "Learning Memory"      },
      { kind: "leaf", href: "/insights/trace",           label: "Decision Trace"       },
    ],
  },
  {
    kind:  "group",
    label: "Operations",
    icon:  "◎",
    children: [
      { kind: "leaf", href: "/operations",   label: "Operations"   },
      { kind: "leaf", href: "/alerts",       label: "Alerts"       },
      { kind: "leaf", href: "/notifications", label: "Notifications" },
    ],
  },
  {
    kind:  "group",
    label: "Automation",
    icon:  "⟳",
    children: [
      { kind: "leaf", href: "/automation",               label: "Automation"     },
      { kind: "leaf", href: "/automation/auto-execution", label: "Auto-Execution" },
      { kind: "leaf", href: "/automation/policies",       label: "Policies"       },
      { kind: "leaf", href: "/automation/governance",     label: "Governance"     },
      { kind: "leaf", href: "/automation/history",        label: "Audit History"  },
    ],
  },
  {
    kind:  "group",
    label: "Settings",
    icon:  "◉",
    children: [
      { kind: "leaf", href: "/clients",      label: "Clients"      },
      { kind: "leaf", href: "/accounts/new",  label: "Onboarding"   },
    ],
  },
  {
    kind:  "group",
    label: "Integrations",
    icon:  "⬡",
    children: [
      { kind: "leaf", href: "/integrations",          label: "Overview"   },
      { kind: "leaf", href: "/integrations/meta",     label: "Facebook"   },
      { kind: "leaf", href: "/integrations/shopify",  label: "Shopify"    },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupContainsActive(group: NavGroup, pathname: string): boolean {
  return group.children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );
}

// ---------------------------------------------------------------------------
// Group item
// ---------------------------------------------------------------------------

function NavGroupItem({
  group,
  pathname,
  onClose,
}: {
  group:    NavGroup;
  pathname: string;
  onClose?: () => void;
}) {
  const hasActive = groupContainsActive(group, pathname);
  const [open, setOpen] = useState(hasActive);

  const isChildActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <li>
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm
                   text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
        aria-expanded={open}
      >
        <span className="shrink-0 text-[11px] text-slate-600">{group.icon}</span>
        <span className="flex-1 text-left font-medium">{group.label}</span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Children */}
      {open && (
        <ul className="relative mt-0.5 space-y-0.5 pl-5">
          {/* Left rail */}
          <div className="absolute ml-[-13px] mt-0.5 h-[calc(100%-4px)] w-px bg-slate-800" />
          {group.children.map((child) => (
            <li key={child.href} className="relative">
              <Link
                href={child.href}
                onClick={onClose}
                className={`flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isChildActive(child.href)
                    ? "bg-slate-800 font-medium text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function SidebarFooter({ onClose }: { onClose?: () => void }) {
  const { data: session } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  if (!session) {
    return (
      <div className="shrink-0 border-t border-slate-800 px-5 py-3">
        <p className="text-xs text-slate-600">v0.1 · development</p>
      </div>
    );
  }

  const userName      = session.user.name || session.user.email || "";
  const workspaceName = session.user.workspaceName ?? "Workspace";
  const isProfile     = pathname === "/profile";

  return (
    <div className="shrink-0 border-t border-slate-800 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-700 text-xs font-bold text-white">
          W
        </div>
        <span className="truncate text-xs font-medium text-slate-300">
          {workspaceName}
        </span>
      </div>
      <button
        onClick={() => { onClose?.(); router.push("/profile"); }}
        className={`mb-1 w-full truncate rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
          isProfile
            ? "bg-slate-800 font-medium text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        }`}
      >
        {userName}
      </button>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-500
          transition-colors hover:bg-slate-800 hover:text-slate-300"
      >
        Sign out
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-800 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
          MB
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">
          Media Buying
        </span>
        <span className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-500">
          OS
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-3">
          {NAV.map((entry) => {
            if (entry.kind === "leaf") {
              const active =
                pathname === entry.href || pathname.startsWith(entry.href + "/");
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={onClose}
                    className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-slate-800 font-medium text-white"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    {entry.label}
                  </Link>
                </li>
              );
            }

            return (
              <NavGroupItem
                key={entry.label}
                group={entry}
                pathname={pathname}
                onClose={onClose}
              />
            );
          })}
        </ul>
      </div>

      <SidebarFooter onClose={onClose} />
    </nav>
  );
}
