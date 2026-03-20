# Meta Campaign Sync — v1

This document describes what the first-version Meta sync fetches, how it
works, and its current limitations.

---

## What is synced

| Entity       | Source endpoint                               | Upsert key              |
|--------------|-----------------------------------------------|-------------------------|
| Campaigns    | `/{act_id}/campaigns`                         | `externalCampaignId`    |
| Ad Sets      | `/{act_id}/adsets`                            | `externalAdSetId`       |
| Ads          | `/{act_id}/ads`                               | `externalAdId`          |
| Creatives    | Embedded in the Ads response (`creative{…}`)  | `externalCreativeId`    |
| Insights     | `/{act_id}/insights`                          | delete+insert per window|

All synced tables are prefixed `MetaSynced*` in the Prisma schema.

---

## Date range for insights

- **Level:** Ad (daily rows, one row per ad per day)
- **Window:** Last 7 calendar days from the moment the sync runs
- **Strategy:** Delete existing rows for the account within the window, then
  bulk-insert the new set. This avoids per-row upserts on a compound unique
  key and handles corrected delivery numbers gracefully.

---

## Fields synced

### Campaigns
`id · name · status · objective · buying_type · created_time · updated_time`
plus `externalAdAccountId` and `workspaceId` (internal scoping).

### Ad Sets
`id · name · status · campaign_id · created_time · updated_time`
plus `externalAdAccountId` and `workspaceId`.

### Ads
`id · name · status · adset_id · campaign_id · created_time · updated_time`
plus embedded creative reference and `workspaceId`.

### Creatives
`id · name · title · body · call_to_action_type · image_url · thumbnail_url`
plus `workspaceId`. Creative records are deduplicated by `externalCreativeId`
before upsert because multiple ads can share the same creative.

### Insights
`campaign_id · adset_id · ad_id · date_start · date_stop`
`spend · impressions · clicks · ctr · cpm · frequency`
plus `externalAdAccountId` and `workspaceId`.

---

## Workspace scoping

Every synced row stores a nullable `workspaceId`. This is populated from the
authenticated user's session at sync time. The field is nullable to preserve
backward compatibility with any pre-existing rows.

`getSyncedDataSummary()` accepts an optional `workspaceId` and applies an
`OR [workspaceId = X, workspaceId IS NULL]` filter so legacy rows remain
visible until they are re-synced.

---

## How to trigger a sync

1. Navigate to **Integrations → Meta**.
2. Ensure a Meta account is connected and at least one ad account is selected.
3. Navigate to **Integrations → Meta → Sync**.
4. Click **Run Sync**.

A sync log is written to `MetaSyncLog` and the page revalidates on completion.

---

## API version

All requests use `https://graph.facebook.com/v20.0`.

---

## Pagination

`fetchAllPages()` follows `paging.next` cursors up to **20 pages** for
entity endpoints and **50 pages** for insights. Accounts with very large
campaign sets may need the page limit increased.

---

## Current limitations

| Limitation | Notes |
|---|---|
| Insights are ad-level only | Campaign and ad-set level breakdowns not yet synced |
| 7-day insight window only | Longer historical backfills not yet supported |
| No incremental update for entities | All campaigns/ad sets/ads are re-fetched on every sync |
| Creative images not downloaded | Only URLs are stored; no CDN mirroring |
| Single Meta connection per app | Multi-account agency setups require workspace-scoped connections (next milestone) |
| No automatic / scheduled sync | Sync is triggered manually from the UI |

---

## Next step

Map `MetaSyncedCampaign` rows to `ClientAccount` records so that
client-scoped views can show live campaign data filtered by client.
See `docs/client-integration-mapping.md`.
