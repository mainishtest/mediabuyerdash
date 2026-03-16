# Campaign-Level Live Performance

## What metrics are shown at campaign level

Each campaign row in `/clients/[clientId]/campaigns` shows:

| Metric | Source | Notes |
|--------|--------|-------|
| **Spend** | `MetaSyncedInsight` | Sum of all ad-level insight rows for the campaign |
| **CRM Revenue** | `ShopifyOrder.totalPrice` | Aggregated by `utmCampaign` matching campaign name |
| **CRM Orders** | `ShopifyOrder` count | Aggregated by `utmCampaign` matching campaign name |
| **Evaluated ROAS** | Derived | `crmRevenue / metaSpend` — CRM is source of truth |
| **Evaluated CPA** | Derived | `metaSpend / crmOrders` — CRM is source of truth |
| **ROAS Goal** | `CampaignGoal` | Configured in the client's Campaign Goals editor |
| **CPA Goal** | `CampaignGoal` | Configured in the client's Campaign Goals editor |
| **vs Goal %** | Derived | Percentage delta between actual and goal values |

Meta delivery metrics (impressions, CTR, CPM) are not shown at campaign level in this version — Meta data provides spend only. Shopify/CRM data drives all ROAS and CPA values per the product measurement policy.

---

## How goals are evaluated

Goals are stored in `CampaignGoal` per internal `Campaign` record and carry a `roasGoalType` ("high" | "low") and `cpaGoalType` ("high" | "low").

The evaluation uses the shared `evaluateEntity()` function from `lib/evaluationUtils.ts`:

- **ROAS "high"** → higher is better → `evaluatedRoas >= roasGoalValue` = meets goal
- **ROAS "low"** → lower is better → `evaluatedRoas <= roasGoalValue` = meets goal
- **CPA "low"** → lower is better (standard) → `evaluatedCpa <= cpaGoalValue` = meets goal
- **CPA "high"** → higher is better (non-standard) → `evaluatedCpa >= cpaGoalValue` = meets goal

**Health status mapping:**

| Status | Condition |
|--------|-----------|
| `strong` | Both goals met AND >5% better on each |
| `on_target` | Both goals met |
| `watch` | One goal met |
| `below_goal` | Neither goal met |
| `no_goal` | No `CampaignGoal` record exists |
| `stale` | Goal exists but `metaSpend = 0` in the synced window |
| `no_data` | Campaign synced but has no insight data at all |

---

## How source-of-truth metrics are resolved

**Step 1 — Spend from Meta:**
`MetaSyncedInsight` rows are aggregated by `externalCampaignId` (all ad-level rows summed). This gives total Meta spend per campaign over the synced 7-day window.

**Step 2 — Revenue and orders from Shopify (CRM source of truth):**
`ShopifyOrder` rows are grouped in-process by `utmCampaign` (normalized to lowercase). Revenue = sum of `totalPrice`. Orders = count of rows.

**Step 3 — Name-based join:**
Meta campaign name (`MetaSyncedCampaign.name`) is matched case-insensitively to Shopify `utmCampaign`. This works correctly when UTM parameters are set to match Meta campaign names exactly. Mismatches result in `crmRevenue = 0` and `crmOrders = 0` for that campaign.

**Step 4 — Evaluated metrics:**
`evaluatedRoas = crmRevenue / metaSpend`
`evaluatedCpa  = metaSpend  / crmOrders`
Both are 0 if the denominator is 0 (no spend or no orders).

**Upgrade path — ReconciliationMatch:**
When the reconciliation engine has run for a client, `ReconciliationMatch` records contain `metaCampaignId` with pre-attributed spend/revenue pairs at higher accuracy. A future version of `buildCampaignPerformanceSnapshots()` will prefer reconciliation data when available, falling back to the direct name-join only when reconciliation hasn't been run.

---

## Limitations of the first campaign performance version

1. **Name-based join** — UTM campaign names must match Meta campaign names exactly (case-insensitive) for CRM data to attribute correctly. Use consistent naming conventions.

2. **No date range filter** — the view aggregates all available synced data (the last 7 days per the attribution window). Date-range filtering will be added in a later version.

3. **No ad set or ad drilldown** — campaign-level only. Ad set and ad drilldowns come in the next step.

4. **No AI diagnosis** — recommendations are deterministic (rule-based). AI-powered diagnosis is a separate future step.

5. **No automation** — recommendations display only. Executing bid or budget changes is not in scope.

6. **7-day window** — insights are always the last 7 days synced. Longer attribution windows require re-syncing with a wider date range.

7. **Single Shopify connection** — each client maps to one Shopify store. Multi-store clients are not yet supported.

---

## What comes next

1. **ReconciliationMatch integration** — use precisely attributed match rows for campaign spend/revenue when available.
2. **Ad set-level drilldown** — `/clients/[clientId]/campaigns/[campaignId]/adsets`
3. **Ad-level drilldown** — per ad with creative performance context.
4. **Date range filter** — aggregate over selectable windows (7d, 14d, 30d).
5. **Stale data detection** — warn when the last sync is older than 24 hours.
6. **AI-powered diagnosis** — natural-language explanation of what's driving performance for each campaign.
