export const dynamic = "force-dynamic";

import { redirect }          from "next/navigation";
import { getServerSession }  from "next-auth";
import { authOptions }       from "../../lib/auth";
import {
  getOrCreatePreferences,
  loadNotificationHistory,
} from "../../lib/notifications";
import { NotificationsView } from "./NotificationsView";

export async function generateMetadata() {
  return { title: "Notifications — Media Buying Dashboard" };
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId      = session.user.id;
  const workspaceId = session.user.workspaceId ?? null;
  const userEmail   = session.user.email ?? "";
  const userName    = session.user.name  ?? null;

  const [preferences, history] = await Promise.all([
    getOrCreatePreferences(userId),
    loadNotificationHistory(userId, 50),
  ]);

  return (
    <NotificationsView
      userId={userId}
      userEmail={userEmail}
      userName={userName}
      workspaceId={workspaceId}
      preferences={preferences}
      history={history}
    />
  );
}
