# Meta Import Verification & Client Dashboard Data Validation

This document explains the complete path that Meta campaign data must travel
before it appears on a client's dashboard, and how to debug it when it does not.

---

## What Must Be True for Meta Data to Appear

There are **7 checkpoints** in the pipeline. Every one must pass before data
is visible on the client dashboard.

| # | Checkpoint | Where to fix |
|---|---|---|
| 1 | Meta OAuth connection is **active** in the workspace | Integrations → Meta |
| 2 | At least one **accessible ad account** exists | Integrations → Meta → Refresh Accounts |
| 3 | At least one accessible account is **selected** | Integrations → Meta → check boxes |
| 4 | A selected account is **mapped to this client** | Client page → Client Integrations section |
| 5 | A **sync has run** and completed (or partially completed) | Client page → Sync Status → Run Meta Sync |
| 6 | **Campaigns/AdSets/Ads/Insights** exist in the DB for the mapped accounts | Verified by the Debug Panel counts |
| 7 | The **dashboard query** returns campaigns for the mapped accounts | Live Meta Campaigns section on client page |

---

## How Mapping and Sync Affect Visibility

### Mapping (step 4)
- Each `MetaSelectedAdAccount` row has a `clientAccountId` field.
- When you assign an ad account to a client on the client page, this field is set.
- The dashboard query (`getClientMetaData`) filters campaigns by
  `externalAdAccountId IN (mapped accounts for clientId)`.
- **If no accounts are mapped, the query returns zero campaigns** — even if
  campaigns exist in the database for that account.

### Sync (step 5–6)
- Syncing fetches campaigns, ad sets, ads, creatives, and insights from the
  Meta Graph API and upserts them into the `MetaSynced*` tables.
- Campaigns are keyed on `externalCampaignId`. Running the same sync twice is safe.
- Insights are keyed on `(externalAdAccountId, level, campaignId, adSetId, adId, dateStart)`.
  The last 7 days are replaced on each sync.
- A successful sync must complete at least the campaign fetch. If the connection
  token has expired, the sync will fail at the API call.

---

## Common Import Failure Points

### "No Meta connection found"
- OAuth token was never completed, or the connection was deleted.
- **Fix:** Go to Integrations → Meta and reconnect via OAuth.

### "No accessible ad accounts"
- The Meta user has no ad accounts, OR the token lacks `ads_read` scope,
  OR accounts were revoked after the last refresh.
- **Fix:** Click "Refresh Accounts" on the Meta integration page. If accounts
  still don't appear, reconnect and make sure the account has Ad Manager access.

### "No ad accounts selected"
- Accessible accounts exist but none are checked.
- **Fix:** Integrations → Meta → toggle the accounts you want to include.

### "No ad account mapped to this client"
- The most common cause of a blank campaign section.
- **Fix:** On the client page, expand Client Integrations → Meta Ad Accounts,
  and click Assign on the correct account.

### "Sync has not been run"
- Mapping exists but no sync was ever triggered.
- **Fix:** Client page → Sync Status → Run Meta Sync.

### "Last sync failed"
- The sync started but the API call or database write threw an error.
- **Fix:** Expand the Debug Panel, read the error message. Common causes:
  - Expired or revoked access token → reconnect Meta OAuth
  - Rate limit hit → wait and retry
  - Invalid account ID → check the mapped account ID matches what Meta returns

### "Sync ran but no campaigns imported"
- The sync completed with `campaignsSynced: 0`.
- This usually means the ad account has no campaigns, OR the account ID stored
  in `MetaSelectedAdAccount.accessibleAdAccount.externalAdAccountId` does not
  match the account ID returned by the Meta Graph API for that user.
- **Fix:** Open the Debug Panel → Selected Accounts table → confirm the Meta ID
  column matches what you see in your Meta Business Manager.

### "Data imported but not visible in dashboard"
- Campaigns exist in `MetaSyncedCampaign` but `getClientMetaData` returns nothing.
- This is usually a `workspaceId` mismatch. Legacy rows have `workspaceId = null`.
  The query includes a `OR [{ workspaceId }, { workspaceId: null }]` filter to
  cover this, but if the workspace ID changed, old rows may be excluded.
- **Fix:** Check the Debug Panel counts vs the campaign table. If counts are non-zero
  but the section shows empty, check whether `workspaceId` on the campaign rows
  matches the current session's `workspaceId`.

---

## How to Debug Missing Client Campaign Data (Step-by-Step)

1. **Open the client page** → `Meta Data Verification` section.
   - All 5 checkpoints must show green ticks.
   - The "Next Best Action" banner tells you exactly what to fix first.

2. **Expand the Meta Import Pipeline Debug panel** (below the verification section).
   - Check which of the 7 stages is failing.
   - Review the "Selected Ad Accounts in Workspace" table to confirm which
     accounts are mapped to this client vs other clients or unmapped.
   - Review the "Synced Entity Counts" grid — if campaigns = 0, the sync
     did not import any campaigns for the mapped account IDs.
   - Review the "Last Sync Log" — check for error messages.

3. **Navigate to `/clients/[clientId]/meta-status`** for the full-detail view,
   which includes both panels and the live campaign preview in one place.

4. **If the sync log shows errors**, reconnect Meta OAuth at Integrations → Meta
   and then re-run the sync.

5. **If counts are non-zero but the dashboard is still empty**, the issue is
   in the dashboard query filter. Check:
   - `MetaSelectedAdAccount.accessibleAdAccount.externalAdAccountId` matches
     `MetaSyncedCampaign.externalAdAccountId` exactly (no leading `act_` prefix
     difference — Meta sometimes returns `act_123456` and the sync may strip
     or preserve it inconsistently).
   - The `workspaceId` on synced rows matches the current workspace.

---

## Architecture Reference

| Layer | File | Role |
|---|---|---|
| DB persistence | `lib/meta/syncDb.ts` | Upsert campaigns/adsets/ads/insights |
| DB queries | `lib/meta/clientMetaService.ts` | Client-scoped campaign data for dashboard |
| Pipeline check | `lib/meta/metaImportStatus.ts` | 7-stage read-only diagnostic |
| Validation | `lib/meta/clientMetaValidation.ts` | Typed issues + next action derivation |
| UI: verification | `app/clients/[clientId]/MetaVerificationSection.tsx` | User-facing status + issues |
| UI: debug panel | `app/clients/[clientId]/MetaImportDebugPanel.tsx` | Developer detail (collapsible) |
| UI: campaign data | `app/clients/[clientId]/LiveMetaCampaignsSection.tsx` | Campaign table/cards |
| Route: full status | `app/clients/[clientId]/meta-status/page.tsx` | Dedicated verification page |

---

## Preparing for Shopify Integration

The next step after Meta data is verified is to connect a Shopify store for
source-of-truth revenue data. The reconciliation engine will then match
Meta campaign spend against Shopify order revenue.

Before that step:
- Ensure at least one Meta account is mapped and synced for the client.
- Confirm `campaignsCount > 0` in the Import Counts grid.
- Confirm insight rows exist (these carry spend data for reconciliation).

Shopify connection is managed at `/clients/[clientId]/integrations/shopify`.
