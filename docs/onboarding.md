# Account Onboarding, Readiness Checks, and Go-Live Flow

## Overview

The onboarding system provides a structured path from account creation to operational readiness. Every new client account goes through a set of deterministic readiness checks before being considered ready to operate.

The system is split into:
- **Readiness evaluation** — pure DB reads that assess each dimension
- **Checklist generation** — deterministic, testable, derived from evaluations
- **Go-live summary** — a single assembled object used by the UI and API
- **UI** — mobile-first readiness view per account

---

## Routes

| Route | Description |
|---|---|
| `/onboarding` | Hub — shows first-time setup or account readiness list |
| `/onboarding/[clientId]` | Per-client readiness page with full checklist and go-live status |
| `GET /api/onboarding/[clientId]` | JSON endpoint returning `GoLiveSummary` |

---

## Readiness States

| State | Meaning |
|---|---|
| `not_started` | No setup has begun |
| `in_progress` | Some items complete, work underway |
| `blocked` | Critical blockers present — cannot go live |
| `needs_review` | All required items done, warnings remain |
| `ready_for_go_live` | All checks pass, no blockers |
| `live` | Account is actively operating |

---

## Readiness Checks

### Required (blocks go-live if missing)

| Check | What is verified |
|---|---|
| Client account created | Account exists in the database |
| Timezone confirmed | Timezone is explicitly set (not just default) |
| Meta ad account connected | At least one MetaSelectedAdAccount linked |
| Meta connection active | Connection status is "active" |
| Shopify store connected | ShopifyConnection exists for this client |
| Shopify connection active | Shopify connection status is "active" |
| Shopify orders imported | At least one sync has completed and orders exist |
| Default goals set | ClientGoalDefaults exists with ROAS and CPA targets |
| Meta sync healthy | Last ClientSyncRun of type "meta" or "full" completed successfully |
| Shopify sync healthy | Last ClientSyncRun of type "shopify" or "full" completed successfully |

### Optional (shown but don't block go-live)

| Check | What is verified |
|---|---|
| Max daily spend cap | ClientGoalDefaults.maxDailySpend is set |
| Auto-execution configured | AutoExecutionSettings exists for the client |

---

## Product Rules Encoded

- **CRM source of truth**: Shopify is required for ROAS and CPA — missing Shopify is a critical blocker
- **Attribution window**: Fixed at 7 days — shown as always complete
- **Dayparting timezone**: Must match ad account timezone — timezone check is required
- **Meta for delivery**: Meta connection is required for operational execution

---

## Architecture

```
lib/onboarding/
  index.ts          — re-exports
  readiness.ts      — evaluateIntegrationReadiness(), evaluateSyncHealth(),
                      evaluateAttributionReadiness(), evaluateGoalSetupReadiness(),
                      evaluateGovernanceReadiness()
  checklist.ts      — buildOnboardingChecklist() — pure function, no DB calls
  summary.ts        — buildGoLiveSummary() — assembles everything

types/onboarding.ts — GoLiveSummary, OnboardingBlocker, OnboardingChecklistItem,
                      IntegrationReadiness, SyncHealthStatus, AttributionReadiness,
                      GoalSetupReadiness, GovernanceReadiness, OnboardingReadinessStatus

app/onboarding/
  page.tsx                          — hub (first-time setup or account list)
  OnboardingView.tsx                — first-time client creation form
  [clientId]/page.tsx               — per-client readiness page
  [clientId]/OnboardingReadinessView.tsx — readiness UI

app/api/onboarding/[clientId]/route.ts — GET /api/onboarding/[clientId]
```

---

## Blocker Resolution

| Blocker | Resolution |
|---|---|
| No Meta ad account linked | Go to /integrations → connect Meta → select ad account |
| Meta connection not active | Go to /integrations → reconnect Meta |
| No Shopify store connected | Go to /integrations → connect Shopify |
| Shopify connection not active | Go to /integrations → reconnect Shopify |
| Shopify orders not synced | Go to the client account page → run Shopify sync |
| No default goals | Go to the client account page → configure goals |
| Meta sync failing | Go to the client account page → retry sync, check error log |
| Shopify sync failing | Go to the client account page → retry sync, check error log |
| Timezone not confirmed | Go to the client account page → update timezone |

---

## Sync Health Thresholds

- **Healthy**: Last completed sync within 24 hours
- **Stale**: Last completed sync more than 24 hours ago
- **Failed**: Last sync run ended with status "failed"
- **Never**: No sync run found

---

## Current Limitations

- Governance check only verifies `AutoExecutionSettings` existence — approval routing is not yet a separate model
- Sync health uses `ClientSyncRun` records — if no sync has been triggered via the client flow, health will show "never" even if workspace-level syncs ran
- The `/onboarding` hub links to readiness but does not show live readiness status inline (status is loaded per-client on the detail page)
- Legacy accounts created before this system may show warnings on optional checks — this is expected and does not block go-live
