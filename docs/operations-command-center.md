# Operations Command Center

## What it is

The Operations page (`/operations`) is the daily starting point for agency owners and media buyers. It aggregates system state across all clients and surfaces three categories of information:

1. **Needs Attention** — broken things that require intervention
2. **Opportunities** — campaigns performing above expectations
3. **Next Best Actions** — explicit, prioritised action items with direct deep-links

A client readiness table shows the configuration status of every client at a glance.

---

## How issues are detected

Issues are generated deterministically from existing system state. No AI or ML is involved.

| Issue | Trigger | Priority |
|---|---|---|
| `stale_sync` | Last completed sync > 48 hours ago | medium (>2d) or high (>7d) |
| `sync_failed` | Last sync run has `status = "failed"` | high |
| `missing_meta_mapping` | No `MetaSelectedAdAccount` linked to client | high |
| `missing_shopify` | No active `ShopifyConnection` linked to client | medium |
| `campaigns_below_goal` | `ReconciledCampaignPerformance.calculatedRoas` < `MetaCampaignGoal.roasGoalValue` | high |
| `no_campaign_goals` | Client has synced campaigns but none have a `MetaCampaignGoal` record | medium |
| `no_reconciliation` | Client has both Meta and Shopify but `ReconciledCampaignPerformance` is empty | medium |

---

## How opportunities are detected

| Opportunity | Trigger | Priority |
|---|---|---|
| `above_roas_goal` | ROAS > goalValue × 1.2 and spend ≥ $1,000 | medium |
| `ready_to_scale` | ROAS > goalValue × 1.2 and spend < $1,000 | high |
| `strong_performer` | ROAS ≥ 3.0 with no goal set | medium |

---

## Data sources

| Source | Used for |
|---|---|
| `ClientAccount` | Client list, workspace scoping |
| `MetaSelectedAdAccount` → `MetaAccessibleAdAccount` | Detecting Meta mapping, resolving ad account IDs |
| `ShopifyConnection` | Detecting Shopify integration |
| `ClientSyncRun` | Sync freshness and failure detection |
| `MetaSyncedCampaign` + `MetaCampaignGoal` | Campaign goal coverage |
| `ReconciledCampaignPerformance` | CRM-verified ROAS and CPA per campaign |

---

## Client readiness classification

| Status | Conditions |
|---|---|
| **Live** | Has Meta mapping + active Shopify + sync not stale + at least one campaign goal + has reconciled performance |
| **Partially Configured** | Has some integrations but not all complete |
| **Missing Integrations** | No Meta mapping AND no Shopify, but has had some activity |
| **Needs Setup** | No sync runs, no mappings, brand new client |

---

## Current limitations

- **No campaign-level goal checking for clients without reconciliation.** If reconciliation has never been run, goal adherence cannot be evaluated against CRM-verified ROAS.
- **UTM attribution noise.** The 7-day window fallback in the reconciliation engine introduces attribution noise in multi-campaign accounts. "Below goal" signals may reflect attribution gaps rather than true underperformance.
- **Sync freshness is based on `ClientSyncRun.completedAt`.** If a sync is `running` for a long time (stuck), it will not trigger the stale issue until it completes or fails.
- **No anomaly detection yet.** Sudden drops in CTR, spend pacing, or ROAS vs. 7-day average are not yet flagged. This is the next phase.
- **No automatic execution.** All action items are informational and require manual action. Meta write actions (pause/unpause, budget updates) are planned for Phase 4.

---

## Architecture

```
lib/operations/
  types.ts        — OperationsSnapshot, OperationsIssue, OperationsOpportunity,
                    OperationsAction, ClientReadinessRow (pure types, no deps)
  aggregator.ts   — buildOperationsSnapshot(workspaceId): OperationsSnapshot
                    Phase 1: parallel DB queries
                    Phase 2: campaigns+goals (requires adAccountIds from P1)
                    Phase 3: per-client state assessment
                    Phase 4: issue/opportunity/action generation
                    Phase 5: client readiness classification
                    Phase 6: snapshot assembly + priority sort
  index.ts        — public re-exports

app/operations/
  page.tsx        — server component, calls buildOperationsSnapshot()
  OperationsView.tsx — client component, pure display, no data fetching
```

## Extending for alerting (next phase)

The `OperationsSnapshot` type is designed to be serialisable — all fields are plain JSON. To add alerting:

1. Call `buildOperationsSnapshot()` from a cron route (e.g. `/api/cron/operations-alerts`)
2. Filter `issues` by priority and compare against a previously stored snapshot
3. Use Resend (already wired) to send email summaries for new high-priority issues
4. Store the last-sent snapshot hash to avoid duplicate alerts

No changes to `aggregator.ts` or the types are required for this extension.
