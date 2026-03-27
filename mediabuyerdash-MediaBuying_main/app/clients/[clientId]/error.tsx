"use client";

// app/clients/[clientId]/error.tsx
// Error boundary for the client detail route and all nested routes.
// Replaces the generic Next.js "Application error" page with a readable
// message that includes the error text for reporting.

import { useEffect } from "react";
import Link          from "next/link";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[client page error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-900/30">
        <span className="text-xl text-rose-400">!</span>
      </div>

      <div className="max-w-md">
        <h1 className="mb-2 text-lg font-semibold text-white">
          Something went wrong loading this page
        </h1>
        <p className="mb-4 text-sm text-slate-400">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-600 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm
                     font-medium text-slate-200 hover:bg-slate-700 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/clients"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium
                     text-white hover:bg-indigo-500 transition-colors"
        >
          Back to Clients
        </Link>
      </div>
    </div>
  );
}
