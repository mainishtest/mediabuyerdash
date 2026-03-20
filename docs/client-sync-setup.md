# Client-Scoped Sync Setup

## What a client-scoped sync does

A client-scoped sync pulls live data from the data sources mapped to a specific client account:

- **Meta sync** — fetches campaigns, ad sets, ads, creatives, and the last 7 days of ad-level insights for all Meta ad accounts mapped to that client.
- **Shopify sync** — fetches the last 30 days of orders and line items from the Shopify store mapped to that client.
- **Full sync** — runs both Meta and Shopify in sequence.

Synced data is scoped to the client via the `externalAdAccountId` and `clientAccountId` fields in the Meta and Shopify tables. Each run is recorded in `ClientSyncRun` with step-level detail in `ClientSyncRunStep`.

---

## Required client mappings before sync

Before running a sync for a client, both of the following must be configured:

1. **Meta ad account mapped** — at least one `MetaSelectedAdAccount` with `clientAccountId` set to this client's ID, and the parent `MetaConnection` must have `connectionStatus = "active"`.
2. **Shopify store mapped** — one `ShopifyConnection` with `clientAccountId` set to this client's ID and `connectionStatus = "active"`.

These are configured from the "Client Integrations" section on the client detail page (`/clients/[clientId]`).

If a required mapping is missing or a connection is inactive, the Sync Status section displays a blocker message. The corresponding sync buttons are disabled until the issue is resolved.

---

## Sync types supported

| Type     | Description |
|----------|-------------|
| `meta`   | Syncs Meta ad hierarchy + last 7 days of insights for this client's mapped accounts. |
| `shopify`| Syncs last 30 days of Shopify orders and line items for this client's mapped store. |
| `full`   | Runs Meta sync, then Shopify sync. |

---

## What data is brought in during this first version

### Meta (per mapped ad account)
- Campaigns (`MetaSyncedCampaign`) — name, status, objective, buying type
- Ad Sets (`MetaSyncedAdSet`) — name, status, campaign reference
- Ads (`MetaSyncedAd`) — name, status, creative reference
- Creatives (`MetaSyncedCreative`) — name, title, body, call to action, image/thumbnail URLs
- Insights (`MetaSyncedInsight`) — last 7 days at ad level: spend, impressions, clicks, CTR, CPM, frequency

> Attribution window: 7 days (product requirement). Insights are always fetched for a rolling 7-day window and replaced on each sync.
> Timezone: insights use the ad account's timezone as set in Meta (stored in `MetaAccessibleAdAccount.timezoneName`).

### Shopify (per mapped store)
- Orders (`ShopifyOrder`) — last 30 days: order number, created date, total price, UTM parameters, customer email
- Order line items (`ShopifyOrderLineItem`) — product ID, variant ID, SKU, title, quantity, price

> Shopify is the CRM source of truth for ROAS and CPA (product requirement). Meta delivery data is used for delivery analysis only.

---

## Sync run tracking

Every sync run creates:

- `ClientSyncRun` — one record per triggered sync with `syncType`, `status`, `startedAt`, `completedAt`, and optional `errorMessage`.
- `ClientSyncRunStep` — one record per data source synced (e.g. `meta_account`, `shopify_orders`) with `summaryJson` containing row counts.

**Statuses:**
| Status      | Meaning |
|-------------|---------|
| `running`   | Sync is in progress |
| `completed` | All steps succeeded |
| `partial`   | Some steps succeeded, some failed |
| `failed`    | All steps failed or could not start |

Run history is viewable at `/clients/[clientId]/sync`.

---

## What comes next

This step delivers the sync execution layer and visibility. The following steps will build on top of it:

1. **Client-scoped reconciliation** — match Meta spend (from `MetaSyncedInsight`) against Shopify revenue (from `ShopifyOrder`) using UTM dimensions, producing `ReconciliationMatch` and `ReconciliationSummary` records scoped to the client.
2. **Live client dashboard metrics** — a client-level metrics page showing evaluated ROAS and CPA using CRM as source of truth, after reconciliation runs.
3. **Sync scheduling** — background job to run syncs on a configurable cadence per client.
4. **Incremental sync** — currently syncs a fixed rolling window. Future: only fetch data newer than the last successful sync.

---

## Running migrations

After deploying this update, run:

```bash
npx prisma migrate deploy
```

This applies `20250316000000_add_client_sync_models`, which creates the `ClientSyncRun` and `ClientSyncRunStep` tables.
