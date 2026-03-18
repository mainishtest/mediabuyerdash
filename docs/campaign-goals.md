# Campaign Goals

## Overview

Campaign goals are internal dashboard targets used to evaluate the performance of imported Meta campaigns. They are stored entirely in this application and are **never written back to Meta Ads Manager**.

Goals enable:
- Campaign health scoring (Strong / On Target / Watch / Below Goal / No Goal)
- Deterministic recommendations (Scale / Maintain / Review / Reduce Spend / Set Goal)
- Missing goals alerts and filters on the campaign list page

---

## How Goals Work

Each imported Meta campaign can have one goal record. A goal contains:

| Field          | Type            | Description                                     |
| -------------- | --------------- | ----------------------------------------------- |
| roasGoalType   | `"high"` / `"low"` | High = aim to exceed; Low = minimum floor    |
| roasGoalValue  | number          | Target ROAS (e.g. 2.5 = $2.50 per $1 spent)    |
| cpaGoalType    | `"high"` / `"low"` | Low = minimize CPA; High = maximum ceiling   |
| cpaGoalValue   | number          | Target CPA in dollars (e.g. 45.00)              |

**Goal Type semantics:**

- `roasGoalType: "high"` → campaign must *exceed* this ROAS to pass evaluation
- `roasGoalType: "low"` → campaign must *not fall below* this minimum ROAS
- `cpaGoalType: "low"` → campaign must stay *below* this CPA to pass (typical case)
- `cpaGoalType: "high"` → campaign must *exceed* this CPA threshold (atypical)

---

## Where Goals Are Stored

Goals live in the `MetaCampaignGoal` table in PostgreSQL:

```
MetaCampaignGoal
  id                  — internal primary key
  externalCampaignId  — FK to MetaSyncedCampaign.externalCampaignId (unique)
  roasGoalType        — "high" | "low"
  roasGoalValue       — float
  cpaGoalType         — "high" | "low"
  cpaGoalValue        — float
  createdAt / updatedAt
```

The link to the imported campaign is via `externalCampaignId` — Meta's own campaign ID (e.g. `120200123456`). This is a direct, reliable FK — no name-based matching.

---

## How to Set or Edit a Goal

1. Navigate to a client → **Campaigns**
2. Click any campaign name to open the campaign drill-down
3. In the **Campaign Goals** section, click **Add Goal** or **Edit Goals**
4. Enter ROAS target and CPA target with their goal types
5. Click **Save Goals**

The goal is saved via `POST /api/campaigns/[externalCampaignId]/goal` and takes effect on the next page load of the campaign list.

---

## How Goals Are Used in Evaluation

The campaign aggregator (`lib/campaignPerformance/aggregator.ts`) reads goals from `MetaCampaignGoal` in a single bulk query, keyed by `externalCampaignId`. For each campaign:

1. **Spend** comes from `MetaSyncedInsight` (Meta delivery data)
2. **Revenue + Orders** come from `ShopifyOrder` (CRM, source of truth)
3. **Evaluated ROAS** = `crmRevenue / metaSpend`
4. **Evaluated CPA** = `metaSpend / crmOrders`
5. Goals are compared against evaluated metrics using `evaluateCampaignAgainstGoals()`
6. Health status and recommendation are derived from evaluation result

Attribution window is **7 days** per product rules.

---

## What Is NOT Synced Back to Meta

- Goal values are never sent to Meta Ads Manager
- Goals do not affect Meta campaign delivery, budgets, or bidding
- Goals are purely local evaluation targets within this dashboard

---

## Service Layer

`lib/campaignGoals/service.ts` exposes:

| Function                    | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `getCampaignGoal(id)`       | Returns goal for a campaign, or null                        |
| `upsertCampaignGoal(id, v)` | Creates or replaces goal (idempotent)                       |
| `getCampaignsWithGoals(clientId)` | Returns a Map of externalCampaignId → goal for a client |
| `buildCampaignGoalSummary(clientId)` | Returns total/withGoals/missingGoals counts + names   |

---

## API Endpoint

```
GET  /api/campaigns/[campaignId]/goal
     → { goal: GoalData | null }

POST /api/campaigns/[campaignId]/goal
     Body: { roasGoalType, roasGoalValue, cpaGoalType, cpaGoalValue }
     → { goal: GoalData }
```

Where `campaignId` = `externalCampaignId` (Meta's campaign ID).

---

## Next Steps (Not Implemented Here)

- **Goal-aware live evaluation** using real-time reconciled CRM data
- **Bulk goal setting** — set a ROAS/CPA target for multiple campaigns at once
- **Goal templates** — reusable goal presets per client or campaign objective
- **Goal history** — track how goals change over time
