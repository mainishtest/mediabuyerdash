// app/api/notifications/send-digest/route.ts
// POST — trigger a daily digest for the current user.
// Deduplication prevents sending more than once per day.

import { NextResponse }           from "next/server";
import { getServerSession }       from "next-auth";
import { authOptions }            from "../../../../lib/auth";
import {
  getOrCreatePreferences,
  buildDigestContent,
  deliverDailyDigest,
}                                 from "../../../../lib/notifications";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId      = session.user.id;
  const workspaceId = session.user.workspaceId ?? null;
  const userEmail   = session.user.email ?? "";
  const userName    = session.user.name  ?? null;

  const prefs = await getOrCreatePreferences(userId);

  if (!prefs.emailEnabled || !prefs.dailyDigest) {
    return NextResponse.json({
      ok:      false,
      message: "Daily digest is disabled in your notification preferences.",
    });
  }

  const digest = await buildDigestContent(workspaceId);

  await deliverDailyDigest(
    { id: userId, email: userEmail, name: userName },
    digest,
    workspaceId
  );

  return NextResponse.json({
    ok:      true,
    message: "Daily digest triggered. Check delivery history for status.",
  });
}
