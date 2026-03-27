# Reconciliation Engine — Strategy & Setup

## Overview

The reconciliation engine matches Meta ad delivery data against Shopify/CRM
order data to produce evaluated CPA and ROAS figures that use the CRM as the
authoritative source of business outcomes.

---

## Architecture

```
lib/reconciliation/
  utils.ts       — normalizeUtmValue, buildReconciliationMatchKey,
                   buildPartialMatchKey, calculateEvaluatedCpa, calculateEvaluatedRoas
  matchEngine.ts — reconcileMetaRowsWithShopifyOrders() (pure, no DB)
  summarize.ts   — summarizeReconciliationResults() (pure, no DB)
  persist.ts     — persistReconciliationMatches(), persistReconciliationSummary() (DB writes)
  index.ts       — public re-exports

types/reconciliation.ts   — ReconciliationMatchRow, ReconciliationComputedSummary
prisma/schema.prisma      — ReconciliationMatch model, ReconciliationSummary model
app/reconciliation/       — /reconciliation page (server component + client view)
```

**Design principles:**
- Matching logic is pure (no DB, no side effects) — testable in isolation
- Summary calculation is pure — separate from matching
- DB writes are isolated in `persist.ts` — not called by the UI layer
- Page uses in-memory computation with sample data (v1)

---

## Reconciliation Flow

```
1. META SIDE  → UTMPerformanceRow[]  (from Meta sync / lib/data/utmReporting.ts)
2. CRM SIDE   → CRMOrderRecord[]     (from Shopify sync / lib/data/crmReporting.ts)
              ↓
3. reconcileMetaRowsWithShopifyOrders()
              ↓
4. ReconciliationMatchRow[]  (one per Meta row + one per unmatched CRM group)
              ↓
5. summarizeReconciliationResults()
              ↓
6. ReconciliationComputedSummary  (aggregate totals + row counts)
```

---

## Matching Strategy (v1 — first pass)

### Primary match (exact key)

Fields used:
```
clientAccountId + date + utmCampaign + utmContent + utmTerm
```

If all five fields match between a Meta row and a CRM order group, the row is
classified as **`matched`**.

UTM values are normalized before matching:
- Trimmed of whitespace
- Lowercased
- `null`, `undefined`, `""` → `""` (empty string)

### Fallback match (partial key)

If no exact match is found, the engine falls back to:
```
clientAccountId + date + utmCampaign
```

A fallback match is classified as **`partial`** — indicating that the link is
probable but not precise (missing utmContent or utmTerm on one side).

### No match

- Meta row with no CRM counterpart → **`unmatched_meta`**
- CRM aggregation group with no Meta row → **`unmatched_crm`**
- Multiple Meta rows claiming the same CRM group → second claimant → **`ambiguous`**

---

## Attribution Window

**Product rule:** Attribution window is 7 days.

**v1 pragmatic implementation:**

In v1, matching is performed on exact date only. This covers the most common
case: a customer clicks a Meta ad and purchases on the same day.

The full 7-day window (matching CRM orders from T to T+7 against a Meta row
on date T) is a planned v2 enhancement. The `attributionWindowDays` value is
already stored on every `ReconciliationMatch` row so that v2 can change
matching behavior without a schema migration.

**Known limitation:** v1 will undercount CRM orders for campaigns where the
purchase cycle spans multiple days (e.g., retargeting campaigns where users
convert 2–5 days after the initial click).

---

## CRM as Source of Truth — Metric Resolution

| Metric | Source | Formula |
|---|---|---|
| `evaluatedCpa` | CRM orders + Meta spend | `metaSpend / crmOrders` |
| `evaluatedRoas` | CRM revenue + Meta spend | `crmRevenue / metaSpend` |
| `metaSpend` | Meta (delivery) | raw from Meta sync |
| `metaClicks` | Meta (delivery) | raw from Meta sync |
| `metaImpressions` | Meta (delivery) | raw from Meta sync |
| `crmOrders` | Shopify/CRM | raw from CRM sync |
| `crmRevenue` | Shopify/CRM | raw from CRM sync |

**Meta's own conversion count and revenue are NOT used for evaluated metrics.**
They are not stored on `ReconciliationMatch` by design.

### Edge cases

| Condition | Behavior |
|---|---|
| `crmOrders = 0` | `evaluatedCpa = null` |
| `metaSpend = 0` | `evaluatedRoas = null` |
| `matchStatus = unmatched_meta` | `crmOrders = 0`, `crmRevenue = 0`, both null |
| `matchStatus = unmatched_crm` | `metaSpend = 0`, evaluated metrics = null |

---

## Fields Used for Matching

| Field | Source | Notes |
|---|---|---|
| `clientAccountId` | Both sides | Scopes reconciliation to one account |
| `date` | Both sides | ISO date (YYYY-MM-DD); v1 exact match only |
| `utmCampaign` | Both sides | Normalized (lowercase, trimmed) |
| `utmContent` | Both sides | Normalized; missing → fallback match |
| `utmTerm` | Both sides | Normalized; missing → fallback match |

---

## Prisma Models

### `ReconciliationMatch`

One row per matched/unmatched pair. Upserted on `(clientAccountId, matchKey)`.

### `ReconciliationSummary`

One row per `(clientAccountId, dateFrom, dateTo)` reconciliation run.
Stores aggregate totals for fast dashboard reads.

---

## Known Limitations (v1)

1. **Exact date matching only** — full 7-day attribution window is not implemented
2. **No multi-touch attribution** — each CRM order is attributed to at most one Meta row
3. **UTM hygiene required** — missing UTMs produce partial or unmatched rows
4. **No de-duplication of CRM orders** — if an order appears in both Shopify and Konnective, it will be double-counted (future: source de-duplication)
5. **Fallback is campaign-level only** — content/term mismatch is not handled beyond campaign-level grouping
6. **No client account selector in UI** — v1 hardcodes `act_1`; multi-account support is a next step

---

## Next Steps (v2 / optimization layer)

- Wire `persist.ts` to the Shopify sync pipeline to persist matches after each sync
- Replace sample data with real DB queries against `MetaSyncedInsight` + `ShopifyOrder`
- Expand attribution window to full 7-day join
- Feed `ReconciliationMatch` rows into goal-aware optimization engine
  (evaluated ROAS / CPA vs campaign goal = optimization signal)
- Add client account selector to the reconciliation page
