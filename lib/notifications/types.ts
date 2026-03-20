// lib/notifications/types.ts
// Typed models for the notification delivery system.
//
// v1 scope: email only. Slack, SMS, and webhook channels are not yet wired.

// ── Enums ─────────────────────────────────────────────────────────────────────

export type NotificationChannel        = "email";
export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";
export type NotificationPriority       = "low" | "medium" | "high";
export type NotificationEventType      = "immediate_alert" | "daily_digest";

// ── DB row shapes ─────────────────────────────────────────────────────────────

// Matches the NotificationPreference Prisma model, with dates serialised to ISO.
export type NotificationPreferenceRow = {
  id:                string;
  userId:            string;
  emailEnabled:      boolean;
  immediateAlerts:   boolean;
  dailyDigest:       boolean;
  alertHighPriority: boolean;
  alertSyncFailure:  boolean;
  alertPacing:       boolean;
  alertBelowGoal:    boolean;
  alertMissingGoals: boolean;
  createdAt:         string;
  updatedAt:         string;
};

// Matches the NotificationLog Prisma model.
export type NotificationLogRow = {
  id:               string;
  userId:           string;
  workspaceId:      string | null;
  channel:          NotificationChannel;
  eventType:        NotificationEventType;
  priority:         NotificationPriority;
  subject:          string;
  deduplicationKey: string | null;
  status:           NotificationDeliveryStatus;
  errorMessage:     string | null;
  sentAt:           string | null;
  createdAt:        string;
};

// ── Digest content ─────────────────────────────────────────────────────────────

export type DigestSectionItem = {
  label:  string;   // e.g. campaign name or client name
  detail: string;   // one-line description / metric summary
  client: string;   // client name for context
};

export type DigestContent = {
  workspaceId:        string | null;
  generatedAt:        string;               // ISO datetime
  campaignsBelowGoal: DigestSectionItem[];
  pacingIssues:       DigestSectionItem[];
  staleSyncs:         DigestSectionItem[];
  topOpportunities:   DigestSectionItem[];
  missingGoals:       DigestSectionItem[];
  hasContent:         boolean;              // false → "all clear" digest
};
