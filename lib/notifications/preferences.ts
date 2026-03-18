// lib/notifications/preferences.ts
// DB read/write helpers for NotificationPreference.
// Creates a default preference row on first access.

import { prisma }                      from "../db";
import type { NotificationPreferenceRow } from "./types";

// ── Serialiser ────────────────────────────────────────────────────────────────

function toRow(p: {
  id: string; userId: string;
  emailEnabled: boolean; immediateAlerts: boolean; dailyDigest: boolean;
  alertHighPriority: boolean; alertSyncFailure: boolean; alertPacing: boolean;
  alertBelowGoal: boolean; alertMissingGoals: boolean;
  createdAt: Date; updatedAt: Date;
}): NotificationPreferenceRow {
  return {
    id:                p.id,
    userId:            p.userId,
    emailEnabled:      p.emailEnabled,
    immediateAlerts:   p.immediateAlerts,
    dailyDigest:       p.dailyDigest,
    alertHighPriority: p.alertHighPriority,
    alertSyncFailure:  p.alertSyncFailure,
    alertPacing:       p.alertPacing,
    alertBelowGoal:    p.alertBelowGoal,
    alertMissingGoals: p.alertMissingGoals,
    createdAt:         p.createdAt.toISOString(),
    updatedAt:         p.updatedAt.toISOString(),
  };
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Load preferences for userId; creates default row if not found.
 */
export async function getOrCreatePreferences(
  userId: string
): Promise<NotificationPreferenceRow> {
  const existing = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (existing) return toRow(existing);

  const created = await prisma.notificationPreference.create({
    data: { userId },
  });
  return toRow(created);
}

/**
 * Upsert preferences for userId. Only provided fields are changed.
 */
export async function updatePreferences(
  userId: string,
  updates: Partial<Pick<
    NotificationPreferenceRow,
    | "emailEnabled" | "immediateAlerts" | "dailyDigest"
    | "alertHighPriority" | "alertSyncFailure"
    | "alertPacing" | "alertBelowGoal" | "alertMissingGoals"
  >>
): Promise<NotificationPreferenceRow> {
  const row = await prisma.notificationPreference.upsert({
    where:  { userId },
    create: { userId, ...updates },
    update: updates,
  });
  return toRow(row);
}

/**
 * Returns all users in a workspace with their notification preferences.
 * Used by the delivery layer to decide who to notify.
 */
export async function getWorkspaceUsersForNotification(
  workspaceId: string | null
): Promise<Array<{
  id:    string;
  email: string;
  name:  string | null;
  notificationPreference: NotificationPreferenceRow | null;
}>> {
  const where = workspaceId
    ? { memberships: { some: { workspaceId } } }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id:    true,
      email: true,
      name:  true,
      notificationPreference: true,
    },
  });

  return users.map((u) => ({
    id:    u.id,
    email: u.email,
    name:  u.name,
    notificationPreference: u.notificationPreference
      ? toRow(u.notificationPreference)
      : null,
  }));
}
