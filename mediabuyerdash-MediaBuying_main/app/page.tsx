// app/page.tsx — redirect root to /command-center
// Command Center is the most operationally relevant landing page for media buyers:
// KPIs, priorities, alerts, and experiments — all in one view.
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
export default function RootPage() { redirect("/command-center"); }
