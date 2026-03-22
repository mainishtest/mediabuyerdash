# Shopify Store Connection & Revenue Sync Setup

## Environment Variables

```
SHOPIFY_APP_KEY=<your-shopify-app-api-key>
SHOPIFY_APP_SECRET=<your-shopify-app-secret>
SHOPIFY_REDIRECT_URI=https://your-domain.com/api/auth/shopify/callback
CRON_SECRET=<random-secret-for-cron-endpoints>
```

### Getting Shopify Credentials

**Method 1: Shopify Partners (OAuth)**
1. Go to [Shopify Partners](https://partners.shopify.com) → Apps → Create app
2. Set redirect URL to match `SHOPIFY_REDIRECT_URI`
3. Request scopes: `read_orders`, `read_customers`
4. Copy API key and API secret

**Method 2: Custom App (Client Credentials)**
1. In Shopify admin → Settings → Apps and sales channels → Develop apps
2. Create a custom app
3. Configure API scopes: `read_orders`, `read_customers`
4. Install the app on the store
5. Copy Client ID and Client Secret from the app settings
6. Use the "Client Credentials" tab on `/integrations/shopify`

## Connection Flow

### OAuth Flow
```
User enters shop domain + clicks "Connect via OAuth" →
  Server normalizes domain →
  Sets CSRF cookies (state, shop, optional clientId) →
  Redirects to https://{shop}/admin/oauth/authorize →
    User approves in Shopify admin →
    Shopify redirects to GET /api/auth/shopify/callback →
      Validates CSRF state, shop domain, HMAC signature →
      Exchanges code for permanent access token →
      Stores ShopifyConnection record →
      Redirects to /integrations/shopify?connected=1
```

### Client Credentials Flow
```
User enters shop domain + Client ID + Client Secret →
  POST connectShopifyClientCredentialsAction() →
    Exchanges credentials for access token →
    Verifies token against /admin/api/shop.json →
    Stores ShopifyConnection record →
    Redirects to /integrations/shopify?connected=1
```

## Connected Store Storage

`ShopifyConnection` model:
| Field | Type | Purpose |
|-------|------|---------|
| `id` | String | Primary key |
| `shopDomain` | String (unique) | Store identifier |
| `accessToken` | String | Permanent access token |
| `connectionStatus` | String | "active" / "disconnected" / "error" |
| `scopes` | String? | Granted API scopes |
| `workspaceId` | String? | Workspace association |
| `clientAccountId` | String? | Client account mapping |
| `installedAt` | DateTime | When the app was installed |

## Revenue Sync

### What Gets Synced
| Entity | Source | DB Table |
|--------|--------|----------|
| Orders | GraphQL `orders` query | ShopifyOrder |
| Line Items | Embedded in orders | ShopifyOrderLineItem |
| Refunds | Embedded in orders (`refunds` field) | ShopifyRefund |
| UTM Data | `customerJourneySummary.firstVisit.utmParameters` | Fields on ShopifyOrder |
| Order Status | `displayFinancialStatus`, `displayFulfillmentStatus` | Fields on ShopifyOrder |

### Revenue Normalization (Source of Truth for ROAS/CPA)
- `netRevenue = totalPrice - refundTotal` (computed per order on sync)
- `refundTotal = sum(ShopifyRefund.refundAmount)` per order
- Cancelled orders have `cancelledAt` set — excluded from active revenue
- Financial status tracked: `paid`, `partially_refunded`, `refunded`, `pending`, `voided`
- Use `netRevenue` (not `totalPrice`) for all ROAS/CPA calculations
- Revenue normalization utilities: `lib/shopify/revenueNormalization.ts`

### Sync Strategy
- **Backfill sync**: Last 90 days of orders (mode: `backfill`)
- **Incremental sync**: 1 day before latest synced order (mode: `incremental`, default)
- **Manual retry**: Via API or UI trigger
- **Pagination**: Cursor-based, streams page-by-page to limit memory
- **Upsert**: Orders matched by `(shopifyConnectionId, externalOrderId)`
- **Refund upsert**: Matched by `(shopifyOrderId, externalRefundId)` — append-only, never deleted
- **Idempotent**: Safe to re-run; upserts ensure no duplicates

### Sync Modes
| Mode | Window | Trigger |
|------|--------|---------|
| `incremental` | Since 1 day before latest order (fallback: 30 days) | Cron every 5 min |
| `backfill` | Last 90 days | Manual trigger only |

### Webhook Support
Webhooks provide real-time ingestion alongside scheduled polling:
| Topic | Handler | What happens |
|-------|---------|-------------|
| `orders/create` | Upsert order + line items + refunds | New order ingested immediately |
| `orders/updated` | Upsert order + line items + refunds | Order status/refund changes captured |
| `refunds/create` | Upsert refund, recompute `netRevenue` | Refund-adjusted revenue updated in real-time |

Webhook registration: Configure in Shopify admin → Settings → Notifications → Webhooks.
Set URL: `https://your-domain.com/api/webhooks/shopify`

### Revenue Sync States
| State | Meaning |
|-------|---------|
| `not_started` | No sync has ever run |
| `initializing` | Sync currently in progress |
| `healthy` | Last sync completed successfully within 48 hours |
| `partial` | Last sync completed with some errors |
| `stale` | Last successful sync was >48 hours ago |
| `failed` | Last sync failed completely |

### Sync Health Evaluation
- `evaluateShopifySyncHealth()` checks last sync log timestamp
- Stale threshold: 48 hours
- Health status shown on integration page and onboarding wizard
- Sync logs include: orders synced, line items synced, refunds synced, errors

## Connection States
| State | Meaning |
|-------|---------|
| `not_connected` | No ShopifyConnection exists |
| `connecting` | OAuth in progress |
| `connected` | Active connection with valid token |
| `setup_incomplete` | Connected but no sync has run |
| `sync_initializing` | First sync starting |
| `syncing` | Sync in progress |
| `sync_error` | Last sync failed |
| `disconnected` | Connection inactive/removed |

## Onboarding Integration

The onboarding wizard step (`connect_shopify_placeholder`) shows:
- Connection status with store domain
- Setup checklist (configured → connected → synced → healthy)
- Direct link to `/integrations/shopify` for connection
- Link to sync status page

## Data Flow to Dashboard

```
ShopifyOrder (with UTM parameters + refund-adjusted netRevenue)
  → ReconciliationSummary aggregates CRM netRevenue by date
  → Dashboard queries totalCrmRevenue (net), totalCrmOrders
  → ROAS = totalCrmNetRevenue / totalMetaSpend (CRM is source of truth)
  → CPA = totalMetaSpend / totalCrmOrders
```

Revenue summary utilities in `lib/shopify/revenueNormalization.ts`:
- `getConnectionRevenueSummary(connectionId, since?)` — per-connection aggregation
- `getClientAttributedRevenue(clientAccountId, since?)` — per-client with Facebook attribution
- `recomputeOrderNetRevenue(orderId)` — recompute after refund webhook

## Key Files

| File | Purpose |
|------|---------|
| `lib/shopify/config.ts` | Environment variable validation |
| `lib/shopify/auth.ts` | OAuth URL, token exchange, HMAC verify |
| `lib/shopify/db.ts` | Connection CRUD |
| `lib/shopify/sync.ts` | Sync orchestrator (incremental + backfill) |
| `lib/shopify/syncDb.ts` | Order/line-item/refund DB writes |
| `lib/shopify/api.ts` | Shopify GraphQL API client |
| `lib/shopify/mappers.ts` | Raw → Prisma-ready type conversion |
| `lib/shopify/types.ts` | Typed state models |
| `lib/shopify/integrationState.ts` | State computation utilities |
| `lib/shopify/revenueNormalization.ts` | Revenue aggregation + refund normalization |
| `app/api/auth/shopify/callback/route.ts` | OAuth callback handler |
| `app/api/cron/sync-shopify/route.ts` | Cron sync endpoint (every 5 min) |
| `app/api/shopify/retry-sync/route.ts` | Manual retry endpoint |
| `app/api/shopify/sync-status/route.ts` | Sync status endpoint |
| `app/api/webhooks/shopify/route.ts` | Webhook handler (orders + refunds) |
| `app/integrations/shopify/` | Integration UI |

## Safe Handling

| Scenario | Handling |
|----------|---------|
| No recent orders | Incremental falls back to 30-day window |
| Sparse stores | Empty pages skipped, no error |
| Duplicate orders | Upsert by `(connectionId, externalOrderId)` |
| Refunds after original ingestion | Refund upsert + `recomputeOrderNetRevenue()` |
| Partial failures | Per-order try/catch, sync continues, errors logged |
| Disconnected store | Connection marked "error", UI shows reconnect prompt |
| Stale tokens | 401/403 detected, connection marked invalid |
| Pagination issues | Cursor-based with max retries on 429/5xx |

## Current Limitations

1. **Access tokens stored plaintext** — should be encrypted in production
2. **Single connection per workspace** — last connection wins
3. **No token refresh needed** — Shopify tokens are permanent until revoked
4. **GraphQL API version**: `2024-10` — update in `lib/shopify/config.ts`
5. **Attribution window v1**: Exact date match only (v2 planned for full 7-day window)
6. **Webhook UTM gap**: Webhook payloads don't include `customerJourneySummary`; UTM data filled by next cron sync
