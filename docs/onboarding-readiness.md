# Account Onboarding & Readiness Checks

## How Onboarding Works

The onboarding flow lives at `/accounts/new` and provides a complete path from account creation to go-live confirmation.

### Flow

1. **Create Account** — Set name, brand, timezone, and currency
2. **Connect Integrations** — Link Meta and Shopify at the workspace level
3. **Map Integrations** — Assign specific Meta ad accounts and Shopify stores to the client
4. **Configure Attribution** — Verify timezone and attribution window settings
5. **Configure Goals** — Set ROAS/CPA targets (optional — system defaults apply)
6. **Run First Sync** — Import campaign and order data
7. **Go-Live Review** — Verify all checks pass, resolve blockers

### Architecture

- **Types**: `types/onboarding.ts` — all typed models
- **Evaluators**: `lib/onboarding/evaluator.ts` — pure functions, no DB calls
- **Checklist**: `lib/onboarding/checklist.ts` — deterministic checklist builder
- **Data Layer**: `lib/onboarding/data.ts` — single data fetching entry point
- **UI**: `app/accounts/new/` — server page + client view component

The evaluator functions are pure and testable — they take pre-fetched data and return typed results. The data layer collects all needed data in parallel, then passes it to evaluators.

## Readiness Checks

| Check | Category | Required | What it verifies |
|-------|----------|----------|-----------------|
| Client account created | Account | Yes | Client exists in workspace |
| Meta connected | Integration | Yes | Meta OAuth connection at workspace level |
| Meta mapped | Integration | Yes | Meta ad account assigned to this client |
| Shopify connected | Integration | Yes | Shopify OAuth connection at workspace level |
| Shopify mapped | Integration | Yes | Shopify store assigned to this client |
| Timezone configured | Attribution | Yes | Ad account timezone is set |
| Attribution window | Attribution | Yes | 7-day window (always passes — product rule) |
| First sync completed | Sync | Yes | At least one successful sync run |
| Data flowing | Sync | Yes | Recent sync was successful |
| Performance goals | Goals | No | Client-level ROAS/CPA targets set |
| No emergency stops | Governance | No | No active stops blocking automation |

## Go-Live Requirements

An account is **ready for go-live** when:

1. Meta is connected AND mapped to the client
2. Shopify is connected AND mapped to the client
3. Timezone is configured
4. At least one sync has completed successfully
5. Data is flowing (last sync was not failed)

Optional but recommended:
- Client-level ROAS/CPA goals configured
- No active emergency stops

## Readiness States

| State | Meaning |
|-------|---------|
| `not_started` | No required checks pass yet |
| `in_progress` | Some checks pass, work remains |
| `blocked` | A sync failure or critical issue prevents progress |
| `needs_review` | All required checks pass but optional items need attention |
| `ready_for_go_live` | All required checks pass |
| `live` | Account is syncing and data is flowing |

## How Blockers Are Resolved

Each blocker includes:
- **Category** — which readiness dimension it belongs to
- **Message** — human-readable description
- **Severity** — `required` (must fix) or `optional` (recommended)
- **Action** — CTA label and link to the resolution page

Blockers are resolved by completing the action they describe:
- **Integration blockers** — Connect or map the missing integration
- **Sync blockers** — Run a sync or retry a failed sync
- **Attribution blockers** — Configure timezone in client settings
- **Goal blockers** — Set ROAS/CPA targets in client settings
- **Governance blockers** — Clear emergency stops or review governance settings

## Current Limitations

1. **No automatic go-live** — Accounts are not automatically launched. Go-live is an informational status.
2. **Goals are optional** — System defaults (ROAS 2.0x) apply when no client goals are set.
3. **Governance checks are advisory** — Emergency stops and overrides are shown but don't block go-live.
4. **Single-workspace scope** — Readiness checks operate within the current workspace only.
5. **No approval routing check** — Approval routing defaults are always available (governance system handles this).
6. **No mapping validation** — The system checks that mappings exist but does not verify the mapped accounts are correct.

## Product Rules

- **CRM is the source of truth** for ROAS and CPA
- **Attribution window** is 7 days
- **Dayparting** uses the ad account timezone
- **Meta** is used for delivery analysis and operational execution
- **Shopify/CRM** is used for source-of-truth business outcomes
