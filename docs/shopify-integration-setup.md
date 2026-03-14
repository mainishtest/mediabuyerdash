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

```
1. User enters shop domain on /integrations/shopify
2. Server sets CSRF state + shop cookies, redirects to:
   https://{shop}/admin/oauth/authorize?client_id=...&scope=...&redirect_uri=...&state=...
3. Shop owner approves → Shopify redirects to:
   /api/auth/shopify/callback?code=…&hmac=…&shop=…&state=…
4. Callback:
   - Verifies HMAC signature (crypto HMAC-SHA256)
   - Verifies state cookie (CSRF protection)
   - Verifies shop domain matches stored cookie
   - Exchanges code for permanent access token via POST /admin/oauth/access_token
   - Saves ShopifyConnection to database
   - Redirects to /integrations/shopify?connected=1
```

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

## Running the Prisma Schema Push

After setting `DATABASE_URL` in `.env`:

```bash
npx prisma db push --accept-data-loss
```

New tables created:
- `ShopifyConnection`
- `ShopifyOrder`
- `ShopifyOrderLineItem`
- `ShopifySyncLog`

---

## Sync Architecture

```
lib/shopify/
  config.ts   — env vars, normaliseShopDomain
  auth.ts     — buildOAuthUrl, exchangeCode, verifyHmac
  api.ts      — GraphQL client, fetchRecentOrders (paginated)
  mappers.ts  — raw API → Prisma-ready DTOs
  db.ts       — ShopifyConnection CRUD
  syncDb.ts   — upsertOrder, replaceLineItems, SyncLog writes
  sync.ts     — runShopifySync() orchestrator
```

The orchestrator is called by `/integrations/shopify/sync/actions.ts` (server action). UI never calls Shopify directly.

---

## Security Notes

- The Shopify access token is stored as plaintext for this prototype. In production, encrypt it (e.g. AES-256-GCM with a server-side key) before persisting.
- HMAC verification on the OAuth callback prevents spoofed redirects.
- State cookies use `httpOnly: true` for CSRF protection.
- All sync logic is server-side. The access token never reaches the browser.
