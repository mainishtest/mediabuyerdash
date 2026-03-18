# Alert Delivery & Notification Foundation

## What this is

The notification system delivers alerts and summaries outside the dashboard via email.
v1 scope: **email only**. Slack, SMS, and webhooks are not wired yet.

---

## Environment variables (required for delivery)

Add these to `.env.local` or your Vercel/deployment environment:

```
SMTP_HOST="smtp.sendgrid.net"   # or smtp.gmail.com, smtp.postmarkapp.com, etc.
SMTP_PORT="587"                  # 587 (TLS) or 465 (SSL)
SMTP_USER="apikey"               # username or API key username
SMTP_PASS="your-api-key"         # password or API key
SMTP_FROM="no-reply@agency.com"  # sender address shown in the email
```

**If SMTP is not configured**, email delivery is skipped. The email content
is printed to the server console instead. This lets you develop and test
without a real email account. Delivery status in the history will show `skipped`.

Recommended providers:
| Provider | Free tier | Notes |
|---|---|---|
| SendGrid | 100/day | `SMTP_USER=apikey`, `SMTP_PASS=SG.xxxx` |
| Resend | 100/day | `SMTP_HOST=smtp.resend.com`, `SMTP_USER=resend` |
| Postmark | 100/mo | Transactional-focused, high deliverability |
| Gmail | 500/day | `SMTP_HOST=smtp.gmail.com`, use App Password |

---

## Notifications that exist (v1)

### 1. Immediate alert email
- **Trigger**: manually triggered via `/notifications` → "Send Digest Now" or programmatically via `POST /api/notifications/send-digest`
- **Content**: one email per open alert that the user has not yet been notified about
- **Dedup key**: `immediate_alert:{userId}:{alertId}` — one email per user per alert

### 2. Daily digest email
- **Trigger**: user clicks "Send Digest Now" on `/notifications`, or `POST /api/notifications/send-digest`
- **Content**: campaigns below goal · pacing issues · stale syncs · top opportunities · missing goals
- **Dedup key**: `daily_digest:{userId}:{YYYY-MM-DD}` — one digest per user per day
- **All-clear**: if no issues are detected, the email still sends with an "all clear" message

### 3. Test email
- **Trigger**: user clicks "Send Test Email" on `/notifications`
- **Content**: sample daily digest with placeholder data to verify SMTP config
- **Dedup**: none — test emails can always be re-sent

---

## How immediate alerts work

```
1. User visits /notifications or trigger fires
2. loadPendingImmediateAlerts(userId, workspaceId, prefs)
   - loads open alerts from AlertEvent table
   - filters by user preferences (alertHighPriority, alertSyncFailure, alertBelowGoal)
   - checks NotificationLog for already-sent dedup keys
3. For each unsent alert:
   deliverImmediateAlert(user, alert, workspaceId)
   - builds HTML/text email via buildImmediateAlertEmail()
   - creates NotificationLog entry with status "pending"
   - calls sendEmail() from lib/email.ts
   - updates log status to "sent" | "skipped" | "failed"
```

**No background job runs in v1.** Evaluation is on-demand only. Add a cron
route at `/api/notifications/run-immediate-alerts` pointing to a scheduled
Vercel function in the next phase.

---

## How daily digest works

```
1. User clicks "Send Digest Now" or POST /api/notifications/send-digest
2. buildDigestContent(workspaceId)
   - loadAlerts(workspaceId, { status: ["open"] })      → below-goal, stale-sync, above-goal
   - buildAllClientsPacingSummaries(workspaceId)         → pacing issues
   - prisma.proposedAutomationAction.findMany(set_goals) → missing goals
3. deliverDailyDigest(user, digest, workspaceId)
   - dedup check: daily_digest:{userId}:{YYYY-MM-DD}
   - builds HTML/text via buildDailyDigestEmail()
   - logs + sends
```

---

## Notification preferences

Preferences are stored in `NotificationPreference` (one row per user, created with
defaults on first page load).

| Preference | Default | Description |
|---|---|---|
| `emailEnabled` | `true` | Master switch — disables all email if off |
| `immediateAlerts` | `true` | Master switch for immediate emails |
| `alertHighPriority` | `true` | High-severity anomaly alerts |
| `alertSyncFailure` | `true` | Stale/failed sync alerts |
| `alertBelowGoal` | `true` | Campaigns below ROAS/CPA goal |
| `alertPacing` | `true` | Over/under pacing budget |
| `dailyDigest` | `true` | Daily summary email |
| `alertMissingGoals` | `false` | Missing campaign goals in digest |

---

## Architecture

```
lib/notifications/
  types.ts       — NotificationChannel, NotificationDeliveryStatus,
                   NotificationPriority, NotificationEventType,
                   NotificationPreferenceRow, NotificationLogRow,
                   DigestContent, DigestSectionItem
  preferences.ts — getOrCreatePreferences(), updatePreferences(),
                   getWorkspaceUsersForNotification()
  templates.ts   — buildImmediateAlertEmail(), buildDailyDigestEmail()
                   (pure functions — no DB, no email side effects)
  generator.ts   — buildDigestContent(), loadPendingImmediateAlerts()
                   (loads system state, returns structured data)
  deliver.ts     — deliverImmediateAlert(), deliverDailyDigest(),
                   loadNotificationHistory()
                   (calls sendEmail, writes NotificationLog)
  index.ts       — public re-exports

app/notifications/
  page.tsx               — server: load prefs + history
  NotificationsView.tsx  — client: preference toggles, history, manual triggers

app/api/notifications/
  preferences/route.ts   — GET/POST user preferences
  send-digest/route.ts   — POST: trigger digest for current user
  send-test/route.ts     — POST: send test email to current user

prisma/
  schema.prisma                    — NotificationPreference + NotificationLog models
  migrations/add_notifications.sql — SQL to apply in Neon console
```

**Data flow separation:**
- Templates know nothing about the DB.
- Generator knows nothing about email sending.
- Delivery knows nothing about alert detection.
- Preferences are stored independently of templates and delivery.

---

## Limitations of v1

1. **No scheduled delivery** — digest and immediate alerts are on-demand only.
   Add a cron route + Vercel Cron Jobs to automate in the next step.
2. **Email only** — Slack, SMS, webhooks not wired.
3. **Per-user, not per-client** — no per-client notification routing yet.
4. **No digest time setting** — users cannot set a preferred delivery time.
5. **No unsubscribe link** — preferences must be managed on `/notifications`.
6. **Dedup resets on rejection** — if an alert is rejected and re-triggered, a new
   notification will be sent.

---

## What comes next

- **Cron-based delivery**: `POST /api/notifications/cron-digest` on a Vercel Cron schedule
- **Slack integration**: add `slack` to `NotificationChannel`, add `slackWebhookUrl` to preferences
- **Per-client routing**: notify different users for different client accounts
- **Immediate alert auto-trigger**: run alert check on the automation evaluation cycle
