// ─── Daily Morning Brief — Delivery ──────────────────────────────────────────
//
// Handles in-app persistence and email delivery of daily briefs.
//
// Flow:
//   1. generateDailyBriefForAccount() — build + save + deliver
//   2. saveInAppDailyBrief()          — persist for in-app viewing
//   3. sendDailyBriefEmail()          — email via existing SMTP infra
//   4. markDailyBriefDelivered()      — update delivery state
//   5. retryFailedDailyBriefDelivery() — retry failed briefs
//
// Reuses:
//   - lib/email.ts (sendEmail)
//   - lib/notifications/deliver.ts (logAndSend pattern, NotificationLog)
//   - lib/notifications/preferences.ts (user preference loading)

import { prisma }                          from "../db";
import { sendEmail }                       from "../email";
import { buildDailyMorningBrief }          from "./aggregator";
import { buildDailyBriefEmailTemplate }    from "./emailTemplate";
import {
  hasBriefForDate,
  saveBriefRecord,
  updateBriefDeliveryState,
  getYesterdayInTimezone,
} from "./scheduler";
import { getWorkspaceUsersForNotification } from "../notifications/preferences";
import type { DailyMorningBrief }          from "../../types/dailyBrief";

// ── Generate brief for a workspace ──────────────────────────────────────────

/**
 * Full generation pipeline:
 *  1. Check dedup
 *  2. Build brief
 *  3. Save in-app
 *  4. Send email to opted-in users
 *  5. Update delivery state
 */
export async function generateDailyBriefForAccount(opts: {
  workspaceId: string | null;
  timezone:    string;
  force?:      boolean;       // Skip dedup check (for admin/testing)
}): Promise<{ brief: DailyMorningBrief | null; skipped: boolean; error?: string }> {
  const { workspaceId, timezone, force } = opts;
  const briefDate = getYesterdayInTimezone(timezone);

  // Dedup check
  if (!force) {
    const exists = await hasBriefForDate(workspaceId, briefDate);
    if (exists) {
      return { brief: null, skipped: true };
    }
  }

  try {
    // Build brief
    const brief = await buildDailyMorningBrief({
      workspaceId,
      timezone,
      briefDate,
    });

    // Save in-app
    await saveInAppDailyBrief(brief);

    // Send email to opted-in users
    await sendDailyBriefEmails(brief, workspaceId);

    // Mark delivered
    await markDailyBriefDelivered(brief.id, "delivered_in_app");

    return { brief, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily-brief] Generation failed:", message);
    return { brief: null, skipped: false, error: message };
  }
}

// ── Save in-app brief ───────────────────────────────────────────────────────

export async function saveInAppDailyBrief(brief: DailyMorningBrief): Promise<void> {
  await saveBriefRecord({
    id:            brief.id,
    briefDate:     brief.briefDate,
    workspaceId:   brief.workspaceId,
    deliveryState: "generated",
    briefJson:     brief,
    timezone:      brief.timezone,
  });
}

// ── Send email to all opted-in users ────────────────────────────────────────

async function sendDailyBriefEmails(
  brief:       DailyMorningBrief,
  workspaceId: string | null,
): Promise<void> {
  // Load users with preferences
  const users = workspaceId
    ? await getWorkspaceUsersForNotification(workspaceId)
    : [];

  for (const user of users) {
    const prefs = user.notificationPreference;

    // Skip if user has disabled email or daily digest
    if (!prefs?.emailEnabled || !prefs?.dailyDigest) continue;

    try {
      await sendDailyBriefEmail({
        brief,
        userId:    user.id,
        userEmail: user.email,
        userName:  user.name,
      });
    } catch (err) {
      console.error(`[daily-brief] Email failed for ${user.email}:`, err);
      // Log failure but continue for other users
      await logBriefEmailFailure(
        user.id,
        workspaceId,
        brief,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

// ── Send single email ───────────────────────────────────────────────────────

export async function sendDailyBriefEmail(opts: {
  brief:     DailyMorningBrief;
  userId:    string;
  userEmail: string;
  userName:  string | null;
}): Promise<void> {
  const { brief, userId, userEmail, userName } = opts;

  // Dedup check
  const dedupKey = `daily_brief:${userId}:${brief.briefDate}`;
  const existing = await prisma.notificationLog.findFirst({
    where: {
      deduplicationKey: dedupKey,
      status: { in: ["sent", "pending"] },
    },
    select: { id: true },
  });
  if (existing) return;

  // Build email content
  const { subject, html, text } = buildDailyBriefEmailTemplate(brief, userName);

  // Create pending log
  const log = await prisma.notificationLog.create({
    data: {
      userId,
      workspaceId:     brief.workspaceId,
      channel:         "email",
      eventType:       "daily_digest",
      priority:        "medium",
      subject,
      deduplicationKey: dedupKey,
      status:          "pending",
    },
  });

  try {
    const result = await sendEmail({
      to:      userEmail,
      subject,
      html,
      text,
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.sent ? "sent" : "skipped",
        sentAt: result.sent ? new Date() : null,
      },
    });
  } catch (err) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status:       "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// ── Mark delivered ──────────────────────────────────────────────────────────

export async function markDailyBriefDelivered(
  briefId:       string,
  deliveryState: "delivered_in_app" | "delivered_email",
): Promise<void> {
  await updateBriefDeliveryState(briefId, deliveryState);
}

// ── Retry failed deliveries ─────────────────────────────────────────────────

export async function retryFailedDailyBriefDelivery(
  workspaceId: string | null,
  maxRetries = 3,
): Promise<number> {
  const db = prisma as Record<string, any>;
  let retried = 0;

  try {
    const failed = await db.dailyBriefRecord.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        deliveryState: "failed",
        retryCount: { lt: maxRetries },
      },
      take: 5,
    });

    for (const record of failed) {
      const brief: DailyMorningBrief = JSON.parse(record.briefJson);

      try {
        await sendDailyBriefEmails(brief, workspaceId);
        await updateBriefDeliveryState(record.id, "delivered_email");
        retried++;
      } catch {
        await db.dailyBriefRecord.update({
          where: { id: record.id },
          data: {
            retryCount: { increment: 1 },
          },
        });
      }
    }
  } catch {
    // Table might not exist yet
  }

  return retried;
}

// ── Internal helpers ────────────────────────────────────────────────────────

async function logBriefEmailFailure(
  userId:      string,
  workspaceId: string | null,
  brief:       DailyMorningBrief,
  error:       string,
): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        workspaceId,
        channel:          "email",
        eventType:        "daily_digest",
        priority:         "medium",
        subject:          `Daily Brief — ${brief.briefDate}`,
        deduplicationKey: `daily_brief_fail:${userId}:${brief.briefDate}`,
        status:           "failed",
        errorMessage:     error,
      },
    });
  } catch {
    // Best-effort logging
  }
}
