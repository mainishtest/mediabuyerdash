// app/page.tsx — redirect root to /dashboard
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
export default function RootPage() { redirect("/dashboard"); }
