"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface NavItem {
  href:  string;
  label: string;
}


// Primary nav — only routes that exist and matter to the agency owner.
const NAV_ITEMS: NavItem[] = [
  { href: "/operations",     label: "Operations"    },
  { href: "/alerts",         label: "Alerts"        },
  { href: "/dashboard",      label: "Dashboard"     },
  { href: "/clients",        label: "Clients"       },
  { href: "/integrations",   label: "Integrations"  },
  { href: "/reconciliation", label: "Reconciliation" },
  { href: "/optimization",   label: "Optimization"  },
  { href: "/creative-lab",   label: "Creative Lab"  },
];

function SidebarFooter({ onClose }: { onClose?: () => void }) {
  const { data: session } = useSession();
  const router    = useRouter();
  const pathname  = usePathname();

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

  function goToProfile() {
    onClose?.();
    router.push("/profile");
  }

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
        onClick={goToProfile}
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

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

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

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
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

      {/* Footer — user info + sign out + profile */}
      <SidebarFooter onClose={onClose} />
    </nav>
  );
}
