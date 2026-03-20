// app/api/notifications/send-test/route.ts
// POST — send a test email to the current user to verify SMTP configuration.
// Uses a fake digest with sample content so the user can see the template.

import { NextResponse }           from "next/server";
import { getServerSession }       from "next-auth";
import { authOptions }            from "../../../../lib/auth";
import {
  buildDailyDigestEmail,
  deliverDailyDigest,
}                                 from "../../../../lib/notifications";
import type { DigestContent }     from "../../../../lib/notifications/types";

// Sample digest content for the test email
function buildTestDigest(): DigestContent {
  return {
    workspaceId:  null,
    generatedAt:  new Date().toISOString(),
    hasContent:   true,
    campaignsBelowGoal: [
      { label: "Example Campaign — Spring Sale",  detail: "ROAS 0.9x vs goal 2.0x", client: "Example Client" },
    ],
    pacingIssues: [
      { label: "Example Client",  detail: "62% paced — under-pacing", client: "Example Client" },
    ],
    staleSyncs: [
      { label: "Example Client",  detail: "Last sync was 72 hours ago", client: "Example Client" },
    ],
    topOpportunities: [
      { label: "Example Campaign — Always On",  detail: "ROAS 4.2x vs goal 2.0x — ready to scale", client: "Example Client" },
    ],
    missingGoals: [
      { label: "Example Campaign — Retargeting",  detail: "No ROAS or CPA goal configured", client: "Example Client" },
    ],
  };
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId    = session.user.id;
  const userEmail = session.user.email ?? "";
  const userName  = session.user.name  ?? null;

  // Use a unique dedup key for the test (allows re-sending)
  const testDigest: DigestContent = buildTestDigest();

  // Bypass dedup by using a unique key each time (test emails are always resendable)
  const { subject, html, text } = buildDailyDigestEmail(testDigest, userName);
  const { sendEmail }           = await import("../../../../lib/email");
  const { prisma }              = await import("../../../../lib/db");

  const log = await prisma.notificationLog.create({
    data: {
      userId,
      channel:  "email",
      eventType: "daily_digest",
      priority:  "low",
      subject:   `[TEST] ${subject}`,
      status:    "pending",
    },
  });

  try {
    const result = await sendEmail({
      to:      userEmail,
      subject: `[TEST] ${subject}`,
      html,
      text,
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  {
        status: result.sent ? "sent" : "skipped",
        sentAt: result.sent ? new Date() : null,
      },
    });

    return NextResponse.json({
      ok:      true,
      message: result.sent
        ? `Test email sent to ${userEmail}.`
        : `SMTP not configured — check server logs for the email preview.`,
    });
  } catch (err) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  {
        status:       "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return NextResponse.json(
      { ok: false, message: "Failed to send test email. Check server logs." },
      { status: 500 }
    );
  }
}
