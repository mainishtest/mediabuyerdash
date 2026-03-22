# Meta Creative Launch Wiring

## Overview

This system bridges approved creative assets from the Creative Lab to real Meta entities (ad creatives + ads) through a guarded, approval-aware pipeline.

## Required Meta Permissions

- `ads_management` — Create ad creatives and ads via the Marketing API
- `ads_read` — Read existing campaigns/ad sets for target selection
- `business_management` — Access ad accounts

These must be granted during Meta OAuth setup. The existing `META_APP_ID`, `META_APP_SECRET`, and `META_REDIRECT_URI` env vars are reused.

## Launch Flow

```
1. Creative Lab: Approved creative draft variant
     ↓
2. Publish Prep: buildPublishPrepItem() → validate → guardrails → approve
     ↓
3. POST /api/meta-launch
     ↓
4. executeMetaLaunch() orchestrator:
   a. Load PublishPrepRecord (validate approval state)
   b. Check for duplicate launches (hasActiveLaunchForPrepItem)
   c. Re-evaluate publish-prep guardrails
   d. resolveMetaCredentials() — auto-fetch token + ad account from MetaConnection
   e. evaluatePolicyGate() — check GovernanceStop + ActionSafetyPolicy
   f. Create MetaLaunchRecord (status: launching)
   g. attemptMetaLaunch() — call Meta Graph API
   h. Update MetaLaunchRecord with result (metaCreativeId, metaAdId)
   i. Auto-wire ExperimentRecord if control info provided
     ↓
5. Result: MetaLaunchRecord with status: launched | failed | blocked
```

## Payload Mapping

```
PublishPayloadPreview (from publish prep)
  → buildMetaAdCreativePayload() [lib/publishExecution/metaLaunch.ts]
  → POST /{ad-account-id}/adcreatives (creates Meta creative)
  → POST /{ad-account-id}/ads (creates Meta ad, always PAUSED)
```

Key fields mapped:
| Source | Meta Field |
|--------|-----------|
| hook + body (copy) | object_story_spec.link_data.message |
| variantTitle | object_story_spec.link_data.name (headline) |
| callToAction | object_story_spec.link_data.call_to_action.type |
| destinationUrl | object_story_spec.link_data.link |
| targetAdSetExternalId | ads.adset_id |

## Launch Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Launch request created but not ready |
| `ready_for_approval` | Validation passed, awaiting human approval |
| `approved` | Human approved — ready to execute |
| `launching` | Meta API call in progress |
| `launched` | Successfully created Meta entities |
| `failed` | Meta API call failed |
| `blocked` | Policy or guardrail block prevents launch |

## Variant Roles

| Role | Meaning |
|------|---------|
| `control` | Existing baseline creative |
| `challenger` | Newly launched creative being tested |
| `backup_candidate` | Approved but not yet launched |

## Stored Launch Data (MetaLaunchRecord)

| Field | Purpose |
|-------|---------|
| `prepItemId` | Links to PublishPrepRecord |
| `experimentId` | Links to auto-created ExperimentRecord |
| `launchPlanId` | Links to ExperimentLaunchPlanRecord |
| `metaCreativeId` | Resulting Meta creative entity ID |
| `metaAdId` | Resulting Meta ad entity ID |
| `payloadJson` | The exact Meta API payload sent |
| `policyCheckJson` | Policy gate check results |
| `guardrailJson` | Guardrail evaluation at launch time |
| `errorCode` / `errorDetail` | Error info on failure |
| `retryCount` / `lastRetryAt` | Retry tracking |

## API Endpoints

### POST /api/meta-launch — Execute Launch
```json
{
  "prepItemId": "pp_...",
  "clientAccountId": "client_...",
  "executionMode": "guarded_publish",
  "variantRole": "challenger",
  "controlAdExternalId": "123456",
  "controlLabel": "Current Best Performer"
}
```

### GET /api/meta-launch — List Launches
Query params: `clientAccountId`, `status`, `prepItemId`, `experimentId`

### GET /api/meta-launch/[id] — Launch Detail

### PATCH /api/meta-launch/[id] — Actions
- `{ "action": "retry" }` — Retry failed/blocked launch
- `{ "action": "approve" }` — Approve draft/ready launch
- `{ "action": "block", "reason": "..." }` — Manually block

## Retry Behavior

- Only `failed` and `blocked` launches can be retried
- Retry re-executes the full pipeline (credentials, policy, guardrails, Meta API)
- `retryCount` incremented on each attempt
- Each retry creates a new MetaLaunchRecord (original remains for audit)

## Policy Gate Checks

Before any Meta API call, these are evaluated:
1. **GovernanceStop** — No active stops for client, ad account, campaign, or global
2. **ActionSafetyPolicy** — Autonomy mode not `restricted` or `recommend_only`
3. **AutomationOverride** — No active `pause_scope` or `require_approval_all` overrides

If any check fails, launch is blocked and recorded with `status: blocked`.

## Experiment Auto-Wiring

When a challenger launch succeeds and control info is provided:
1. An ExperimentRecord is auto-created with `status: active`
2. Control and challenger Meta IDs are linked
3. Primary metric: `roas_7d`, evaluation window: 7 days
4. The experiment ID is stored back on the MetaLaunchRecord

## Key Files

| File | Purpose |
|------|---------|
| `lib/metaLaunch/types.ts` | Launch types, status, variant roles |
| `lib/metaLaunch/credentialResolver.ts` | Auto-resolve Meta credentials from client |
| `lib/metaLaunch/policyGate.ts` | Governance + safety policy checks |
| `lib/metaLaunch/executor.ts` | Launch orchestrator (main pipeline) |
| `lib/metaLaunch/db.ts` | MetaLaunchRecord CRUD |
| `lib/publishExecution/metaLaunch.ts` | Meta API calls (existing, reused) |
| `lib/publishPrep/guardrails.ts` | Publish-prep guardrails (existing, reused) |
| `app/api/meta-launch/route.ts` | POST execute / GET list |
| `app/api/meta-launch/[id]/route.ts` | GET detail / PATCH retry/approve/block |

## Current Limitations

1. **Image attachment** — `buildMetaAdCreativePayload` maps text fields but does not attach image files. Image variations need manual upload or a future image_url field.
2. **Campaign/ad set creation** — The system only creates creatives and ads inside existing ad sets. It does not create campaigns or ad sets.
3. **Ads always PAUSED** — Created ads are always set to PAUSED status. A human must enable them in Meta Ads Manager.
4. **Access token stored plaintext** — Same limitation as Meta connection.
5. **Single ad account per client** — Uses the first mapped MetaSelectedAdAccount for the client.
