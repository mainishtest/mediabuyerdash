// lib/notifications/index.ts
// Public exports for the notification delivery system.

export type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationEventType,
  NotificationPreferenceRow,
  NotificationLogRow,
  DigestSectionItem,
  DigestContent,
} from "./types";

export {
  getOrCreatePreferences,
  updatePreferences,
  getWorkspaceUsersForNotification,
} from "./preferences";

export {
  buildImmediateAlertEmail,
  buildDailyDigestEmail,
} from "./templates";

export {
  buildDigestContent,
  loadPendingImmediateAlerts,
} from "./generator";

export {
  deliverImmediateAlert,
  deliverDailyDigest,
  loadNotificationHistory,
} from "./deliver";
