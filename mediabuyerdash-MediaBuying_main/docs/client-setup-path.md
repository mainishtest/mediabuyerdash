# Client Setup Path

Route: `/clients/[clientId]/setup`

This page guides users through bringing a new client from empty state to a live dashboard. It orchestrates the existing setup pages without replacing them.

---

## How It Works

The setup path is a read-only evaluation layer on top of existing app state. It:

1. Loads the client from the database
2. Fetches integration status (`getClientIntegrationStatus`) and sync history (`getClientSyncStatusSummary`) in parallel
3. Passes both to the pure evaluator (`evaluateClientSetup`) which returns a `ClientSetupSummary`
4. Renders the summary in `ClientSetupView` with progress, step cards, and a next-action banner

No new database tables, no new server actions. The setup page reuses all existing lib functions and the existing `runClientSyncAction` server action.

---

## Setup Steps

| # | Step | Completion criteria |
|---|------|---------------------|
| 1 | **Create Client** | Client record exists in database |
| 2 | **Connect Meta** | At least one `MetaSelectedAdAccount` exists in the workspace (OAuth has been completed and an account selected) |
| 3 | **Connect Shopify** | At least one `ShopifyConnection` exists in the workspace |
| 4 | **Map Integrations** | This client has at least one Meta account mapped (`metaState === "mapped"`) AND a Shopify store mapped (`shopifyState === "mapped"`) |
| 5 | **Run First Sync** | At least one `ClientSyncRun` record exists for this client with status `completed` or `partial` |
| 6 | **Dashboard Ready** | Same as Run First Sync (extensible: can check for metric rows in future) |

Steps are **sequential** — a step is `current` only when all prior steps are `complete`. A step is `pending` when an earlier step is still incomplete.

---

## Readiness Determination

The evaluator (`lib/clientSetup/evaluator.ts`) returns a `readinessLabel`:

| State | Label |
|-------|-------|
| All 6 steps complete | `"Live"` |
| Steps 1–4 complete (integrations mapped) | `"Ready for sync"` |
| Partial progress | `"N/6 complete"` |

The `isLive` flag is `true` when `dashboardReady` — meaning a successful sync has been run. The setup page shows a success state and links to the dashboard.

---

## What "Live" Means

A client is considered **live** when:

- The client account exists in the workspace
- Meta and Shopify are connected at the workspace level
- Both are mapped to this specific client
- At least one full sync has completed successfully

At this point, the client dashboard (`/clients/[clientId]`) will show real synced metrics, campaign performance data, and optimization opportunities.

---

## Architecture

```
types/
  clientSetup.ts            — Pure type contracts (no imports from lib)

lib/
  clientSetup/
    evaluator.ts            — Pure function: data in → ClientSetupSummary out

app/
  clients/[clientId]/
    setup/
      page.tsx              — Server component: fetch → evaluate → render
      ClientSetupView.tsx   — Client component: layout + sync trigger
      SetupStepCard.tsx     — Presentational step card
```

### Key design rules

- **`evaluator.ts` is a pure function** — takes pre-fetched data, returns a summary. No DB calls. Fully testable.
- **Setup orchestration is separate from sync internals** — the setup path does not touch Meta sync logic, Shopify sync logic, or reconciliation.
- **Reuses existing lib and actions** — `getClientIntegrationStatus`, `getClientSyncStatusSummary`, `runClientSyncAction` are all existing modules.
- **Does not replace existing pages** — each step links into the existing integration and client detail pages.

---

## Quick Links (Setup Page)

| Link | Destination |
|------|-------------|
| Connect Meta | `/integrations/meta` |
| Connect Shopify | `/integrations/shopify` |
| Map Integrations | `/clients/[clientId]#integrations` |
| Run / View Sync | `/clients/[clientId]#sync` |
| Sync History | `/clients/[clientId]/sync` |
| Campaigns | `/clients/[clientId]/campaigns` |

---

## Next Steps (Planned)

- Add a "Setup" link to the client card on `/clients`
- Add a "Setup Guide" link to the client detail header
- Add `metricsReady` step (checks for actual synced insight rows before marking live)
- Add stale-sync detection (last sync > 24h = warning state)
