# Shopify Integration Setup

## Overview

This integration connects a Shopify store to the Media Buying Dashboard using the Shopify Admin API (GraphQL). It ingests read-only order data including revenue, line items, and UTM attribution for the last 30 days.

---

## Required Environment Variables

Add these to `.env.local` (local development) and Vercel environment variables (production):

```env
SHOPIFY_APP_KEY=your_shopify_app_api_key
SHOPIFY_APP_SECRET=your_shopify_app_api_secret
SHOPIFY_REDIRECT_URI=https://yourdomain.com/api/auth/shopify/callback
```

**Local development:**
```env
SHOPIFY_REDIRECT_URI=http://localhost:3000/api/auth/shopify/callback
```

---

## Creating a Shopify App

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Click **Apps** → **Create app** → **Create app manually**
3. Fill in the app name (e.g. "Media Buying Dashboard")
4. Under **App setup → URLs**:
   - Allowed redirection URLs: `https://yourdomain.com/api/auth/shopify/callback`
   - For local testing: `http://localhost:3000/api/auth/shopify/callback`
5. Copy the **Client ID** → `SHOPIFY_APP_KEY`
6. Copy the **Client secret** → `SHOPIFY_APP_SECRET`

---

## Required API Scopes

The app requests these read-only scopes during OAuth:

| Scope            | Purpose                           |
|------------------|-----------------------------------|
| `read_orders`    | Fetch order revenue and line items |
| `read_customers` | Fetch customer IDs for attribution |

No write access is ever requested.

---

## Local Testing

1. Install [ngrok](https://ngrok.com) or use a similar tunnel:
   ```bash
   ngrok http 3000
   ```
2. Copy the HTTPS forwarding URL (e.g. `https://abc123.ngrok.io`)
3. Set:
   ```env
   SHOPIFY_REDIRECT_URI=https://abc123.ngrok.io/api/auth/shopify/callback
   ```
4. Add this URL to the Shopify app's allowed redirect URLs in the Partner Dashboard
5. Start the dev server and connect at `/integrations/shopify`

---

## OAuth Flow Summary

### Global flow (`/integrations/shopify`)
```
1. User enters shop domain
2. Server sets CSRF state cookie + shop domain cookie, redirects to Shopify OAuth
3. Shop owner approves → Shopify redirects to /api/auth/shopify/callback
4. Callback: verifies HMAC + state + shop, exchanges code for token, saves connection
5. Redirects to /integrations/shopify?connected=1
```

### Client-scoped flow (`/clients/[clientId]/integrations/shopify`)
```
1. User enters shop domain on the client detail Shopify page
2. Server sets CSRF state + shop + clientId cookies, redirects to Shopify OAuth
3. Same callback at /api/auth/shopify/callback
4. Callback reads clientId cookie → resolves workspaceId from DB
5. Saves ShopifyConnection with clientAccountId + workspaceId pre-populated
6. Redirects to /clients/[clientId]/integrations/shopify?connected=1
```

The `clientId` cookie is the only mechanism that links the OAuth flow to a specific client. It expires in 10 minutes alongside the CSRF cookies.

---

## What Is Synced (First Version)

**ShopifyOrder** (last 30 days):
- Order number, processed date, currency
- Total price, subtotal, tax, discount
- Customer ID (Shopify GID)
- UTM parameters: source, medium, campaign, content, term

**ShopifyOrderLineItem** (per order):
- Product ID, variant ID
- Title, quantity, unit price

**ShopifySyncLog**:
- Status (completed / partial / failed)
- Orders synced count, line items synced count
- Error messages (if any)
- Start and completion timestamps

---

## What Is NOT Yet Synced

- Products and variants (not needed yet)
- Customers PII (only ID is stored)
- Shopify Payments / payouts
- Fulfillments / shipping
- Refunds (future reconciliation step)
- Discount codes

---

## Database Setup

### Initial tables (run in Neon SQL editor if not yet created)
See `prisma/migrations/20250317000000_add_auth_tables/migration.sql`

### Shopify workspaceId fields (run after deploying this update)
```sql
-- From prisma/migrations/20250317000001_add_shopify_workspace/migration.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ShopifyConnection' AND column_name = 'workspaceId')
  THEN ALTER TABLE "ShopifyConnection" ADD COLUMN "workspaceId" TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ShopifyOrder' AND column_name = 'workspaceId')
  THEN ALTER TABLE "ShopifyOrder" ADD COLUMN "workspaceId" TEXT; END IF;
END $$;
CREATE INDEX IF NOT EXISTS "ShopifyConnection_workspaceId_idx" ON "ShopifyConnection"("workspaceId");
CREATE INDEX IF NOT EXISTS "ShopifyOrder_workspaceId_orderCreatedAt_idx" ON "ShopifyOrder"("workspaceId", "orderCreatedAt");
```

### Prisma schema models
- `ShopifyConnection` — one per store, scoped by workspaceId + clientAccountId
- `ShopifyOrder` — last 30 days, scoped by workspaceId + clientAccountId
- `ShopifyOrderLineItem` — line items per order
- `ShopifySyncLog` — audit log per sync run

---

## Pages & Routes

| Route | Description |
|---|---|
| `/integrations/shopify` | Global connection page (workspace-level) |
| `/integrations/shopify/sync` | Order sync page (workspace-level) |
| `/clients/[clientId]/integrations/shopify` | Client-scoped connection, sync, and order preview |

Use the client-scoped page for day-to-day operation. The global page is for initial setup and workspace management.

---

## Sync Architecture

```
lib/shopify/
  config.ts   — env vars, normaliseShopDomain
  auth.ts     — buildOAuthUrl, exchangeCode, verifyHmac
  api.ts      — GraphQL client, fetchRecentOrders (paginated, cursor-based)
  mappers.ts  — raw API → Prisma-ready DTOs (includes workspaceId, clientAccountId)
  db.ts       — ShopifyConnection CRUD + getClientShopifyConnection
  syncDb.ts   — upsertOrder, replaceLineItems, SyncLog writes, getClientOrderSummary
  sync.ts     — runShopifySync(connectionId) and runShopifySyncForClient(clientAccountId)
```

`runShopifySyncForClient` resolves the connection from the client mapping automatically — use it for client-triggered syncs. `runShopifySync` is used by the global sync page.

The orchestrators are called from server actions. UI never calls Shopify or the database directly.

---

## Security Notes

- The Shopify access token is stored as plaintext for this prototype. In production, encrypt it (e.g. AES-256-GCM with a server-side key) before persisting.
- HMAC verification on the OAuth callback prevents spoofed redirects.
- State cookies use `httpOnly: true` for CSRF protection.
- All sync logic is server-side. The access token never reaches the browser.
