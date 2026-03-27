// lib/notifications/deliver.ts
// Email delivery layer — wraps lib/email.ts sendEmail and persists NotificationLog.
//
// Design:
//   - Deduplication: deduplicationKey prevents double-sends per user per event.
//   - Error isolation: a failed send is logged with status "failed"; it does not throw.
//   - SMTP not configured: status is "skipped" (not an error — dev/test environment).

import { prisma }                             from "../db";
import { sendEmail }                          from "../email";
import { buildImmediateAlertEmail,
         buildDailyDigestEmail }              from "./templates";
import type { AlertEventRow }                 from "../alerts/types";
import type { DigestContent, NotificationPriority } from "./types";

// ── Internal helpers ──────────────────────────────────────────────────────────

type UserInfo = { id: string; email: string; name: string | null };

async function isDuplicate(dedupKey: string): Promise<boolean> {
  const existing = await prisma.notificationLog.findFirst({
    where: {
      deduplicationKey: dedupKey,
      status:           { in: ["sent", "pending"] },
    },
    select: { id: true },
  });
  return existing !== null;
}

async function logAndSend(opts: {
  user:            UserInfo;
  workspaceId:     string | null;
  eventType:       "immediate_alert" | "daily_digest";
  priority:        NotificationPriority;
  subject:         string;
  html:            string;
  text:            string;
  dedupKey:        string;
}): Promise<void> {
  // Create pending log first
  const log = await prisma.notificationLog.create({
    data: {
      userId:          opts.user.id,
      workspaceId:     opts.workspaceId,
      channel:         "email",
      eventType:       opts.eventType,
      priority:        opts.priority,
      subject:         opts.subject,
      deduplicationKey: opts.dedupKey,
      status:          "pending",
    },
  });

  try {
    const result = await sendEmail({
      to:      opts.user.email,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text,
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  {
        status: result.sent ? "sent" : "skipped",
        sentAt: result.sent ? new Date() : null,
      },
    });
  } catch (err) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data:  {
        status:       "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// ── Public delivery functions ─────────────────────────────────────────────────

/**
 * Deliver one immediate alert email to one user.
 * Skips if already sent (dedup check).
 */
export async function deliverImmediateAlert(
  user:        UserInfo,
  alert:       AlertEventRow,
  workspaceId: string | null
): Promise<void> {
  const dedupKey = `immediate_alert:${user.id}:${alert.id}`;
  if (await isDuplicate(dedupKey)) return;

  const { subject, html, text } = buildImmediateAlertEmail(alert, user.name);

  await logAndSend({
    user,
    workspaceId,
    eventType: "immediate_alert",
    priority:  alert.severity as NotificationPriority,
    subject,
    html,
    text,
    dedupKey,
  });
}

/**
 * Deliver a daily digest email to one user.
 * Skips if already sent today (dedup key includes YYYY-MM-DD).
 */
export async function deliverDailyDigest(
  user:        UserInfo,
  digest:      DigestContent,
  workspaceId: string | null
): Promise<void> {
  const today    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dedupKey = `daily_digest:${user.id}:${today}`;
  if (await isDuplicate(dedupKey)) return;

  const { subject, html, text } = buildDailyDigestEmail(digest, user.name);

  await logAndSend({
    user,
    workspaceId,
    eventType: "daily_digest",
    priority:  "medium",
    subject,
    html,
    text,
    dedupKey,
  });
}

// ── Notification log helpers ──────────────────────────────────────────────────

/**
 * Load recent notification log entries for a user (for the history view).
 */
export async function loadNotificationHistory(
  userId: string,
  limit = 50
) {
  const rows = await prisma.notificationLog.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  return rows.map((r) => ({
    id:               r.id,
    userId:           r.userId,
    workspaceId:      r.workspaceId,
    channel:          r.channel as "email",
    eventType:        r.eventType as "immediate_alert" | "daily_digest",
    priority:         r.priority as NotificationPriority,
    subject:          r.subject,
    deduplicationKey: r.deduplicationKey,
    status:           r.status as "pending" | "sent" | "failed" | "skipped",
    errorMessage:     r.errorMessage,
    sentAt:           r.sentAt?.toISOString() ?? null,
    createdAt:        r.createdAt.toISOString(),
  }));
}
