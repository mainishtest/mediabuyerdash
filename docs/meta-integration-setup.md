# Meta Integration Setup

This guide covers everything needed to connect a Meta (Facebook) account
and discover accessible ad accounts.

---

## Required Environment Variables

Add the following to your `.env` and `.env.local` files (and to Vercel
Environment Variables for production):

```
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_REDIRECT_URI=https://your-domain.com/api/auth/meta/callback
```

For local development:
```
META_REDIRECT_URI=http://localhost:3000/api/auth/meta/callback
```

---

## Creating a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps → Create App**
3. Choose **Business** as the app type
4. Under **Add Products**, add **Facebook Login**
5. Under **Facebook Login → Settings**, add your redirect URI to
   **Valid OAuth Redirect URIs**:
   ```
   http://localhost:3000/api/auth/meta/callback
   https://your-production-domain.com/api/auth/meta/callback
   ```
6. Under **App Settings → Basic**, note your **App ID** and **App Secret**

---

## Required Permissions (Scopes)

The app requests:

| Scope | Purpose |
|-------|---------|
| `ads_read` | Read ad account, campaign, ad set, ad, creative, and insight data |
| `business_management` | Access business assets and ad account metadata |

These scopes must be approved in App Review before the app can be used
by accounts other than the app developer.

During development, the app developer's account can be used without App Review.

---

## Testing Connection Locally

1. Set `META_APP_ID`, `META_APP_SECRET`, and `META_REDIRECT_URI` in `.env` and `.env.local`
2. Run `npm run dev`
3. Visit `http://localhost:3000/integrations/meta`
4. Click **Connect Meta Account**
5. Complete the Facebook Login flow
6. You will be redirected back to `/integrations/meta` with your accessible ad accounts listed

---

## OAuth Callback Flow

```
User clicks "Connect Meta"
  → Server action startMetaOAuthAction()
  → Sets httpOnly state cookie (CSRF protection)
  → Redirects to Meta Login Dialog

Meta redirects to:
  /api/auth/meta/callback?code=xxx&state=xxx

Callback route handler:
  1. Verifies state cookie
  2. Exchanges code for access token (POST /v20.0/oauth/access_token)
  3. Fetches user identity (GET /v20.0/me)
  4. Upserts MetaConnection in database
  5. Fetches accessible ad accounts (GET /v20.0/me/adaccounts)
  6. Syncs MetaAccessibleAdAccount records in database
  7. Clears state cookie
  8. Redirects to /integrations/meta?connected=1
```

---

## What Is Real vs Placeholder

| Feature | Status |
|---------|--------|
| Meta OAuth Login Dialog redirect | Real |
| Token exchange (`/oauth/access_token`) | Real — requires valid credentials |
| User info fetch (`/me`) | Real |
| Ad account discovery (`/me/adaccounts`) | Real |
| Connection persistence (Supabase) | Real |
| Account selection persistence (Supabase) | Real |
| Campaign / ad set / ad sync | Not yet — next step |
| Metrics sync | Not yet |
| Meta ad publishing | Not planned for this phase |

---

## Security Notes

- `META_APP_SECRET` is **server-side only**. It is never exposed to the browser.
- The access token is stored in plaintext in the `MetaConnection` table.
  **Before going to production with real tokens, encrypt with a KMS key.**
- The OAuth state parameter is stored in an `httpOnly` cookie for CSRF protection.
- All Meta API calls happen in server-side utilities (`lib/meta/`).

---

## Database Schema

After adding Meta credentials, run the Prisma schema push to create the
new tables:

```bash
cd your-project-directory
npx prisma db push --accept-data-loss
```

New models added:
- `MetaConnection` — the connected Meta user + token
- `MetaAccessibleAdAccount` — ad accounts returned from `/me/adaccounts`
- `MetaSelectedAdAccount` — the operator's account selection
