# Meta Ad Account Connection & Sync Setup

## Environment Variables

```
META_APP_ID=<your-meta-app-id>
META_APP_SECRET=<your-meta-app-secret>
META_REDIRECT_URI=https://your-domain.com/api/auth/meta/callback
CRON_SECRET=<random-secret-for-cron-endpoints>
```

### Getting Meta Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/apps)
2. Create a new app (type: **Business**)
3. Go to **App Settings > Basic** — copy App ID and App Secret
4. Add the **Facebook Login for Business** product
5. Under Facebook Login > Settings, add your redirect URI
6. Required scopes: `ads_read`, `business_management`

## Connection Flow

```
User clicks "Connect Meta" →
  GET /api/auth/meta/start →
    Sets CSRF state cookie →
    Redirects to Meta OAuth dialog →
      User approves →
      Meta redirects to GET /api/auth/meta/callback?code=...&state=... →
        Validates CSRF state →
        Exchanges code for access token →
        Fetches user info (/me) →
        Stores MetaConnection record →
        Fetches accessible ad accounts (/me/adaccounts) →
        Stores MetaAccessibleAdAccount records →
        Redirects to /integrations/meta?connected=1
```

## Account Selection Flow

1. After OAuth, user sees all accessible ad accounts on `/integrations/meta`
2. User toggles checkboxes to select/deselect accounts
3. Clicks "Save Selection" → stores `MetaSelectedAdAccount` records
4. Accounts with `clientAccountId` mappings are preserved on deselection
5. Only selected accounts are included in sync operations

## Permission Validation

The system validates that the Meta access token includes the required scopes:
- `ads_read` — read campaign/ad performance data
- `business_management` — access business-level ad accounts

Permission states:
| State | Meaning |
|-------|---------|
| `valid` | All required scopes granted |
| `partially_valid` | Some scopes missing |
| `missing_required_permissions` | No required scopes granted |
| `unknown` | Scope data unavailable |

If permissions are incomplete, a warning banner shows on `/integrations/meta` with instructions to reconnect.

## Sync Setup

### Manual Sync
- Click "Run Sync Now" on `/integrations/meta`
- Or visit `/integrations/meta/sync` for detailed status

### Automated Sync (Cron)
Hit these endpoints with `Authorization: Bearer <CRON_SECRET>`:
```
GET /api/cron/sync-meta     — Sync all selected Meta ad accounts
GET /api/cron/sync-shopify  — Sync all Shopify connections
```

### What Gets Synced
| Entity | Source | DB Table |
|--------|--------|----------|
| Campaigns | /campaigns | MetaSyncedCampaign |
| Ad Sets | /adsets | MetaSyncedAdSet |
| Ads | /ads | MetaSyncedAd |
| Creatives | embedded in /ads | MetaSyncedCreative |
| Insights | /insights (7-day window) | MetaSyncedInsight |

## Connection States

| State | Meaning |
|-------|---------|
| `not_connected` | No Meta OAuth connection exists |
| `connecting` | OAuth in progress |
| `connected` | OAuth complete, token active |
| `account_selection_required` | Connected but no accounts selected |
| `permissions_incomplete` | Missing required scopes |
| `sync_initializing` | First sync starting |
| `syncing` | Sync in progress |
| `sync_error` | Last sync failed |
| `disconnected` | Token expired or revoked |

## Reconnect / Retry

Reconnect is needed when:
- Access token expires (`tokenExpiresAt < now`)
- Token is revoked by user in Meta settings
- Required permissions are changed
- User manually disconnects

The UI shows a reconnect banner with a direct link to `/api/auth/meta/start`.

## Data Flow to Dashboard

```
MetaSelectedAdAccount (mapped to ClientAccount)
  → Sync pulls data for those externalAdAccountIds
  → MetaSyncedCampaign + MetaSyncedInsight stored
  → Dashboard aggregator queries by workspaceId + externalAdAccountId
  → ReconciliationSummary combines with Shopify data for true ROAS
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/meta/config.ts` | Environment variable validation |
| `lib/meta/auth.ts` | OAuth URL building, token exchange |
| `lib/meta/accounts.ts` | Ad account discovery from Meta API |
| `lib/meta/db.ts` | Connection CRUD, account selection |
| `lib/meta/sync.ts` | Sync orchestrator |
| `lib/meta/api.ts` | Meta Graph API calls |
| `lib/meta/types.ts` | Typed state models |
| `lib/meta/integrationState.ts` | State computation utilities |
| `lib/meta/clientMetaValidation.ts` | 7-stage pipeline validation |
| `lib/meta/metaImportStatus.ts` | Diagnostic pipeline queries |
| `app/api/auth/meta/start/route.ts` | OAuth start endpoint |
| `app/api/auth/meta/callback/route.ts` | OAuth callback handler |
| `app/api/cron/sync-meta/route.ts` | Cron sync endpoint |
| `app/integrations/meta/` | Integration UI |

## Current Limitations

1. **Access tokens stored plaintext** — should be encrypted in production
2. **No token refresh** — expired tokens require manual reconnect
3. **No webhook-based sync** — uses polling via cron
4. **Insights limited to 7 days** — configurable in `lib/meta/api.ts`
5. **Single connection per workspace** — no multi-user Meta connections
