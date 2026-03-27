import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";
import { Providers } from "../components/Providers";
import { AppShell } from "../components/ui/AppShell";
import "./globals.css";

export const metadata = {
  title: "Media Buying Dashboard",
  description: "AI-powered operating system for media buying agencies",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Pre-fetch the session server-side so the client receives it immediately
  // (avoids a loading flash on SessionProvider hydration).
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body>
        <Providers session={session}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
