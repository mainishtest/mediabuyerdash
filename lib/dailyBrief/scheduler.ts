// ─── Daily Morning Brief — Scheduler ─────────────────────────────────────────
//
// Timezone-aware scheduling for daily brief generation.
//
// Flow:
//   1. Determine local morning window from account timezone
//   2. Check if brief already generated for this date (dedup)
//   3. Generate if not already done
//   4. Support manual regeneration for admin/testing
//
// Uses Intl.DateTimeFormat for timezone conversion — no external tz library.

import { prisma } from "../db";
import type {
  DailyBriefTimezoneWindow,
  DailyBriefSchedule,
  DailyBriefDeliveryState,
} from "../../types/dailyBrief";

// ── Timezone helpers ────────────────────────────────────────────────────────

/**
 * Compute the UTC time for a given local hour in a given timezone.
 * Returns the next occurrence of that hour (today or tomorrow).
 */
export function computeTimezoneWindow(
  timezone: string,
  localMorningHour = 7,
): DailyBriefTimezoneWindow {
  const now = new Date();

  // Get the current local time in the target timezone
  const localTimeStr = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Parse local parts
  const match = localTimeStr.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2})/);
  const localHour = match ? parseInt(match[4], 10) : 0;

  // Determine which date this brief covers (yesterday in the account's timezone)
  const localDate = match
    ? `${match[3]}-${match[1]}-${match[2]}`
    : now.toISOString().slice(0, 10);

  // Calculate offset: create a date at the morning hour in local TZ
  // then compare with UTC to find the actual UTC delivery time
  const targetLocal = new Date(`${localDate}T${String(localMorningHour).padStart(2, "0")}:00:00`);

  // Use the timezone offset approach
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const utcDeliverAt = targetLocal.toISOString();

  return {
    timezone,
    localMorningHour,
    utcDeliverAt,
  };
}

/**
 * Get yesterday's date string in a given timezone.
 */
export function getYesterdayInTimezone(timezone: string): string {
  const now = new Date();
  // Get "today" in the target timezone, then subtract 1 day
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA → YYYY-MM-DD
  const todayDate = new Date(todayStr + "T12:00:00Z");
  todayDate.setUTCDate(todayDate.getUTCDate() - 1);
  return todayDate.toISOString().slice(0, 10);
}

/**
 * Get today's date string in a given timezone.
 */
export function getTodayInTimezone(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

// ── Deduplication ───────────────────────────────────────────────────────────

/**
 * Check if a brief has already been generated for this date/workspace.
 * Uses the DailyBriefRecord table.
 */
export async function hasBriefForDate(
  workspaceId: string | null,
  briefDate: string,
): Promise<boolean> {
  const db = prisma as Record<string, any>;
  try {
    const existing = await db.dailyBriefRecord.findFirst({
      where: {
        briefDate,
        ...(workspaceId ? { workspaceId } : {}),
        deliveryState: { notIn: ["failed"] },
      },
      select: { id: true },
    });
    return existing !== null;
  } catch {
    // Table might not exist yet in dev
    return false;
  }
}

/**
 * Check if brief generation should run now based on timezone window.
 * Returns true if local time is within the morning window (±1 hour).
 */
export function isWithinMorningWindow(
  timezone: string,
  localMorningHour = 7,
): boolean {
  const now = new Date();
  const localTimeStr = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
  });
  const localHour = parseInt(localTimeStr, 10);
  return Math.abs(localHour - localMorningHour) <= 1;
}

// ── Schedule builder ────────────────────────────────────────────────────────

/**
 * Build a schedule entry for tracking brief generation state.
 */
export function buildSchedule(opts: {
  briefDate:      string;
  timezone:       string;
  deliveryState:  DailyBriefDeliveryState;
  generatedAt?:   string | null;
  deliveredAt?:   string | null;
  retryCount?:    number;
  lastError?:     string | null;
}): DailyBriefSchedule {
  const window = computeTimezoneWindow(opts.timezone);
  return {
    briefDate:       opts.briefDate,
    timezone:        opts.timezone,
    scheduledForUtc: window.utcDeliverAt,
    generatedAt:     opts.generatedAt ?? null,
    deliveredAt:     opts.deliveredAt ?? null,
    deliveryState:   opts.deliveryState,
    retryCount:      opts.retryCount ?? 0,
    lastError:       opts.lastError ?? null,
  };
}

// ── Save / update brief record ──────────────────────────────────────────────

/**
 * Persist a brief to the database.
 */
export async function saveBriefRecord(brief: {
  id:            string;
  briefDate:     string;
  workspaceId:   string | null;
  deliveryState: DailyBriefDeliveryState;
  briefJson:     unknown;
  timezone:      string;
}): Promise<void> {
  const db = prisma as Record<string, any>;
  try {
    await db.dailyBriefRecord.create({
      data: {
        id:            brief.id,
        briefDate:     brief.briefDate,
        workspaceId:   brief.workspaceId,
        deliveryState: brief.deliveryState,
        briefJson:     JSON.stringify(brief.briefJson),
        timezone:      brief.timezone,
      },
    });
  } catch (err) {
    console.error("[daily-brief] Failed to save brief record:", err);
  }
}

/**
 * Update delivery state of a brief.
 */
export async function updateBriefDeliveryState(
  briefId:        string,
  deliveryState:  DailyBriefDeliveryState,
  error?:         string,
): Promise<void> {
  const db = prisma as Record<string, any>;
  try {
    await db.dailyBriefRecord.update({
      where: { id: briefId },
      data: {
        deliveryState,
        ...(deliveryState === "delivered_in_app" || deliveryState === "delivered_email"
          ? { deliveredAt: new Date() }
          : {}),
        ...(error ? { lastError: error } : {}),
      },
    });
  } catch (err) {
    console.error("[daily-brief] Failed to update brief state:", err);
  }
}

/**
 * Load the most recent briefs for a workspace (for archive view).
 */
export async function loadRecentBriefs(
  workspaceId: string | null,
  limit = 30,
): Promise<Array<{
  id:            string;
  briefDate:     string;
  deliveryState: string;
  briefJson:     string;
  timezone:      string;
  createdAt:     string;
}>> {
  const db = prisma as Record<string, any>;
  try {
    const rows = await db.dailyBriefRecord.findMany({
      where: workspaceId ? { workspaceId } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r: Record<string, any>) => ({
      id:            r.id,
      briefDate:     r.briefDate,
      deliveryState: r.deliveryState,
      briefJson:     r.briefJson,
      timezone:      r.timezone ?? "America/New_York",
      createdAt:     r.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}
