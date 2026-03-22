# Daily Morning Brief System

## Overview

The Daily Morning Brief delivers a concise, decision-first digest every morning that shows:
- Yesterday's performance KPIs (CRM/Shopify source of truth)
- Accounts needing attention (at risk, critical)
- Winners ready to scale
- Losers needing creative refresh
- Blocked actions requiring resolution
- Top recommended next actions

## Architecture

```
types/dailyBrief.ts           — Pure type definitions
lib/dailyBrief/aggregator.ts  — Assembles brief from existing data sources
lib/dailyBrief/scheduler.ts   — Timezone-aware scheduling + dedup + persistence
lib/dailyBrief/deliver.ts     — In-app save + email delivery pipeline
lib/dailyBrief/emailTemplate.ts — HTML + plain-text email template
app/api/daily-brief/route.ts  — POST (generate) + GET (list) endpoints
app/briefs/                   — In-app brief viewer UI
```

### Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| **Aggregator** | Data assembly only. Composes `buildDailyExecutiveSummary()`, `buildDailyOutcomeSummary()`, and `buildDigestContent()`. No side effects. |
| **Scheduler** | Timezone window computation, dedup checks, brief persistence. No email sending. |
| **Delivery** | In-app save + email dispatch. Uses existing `sendEmail()` and `NotificationLog`. |
| **Template** | Pure HTML/text rendering. No DB access. |
| **API** | Auth-gated trigger + retrieval. |
| **UI** | Client-side rendering of brief data. |

## Data Sources

The brief aggregator reuses three existing aggregators:

1. **`buildDailyExecutiveSummary()`** — Portfolio KPIs, client summaries, status, risk, trend
2. **`buildDailyOutcomeSummary()`** — Winner/loser/scale/refresh/retest highlights from `CreativeOutcomeRouteRecord`
3. **`buildDigestContent()`** — Alerts, pacing issues, stale syncs, missing goals

All data originates from CRM/Shopify (ROAS, CPA) and Meta (delivery, spend).

## Sections Displayed

### In-App Brief (`/briefs`)

1. **Summary bar** — Spend, Revenue, ROAS, CPA, status pills
2. **Top-line message** — "2 at risk, 3 ready to scale"
3. **Top Actions** — Prioritised action items with readiness dots (green/amber/red)
4. **Winners** — Test winners with lift %, scale-ready badge
5. **Need Refresh** — Losers with refresh queue status
6. **Accounts** — Accounts needing attention (critical/at-risk/scaling)
7. **Blocked** — Stale syncs, missing goals, pending approvals
8. **Quick links** — Command Center, Creative Lab, Pacing, Alerts
9. **Archive** — Navigate to previous briefs

### Email Brief

Same sections as in-app, rendered as inline-styled HTML for email client compatibility.
Includes CTA buttons to open full brief in-app.

## Action Readiness

Each action item has an explicit readiness state:

| State | Meaning | Visual |
|-------|---------|--------|
| `ready` | Action can be taken now | Green dot |
| `blocked` | Action blocked by prerequisite | Red dot |
| `needs_review` | Requires human review first | Amber dot |

Blocker notes explain why an action is blocked (e.g., "Stale sync — data may be unreliable").

## Scheduling

### Timezone-Aware Delivery

- Each workspace has a timezone (default: `America/New_York`)
- Brief covers "yesterday" in the account's local timezone
- Generation targets 7 AM local time
- `isWithinMorningWindow()` checks if current time is within ±1 hour of target

### Deduplication

- `hasBriefForDate()` checks `DailyBriefRecord` for existing brief
- Email deduplication via `NotificationLog.deduplicationKey`: `daily_brief:{userId}:{briefDate}`
- Manual regeneration supported via `force=true` query param

### Delivery Pipeline

```
1. Check dedup (skip if already generated)
2. Build brief via aggregator
3. Save to DailyBriefRecord (in-app)
4. For each opted-in user:
   a. Check email dedup
   b. Build email template
   c. Create NotificationLog (pending)
   d. Send via SMTP
   e. Update NotificationLog (sent/failed/skipped)
5. Update DailyBriefRecord delivery state
```

## API Endpoints

### POST /api/daily-brief

Generate a new brief.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `timezone` | query | America/New_York | IANA timezone for the brief |
| `force` | query | false | Skip dedup check |

### GET /api/daily-brief

Load recent briefs.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | query | 30 | Max briefs to return (max 100) |

## Database

### DailyBriefRecord

```
id            — cuid primary key
workspaceId   — nullable workspace scope
briefDate     — YYYY-MM-DD (the date being reported)
timezone      — IANA timezone
deliveryState — pending | generated | delivered_in_app | delivered_email | failed | skipped
briefJson     — Full DailyMorningBrief as JSON (TEXT column)
retryCount    — Number of delivery retries
lastError     — Last error message
deliveredAt   — Timestamp of successful delivery
createdAt     — Record creation time
```

Unique constraint: `(workspaceId, briefDate)` — one brief per workspace per day.

## Integration Points

| System | Integration |
|--------|------------|
| **Daily Dashboard** | Brief reuses same data via `buildDailyExecutiveSummary()` |
| **Command Center** | Quick link from brief; shares outcome data |
| **Creative Lab** | "Send to Creative Lab" actions for losers |
| **Experiment Results** | Winner/loser highlights from `CreativeOutcomeRouteRecord` |
| **Scale Review** | "Review scale plan" actions for scale-ready winners |
| **Action History** | Email delivery logged to `NotificationLog` |
| **Notification Preferences** | Respects `dailyDigest` user preference |

## Safe Handling

| Scenario | Behavior |
|----------|----------|
| No data yesterday | Shows "No data" message with link to Data Health |
| Low-trust data | Trust banner with warning message |
| Sparse accounts | Shows only actionable accounts (critical/at-risk/scaling) |
| Failed email | Logged to NotificationLog with error; retry available |
| Duplicate generation | Skipped (returns `{ status: "skipped" }`) |
| Timezone ambiguity | Defaults to America/New_York; accepts any IANA timezone |
| No recent tests | Winners/losers sections hidden when empty |
| Missing goals | Blocked item shown with link to client settings |

## Current Limitations

1. **No automated cron** — Brief generation must be triggered via API call or manual button. A cron job or Vercel cron should be added to call POST `/api/daily-brief` at the appropriate time.
2. **Single workspace timezone** — All accounts in a workspace share one timezone. Per-account timezone support can be added later.
3. **No Slack/webhook delivery** — Email only for v1. Slack integration planned.
4. **No weekly rollup** — Daily only. Weekly summary is a planned follow-up.
5. **Brief archive limited to 30** — Older briefs are not automatically cleaned up.
