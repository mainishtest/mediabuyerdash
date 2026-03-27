"use client";

// components/Providers.tsx
// Client-side wrapper for NextAuth SessionProvider.
// Placed here so the root layout (server component) can pass the pre-fetched
// session, avoiding an extra round-trip on the client.

import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session:  Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
