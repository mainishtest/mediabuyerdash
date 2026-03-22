# First-Sync Data Validation & Account Health Check

## How First-Sync Validation Works

After the first Meta and Shopify syncs complete, the health check validates whether the ingested data is trustworthy enough for operational decisions.

`buildFirstSyncValidationSummary(workspaceId)` in `lib/health/evaluate.ts` runs all validation checks in parallel and returns a unified summary including trust state, issues, and recommendations.

### Data Sources Queried

| Source | What's Checked |
|--------|---------------|
| `MetaSyncedInsight` | Spend amounts by date (14-day lookback), date coverage, gaps |
| `ShopifyOrder` | Revenue by date, order counts, Facebook-attributed revenue via UTM |
| `MetaSyncLog` | Last sync time for freshness |
| `ShopifySyncLog` | Last sync time for freshness |
| `Workspace` | Timezone configuration |
| `ClientAccount` + `MetaSelectedAdAccount` | Client-to-ad-account mapping |

## Trust States

| State | Meaning | Dashboard Access |
|-------|---------|-----------------|
| `unverified` | No synced data to validate | Should not use dashboard |
| `healthy` | All required checks pass, no anomalies | Safe to use dashboard |
| `warning` | Required checks have warnings | Can use dashboard with caution |
| `suspect` | Optional anomalies detected | Investigate before relying on numbers |
| `blocked` | Required checks fail | Fix issues before using dashboard |

### Trust State Computation

```
No data at all            → unverified
Any required check fails  → blocked
Any required warning      → warning
Optional warnings only    → suspect
All pass                  → healthy
```

## Checks: Required vs Warning-Only

### Required Checks (block trust if failed)

| Check | Category | Validates |
|-------|----------|-----------|
| Spend data present | meta_spend_coverage | MetaSyncedInsight has spend > 0 in last 14 days |
| Revenue data present | shopify_revenue_coverage | ShopifyOrder has revenue in last 14 days |
| Meta sync freshness | sync_freshness | Last MetaSyncLog completed within 48 hours |
| Shopify sync freshness | sync_freshness | Last ShopifySyncLog completed within 48 hours |
| Timezone configured | timezone_alignment | Valid IANA timezone on workspace |
| Clients mapped | account_mapping | At least one client has MetaSelectedAdAccount |

### Warning-Only Checks

| Check | Category | Validates |
|-------|----------|-----------|
| Spend date coverage | meta_spend_coverage | >= 3 days of spend data |
| Revenue date coverage | shopify_revenue_coverage | >= 1 day with orders |
| Attribution sanity | attribution_sanity | FB-attributed revenue exists and is reasonable (not 95%+) |
| Date gap detection | date_gap_detection | No major gaps in spend or revenue date series |

## How Dashboard Access Should Be Gated

The health page computes `canProceed = trustState === "healthy" || trustState === "warning"`.

Recommended gating:
1. **Readiness page** (`/readiness`) — checks setup completeness. Links to health page.
2. **Health page** (`/health`) — checks data quality. Shows "Continue to Dashboard" only when trust state allows.
3. **Dashboard** (`/home`) — should be usable once health check passes.

For stricter gating, the executive summary could check trust state before showing recommendations. This is not implemented yet but `buildFirstSyncValidationSummary()` can be called from any server component.

## How Blockers Are Resolved

Each issue includes:
- **Message**: What's wrong
- **Severity**: `critical` or `warning`
- **Action label**: What to do
- **Action href**: Direct link to the fix

Common resolution paths:
| Issue | Fix |
|-------|-----|
| No spend data | Connect Meta → run sync → wait for insights import |
| No revenue data | Connect Shopify → run sync → wait for order import |
| Stale sync | Go to integration page → retry sync |
| No timezone | Go to onboarding → set workspace timezone |
| No client mapping | Go to clients → map ad accounts |
| No FB attribution | Check Shopify UTM tracking setup |

## Key Files

| File | Purpose |
|------|---------|
| `lib/health/types.ts` | All typed models |
| `lib/health/evaluate.ts` | Validation logic, trust computation, issue detection |
| `app/health/page.tsx` | Server component |
| `app/health/HealthView.tsx` | Client component, health dashboard UI |

## Current Limitations

1. **14-day lookback only** — doesn't validate historical data beyond 14 days
2. **No scheduled re-validation** — health is computed on page load
3. **No email alerts** when health degrades
4. **Timezone comparison is basic** — checks workspace timezone is valid IANA but doesn't compare against Meta ad account timezone (requires Meta API call)
5. **Attribution check is heuristic** — flags >95% FB-attributed as anomalous but cannot verify UTM correctness
6. **Date gaps include weekends** — no awareness of business-specific non-spend days
7. **Single workspace scope** — doesn't aggregate across workspaces
