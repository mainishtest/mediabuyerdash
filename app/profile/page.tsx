// app/profile/page.tsx
export const dynamic = "force-dynamic";

import { redirect }        from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }     from "../../lib/auth";
import { ProfileView }     from "./ProfileView";

export const metadata = { title: "Profile — Media Buying Dashboard" };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <ProfileView
      userId={session.user.id}
      name={session.user.name ?? null}
      email={session.user.email ?? ""}
      workspaceName={session.user.workspaceName ?? "My Workspace"}
    />
  );
}
