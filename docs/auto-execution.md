# Guarded Auto-Execution Foundation

## What this is

The auto-execution layer lets the system take a narrow set of real actions
against live ad accounts — without requiring a human to click "Approve" for
each one — after a chain of guardrail checks pass.

**v1 scope:** `run_sync` and `pause_campaign` only.
All other action types (reduce_budget, increase_budget, etc.) remain
human-approval-only and are never auto-executed.

---

## Guardrails (evaluated before every execution)

| # | Name | Description |
|---|---|---|
| 1 | `action_type_eligible` | Only `run_sync` and `pause_campaign` are eligible in v1 |
| 2 | `client_enabled` | Auto-execution must be enabled for the client (off by default) |
| 3 | `action_type_allowed` | The specific action type must be permitted in per-client settings |
| 4 | `action_approved` | The proposed action must have `approved` status (human-approved) |
| 5 | `not_already_executed` | Action must not have already been executed |
| 6 | `daily_cap` | Today's execution count must be below `maxDailyExecutions` |
| 7 | `cooldown` | Entity must not have been acted on in the last 24 hours |

If any guardrail fails, the execution is **blocked** or **skipped** (not
attempted) and the result is logged with the full guardrail outcome list.

---

## Per-client settings

| Setting | Default | Description |
|---|---|---|
| `enabled` | `false` | Master switch — auto-execution will not run for this client unless on |
| `allowRunSync` | `true` | Permit automatic data syncs when enabled |
| `allowPauseCampaign` | `false` | Permit automatic campaign pausing — requires extra opt-in |
| `maxDailyExecutions` | `5` | Hard cap on executions per day per client |
| `maxSpendThreshold` | `500` | Pause: campaign must have spent ≥ this amount (USD) recently |
| `minRoasThreshold` | `0.4` | Pause: ROAS must be ≤ goal × this factor |

Settings are created with defaults on first access and can be updated via the
UI at `/automation/auto-execution` or via `POST /api/auto-execution/settings/{clientId}`.

---

## pause_campaign rule thresholds

The `evaluatePauseCampaignRule` in `lib/automation/rules.ts` proposes a
`pause_campaign` action when **all** of the following are true:

- Campaign is `ACTIVE`
- Campaign has a ROAS goal set
- Recent 7-day spend ≥ **$200**
- Calculated ROAS ≤ goal × **0.40** (i.e. earning less than 40% of target)

These thresholds are stricter than `reduce_budget` (which triggers at 60% of
goal) to ensure only critically under-performing campaigns are auto-paused.

---

## Architecture

```
lib/autoExecution/
  types.ts        — AutoExecutionStatus, GuardrailResult, Decision,
                    SettingsRow, LogRow, RunSummary
  persist.ts      — getOrCreateAutoExecutionSettings(), updateAutoExecutionSettings(),
                    loadAllAutoExecutionSettings(),
                    logAutoExecutionRun(), loadAutoExecutionHistory(),
                    countTodayExecutions(), getLastExecutionForEntity()
  eligibility.ts  — evaluateAutoExecutionEligibility() (7 guardrails)
  executor.ts     — runEligibleAutoExecutions(), executeRunSync(),
                    executePauseCampaign()
  index.ts        — public re-exports

lib/meta/
  write.ts        — pauseMetaCampaign() (Graph API v20.0 POST)

lib/automation/
  rules.ts        — evaluatePauseCampaignRule() (new rule, stricter thresholds)

app/automation/auto-execution/
  page.tsx              — server: load settings + history
  AutoExecutionView.tsx — client: per-client toggles, run now, history

app/api/auto-execution/
  run/route.ts                      — POST: trigger a run for the workspace
  settings/[clientId]/route.ts      — GET: load settings; POST: update settings

prisma/
  schema.prisma                    — AutoExecutionSettings + AutoExecutionLog models
  migrations/add_auto_execution.sql — SQL to apply in Neon console
```

---

## Running the SQL migration

Run the following in your Neon SQL console (or any PostgreSQL client):

```
prisma/migrations/add_auto_execution.sql
```

This creates:
- `AutoExecutionSettings` — per-client opt-in settings
- `AutoExecutionLog` — audit trail for every execution attempt

---

## How execution works

```
1. POST /api/auto-execution/run (or click "Run Now" on /automation/auto-execution)
2. runEligibleAutoExecutions(workspaceId)
   - load all approved proposed actions with actionType in [run_sync, pause_campaign]
   - for each action:
     a. getOrCreateAutoExecutionSettings(clientAccountId)
     b. evaluateAutoExecutionEligibility(action, settings) → 7 guardrails
     c. if not eligible → log with status=guardrail_blocked|skipped, continue
     d. if eligible → execute action
        - run_sync: runMetaSyncForAccounts(adAccounts, connectionId, workspaceId)
        - pause_campaign: pauseMetaCampaign(externalCampaignId, accessToken)
     e. if success → mark proposed action as "executed"
     f. log outcome with durationMs
3. Return AutoExecutionRunSummary
```

---

## Limitations of v1

1. **On-demand only** — no cron schedule. Add a Vercel Cron Job at
   `/api/auto-execution/run` to automate.
2. **Meta only** — `pause_campaign` only works for Meta (Facebook) campaigns.
3. **No per-user approval** — any workspace member can trigger a run.
4. **No Slack/email notification on execution** — logs are in-app only.
5. **No rollback** — pausing is one-way; un-pausing requires Ads Manager.

---

## What comes next

- **Cron-based auto-execution**: Vercel Cron Job calling `POST /api/auto-execution/run`
- **Execution notifications**: email/Slack alert when auto-execution fires
- **Un-pause action**: `resume_campaign` with similar guardrails
- **Additional action types**: `reduce_budget` with conservative thresholds
- **Multi-platform**: Shopify/TikTok/Google Ads adapters
