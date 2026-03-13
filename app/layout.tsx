import type { ReactNode } from "react";
import { AppShell } from "../components/ui/AppShell";
import "./globals.css";

export const metadata = {
  title: "Media Buying Dashboard",
  description: "AI-powered operating system for media buying agencies",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
