# Budget Pacing Tracker

## What it is

The Budget Pacing Tracker shows whether each client is spending their monthly
budget at the right rate. It answers: **"Are we on track to spend what we planned
to spend this month?"**

This is a visibility tool. It does not modify budgets in Meta — all changes are
recorded here only (v1 limitation).

---

## How pacing is calculated

Pacing uses a **linear spend model**: the budget is assumed to be spread evenly
across all days in the month.

```
Expected spend today = monthlyBudget × (daysElapsed / daysInPeriod)
Pacing %             = actualSpend / expectedSpend × 100
Projected EOM        = (actualSpend / daysElapsed) × daysInPeriod
```

**Thresholds (v1):**

| Range       | Status        | Recommendation            |
|---|---|---|
| > 110%      | Over pacing   | Reduce daily spend        |
| 90 – 110%   | On pacing     | Maintain current spend    |
| < 90%       | Under pacing  | Increase daily spend      |
| No target   | No budget set | Set a monthly budget      |

`daysElapsed` is capped at a minimum of 1 to avoid division by zero on the
first day of the month.

---

## Spend source

**Meta Ads — `MetaSyncedInsight.spend`**, filtered to rows where `dateStart`
falls within the current calendar month.

This is the same spend source used by the campaign performance aggregator.
It reflects Meta-reported ad spend, not CRM or Shopify revenue.

> **Important:** CRM (Shopify) is the source of truth for ROAS and CPA.
> For pacing, Meta spend is correct — pacing tracks delivery spend,
> not revenue outcomes.

---

## Budget targets

Budget targets are stored in `BudgetPacingTarget`:

| Field          | Description |
|---|---|
| `clientAccountId` | The client this target belongs to |
| `campaignId`      | `null` = client-level; externalCampaignId = campaign-level |
| `monthlyBudget`   | Total budget for the calendar month ($) |
| `dailyBudget`     | Optional explicit daily cap; if null, implied = monthly / days in month |

One target per (client, campaign) pair — application-level upsert.

Client-level targets aggregate all campaign spend for that client.
Campaign-level targets track individual campaigns.

---

## Setting a budget target

1. Navigate to **Pacing** in the sidebar
2. Find the client row/card
3. Click **Set budget** (or **Edit budget** if one already exists)
4. Enter monthly budget; daily cap is optional
5. Click **Save budget**

Targets take effect immediately on next page load.

---

## Where pacing appears

### `/pacing` page
Full client pacing list with:
- 4 summary stat cards (on pacing / under / over / no budget)
- Pacing status filter and client search
- Mobile: stacked cards with key numbers and pacing bar
- Desktop: table with spent / budget / expected / projected / pacing %

### Operations page
A **Pacing Issues** section surfaces the top 5 worst-pacing clients
(over_pacing + under_pacing, sorted by deviation from target).
Links to the full `/pacing` page.

---

## Architecture

```
prisma/schema.prisma
  BudgetPacingTarget          — target storage (monthlyBudget + optional dailyBudget)

lib/budgetPacing/
  types.ts                    — BudgetPacingStatus, BudgetPacingSnapshot,
                                ClientPacingSummary, PacingHealthCounts
  calculations.ts             — pure functions (no DB): calculateExpectedSpendToDate,
                                calculatePacingPercent, calculateProjectedEndOfPeriodSpend,
                                buildBudgetPacingSnapshot, countPacingByStatus
  service.ts                  — DB layer: CRUD + snapshot builders for client/campaign/all

app/api/clients/[clientId]/budget-target/route.ts    — GET + POST client target
app/api/campaigns/[campaignId]/budget-target/route.ts — GET + POST campaign target

app/pacing/
  page.tsx                    — server component: loads all client summaries
  PacingView.tsx              — client component: filters, cards, table, inline edit

components/ui/Sidebar.tsx     — Pacing nav item added

app/operations/
  page.tsx                    — loads topPacingRisks in parallel with other data
  OperationsView.tsx          — PacingRiskSection component + prop
```

---

## Limitations (v1)

1. **No budget write-back to Meta.** Targets are stored in this app only. The
   agency must update Meta manually if they want to adjust delivery budgets.

2. **Linear spend model only.** Real campaigns often front-load or back-load
   spend depending on dayparting and bidding strategy. A non-linear model
   (e.g. dayparted expected spend) is a future enhancement.

3. **Calendar month period only.** Custom date ranges (e.g. flight dates) are
   not supported in v1.

4. **No historical pacing.** Only the current month is tracked. Past month
   performance history is not stored.

5. **Meta spend only.** Spend comes from `MetaSyncedInsight`. If campaigns have
   not been synced recently, pacing figures will be stale. Run a Meta sync
   to refresh.

6. **No campaign-level pacing from the Pacing page.** Campaign-level targets
   can be set via the API but the `/pacing` UI only shows them as sub-rows
   for clients that have campaign targets configured.

---

## Preparing for automation rules

The pacing calculation layer (`lib/budgetPacing/calculations.ts`) is pure and
stateless — it can be called from automation rule evaluators without side effects.

The `BudgetPacingSnapshot` type includes `recommendation` and `pacingStatus`
fields designed to feed into automation actions:

```typescript
if (snapshot.pacingStatus === "under_pacing") {
  // propose: "increase_daily_spend" automation action
}
if (snapshot.pacingStatus === "over_pacing") {
  // propose: "reduce_daily_spend" automation action
}
```

When the automation rules + approval workflow step is built, pacing snapshots
should be loaded alongside campaign performance snapshots for each rule evaluation.
