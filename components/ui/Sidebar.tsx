"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

interface NavItem {
  href:  string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analytics",
    items: [
      { href: "/",        label: "Dashboard" },
      { href: "/clients", label: "Clients"   },
    ],
  },
  {
    label: "Optimization",
    items: [
      { href: "/optimization",       label: "Optimization"      },
      { href: "/optimization-lab",   label: "Optimization Lab"  },
      { href: "/measurement-policy", label: "Measurement Policy" },
    ],
  },
  {
    label: "Creative",
    items: [
      { href: "/creative-lab",          label: "Creative Lab"         },
      { href: "/creative-history",      label: "Generation History"   },
      { href: "/launch-drafts",         label: "Launch Drafts"        },
      { href: "/creative-intelligence", label: "Creative Intelligence" },
    ],
  },
  {
    label: "Meta",
    items: [
      { href: "/integrations/meta",       label: "Meta Ads"  },
      { href: "/integrations/meta/sync",  label: "Meta Sync" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/integrations/shopify",       label: "Shopify"      },
      { href: "/integrations/shopify/sync",  label: "Shopify Sync" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/reconciliation", label: "Reconciliation" },
      { href: "/reporting",      label: "Reporting"      },
      { href: "/integrations",   label: "Integrations"   },
      { href: "/ui-preview",     label: "UI Preview"     },
    ],
  },
];

function SidebarFooter() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="shrink-0 border-t border-slate-800 px-5 py-3">
        <p className="text-xs text-slate-600">v0.1 · development</p>
      </div>
    );
  }

  const email         = session.user.email ?? "";
  const workspaceName = session.user.workspaceName ?? "Workspace";

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
      <p className="mb-2 truncate text-xs text-slate-500">{email}</p>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-400
          transition-colors hover:bg-slate-800 hover:text-slate-200"
      >
        Sign out
      </button>
    </div>
  );
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="flex h-full flex-col">
      {/* Logo mark */}
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

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 px-3">
            <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive(item.href)
                        ? "bg-slate-800 font-medium text-white"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer — user info + sign out */}
      <SidebarFooter />
    </nav>
  );
}
