import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Media Buying Dashboard",
  description: "Media buying analytics dashboard foundation"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        <main className="app-main">
          {children}
        </main>
      </body>
    </html>
  );
}
