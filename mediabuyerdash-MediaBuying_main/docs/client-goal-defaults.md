# Client Goal Defaults

## What they are

Client goal defaults are a client-level fallback for campaign evaluation. When a
campaign has no explicit ROAS or CPA goal set, the system uses the client's default
values instead.

This means you can set a single ROAS and CPA target for a client and have it apply
automatically to every campaign — without manually configuring each one.

---

## Goal resolution order

Goals are resolved using this priority chain (highest first):

```
1. Explicit MetaCampaignGoal    → source: "explicit"
   Set directly on the campaign (via inline edit or detail page)

2. ClientGoalDefaults           → source: "client_default"
   Set at the client level — applies when no explicit goal exists

3. No goal                      → source: "none"
   Campaign shows health: "no_goal" and recommendation: "set_goal"
```

Resolution is centralised in `lib/campaignGoals/resolveGoal.ts`.
Every evaluation layer (aggregator, future alerts, automation rules) uses this
same function — there is no duplicated goal lookup logic.

---

## Where to configure

Navigate to: **Client → Settings** (`/clients/[clientId]/settings`)

- Enter a default ROAS target (aim to exceed — `goalType: "high"`)
- Enter a default CPA target in $ (stay under — `goalType: "low"`)
- Click **Save defaults**

Defaults take effect immediately on the next campaign list load.

---

## Applying defaults to campaigns

The **Apply defaults to campaigns** action creates explicit `MetaCampaignGoal`
rows for every campaign that does not already have one.

This converts `client_default` coverage to `explicit` coverage — after applying,
campaigns no longer depend on the client default for their goal values.

**A confirmation step is required before applying.**

Rules:
- Only campaigns with no existing explicit goal are affected
- Campaigns that already have goals are never modified
- The apply is idempotent — running it twice is safe

---

## Goal source labels in the campaign list

Each campaign card and table row shows where its active goal came from:

| Label | Color | Meaning |
|---|---|---|
| Explicit | Emerald | Goal set directly on this campaign |
| Client default | Indigo | No explicit goal — using client-level fallback |
| (none shown) | Amber chip | No goal at any level |

---

## Filters

The campaign list includes a goal source filter:

| Filter | Shows |
|---|---|
| All campaigns | Everything |
| Explicit goals | Only campaigns with a directly assigned goal |
| Client default | Only campaigns using the fallback |
| Missing goals | Only campaigns with no goal at any level |

---

## Coverage summary

The Settings page shows a 2×2 coverage grid:

| Stat | Description |
|---|---|
| Total campaigns | All synced campaigns for this client |
| Explicit goals | Campaigns with a MetaCampaignGoal row |
| Using client default | Campaigns without explicit goal, where defaults exist |
| Missing goals | Campaigns with neither (only possible if no defaults set) |

---

## Architecture

```
prisma/schema.prisma
  ClientGoalDefaults           — one row per client, linked to ClientAccount

lib/campaignGoals/
  resolveGoal.ts               — centralized goal resolution (explicit → default → none)

lib/clientGoalDefaults/
  service.ts                   — getClientGoalDefaults, upsertClientGoalDefaults,
                                 applyClientDefaultsToCampaigns, buildClientGoalCoverageSummary

app/api/clients/[clientId]/
  goal-defaults/route.ts       — GET + POST
  goal-defaults/apply/route.ts — POST (bulk apply, with safety guard)

app/clients/[clientId]/
  settings/page.tsx            — server component: loads defaults + coverage
  settings/ClientSettingsView.tsx — client component: form, coverage, apply action

lib/campaignPerformance/
  aggregator.ts                — loads ClientGoalDefaults once, calls resolveGoal() per campaign
  types.ts                     — CampaignPerformanceSnapshot.goalSource: GoalSource
```

---

## Safe handling

| Scenario | Behaviour |
|---|---|
| No campaigns imported | Settings page shows empty coverage grid with "Run sync" link |
| Invalid default values | API returns 422 with specific field error |
| Apply when no defaults set | API returns 422 — apply button is hidden in UI when no defaults exist |
| Campaign already has explicit goal | apply skips it — never overwrites |
| Apply network failure | Error shown in UI, no partial state (each campaign upserted independently) |

---

## Evaluation and alerts

Campaign evaluation (`lib/campaignPerformance/evaluator.ts`) uses whichever goal
`resolveGoal()` returns. Whether that goal came from an explicit record or the
client default is transparent to the evaluator — it receives the same `GoalInput`
shape either way.

Future automation rules should also call `resolveGoal()` for consistency rather
than loading goals directly.

---

## Limitations (v1)

- **One set of defaults per client.** No per-objective or per-campaign-type defaults.
- **Apply is one-way.** After applying, campaigns have explicit goals. To reset them
  back to "using client default", the explicit goals must be deleted manually.
- **No bulk delete.** There is no UI to remove explicit goals from many campaigns at once.
- **Goal types are fixed.** Always `roasGoalType: "high"` (exceed) and
  `cpaGoalType: "low"` (stay under). This covers direct-response campaigns.
