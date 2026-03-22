# Account Readiness Validation & Go-Live Dashboard

## How Readiness Is Evaluated

The readiness system composes signals from existing modules:

```
Workspace model     → workspace exists, brand name, timezone
OnboardingState     → onboarding completed
MetaConnection      → OAuth active, accounts selected, sync healthy
ShopifyConnection   → store connected, orders syncing
ClientAccount       → at least one client exists
ClientGoalDefaults  → ROAS/CPA targets configured
AutoExecutionSettings → automation configured
```

`buildAccountReadinessSummary(workspaceId)` in `lib/readiness/evaluate.ts` runs all checks in parallel and returns a unified summary.

## Required vs Optional Checks

### Required (blocks go-live)
| Check | Category | What It Validates |
|-------|----------|-------------------|
| Workspace exists | workspace_setup | Workspace record present |
| At least one client | client_setup | ClientAccount exists for workspace |
| Meta connected | meta_connection | Active MetaConnection with valid token |
| Ad accounts selected | meta_connection | MetaSelectedAdAccount count > 0 |
| Meta sync healthy | meta_connection | Last sync completed or partial |
| Shopify connected | shopify_connection | Active ShopifyConnection |
| Revenue sync healthy | shopify_connection | Last Shopify sync not failed |
| Overall sync health | sync_health | Both syncs operational |
| Timezone configured | timezone_configuration | Workspace timezone is set |

### Optional (recommended but not blocking)
| Check | Category | What It Validates |
|-------|----------|-------------------|
| Onboarding complete | workspace_setup | OnboardingState.completedAt set |
| Business profile | workspace_setup | Workspace.brandName populated |
| Performance goals | goals_configuration | ClientGoalDefaults exist |
| Automation settings | governance_defaults | AutoExecutionSettings configured |

## Go-Live Status Computation

```typescript
if (no required checks pass)     → "not_started"
if (any required check fails)    → "blocked"
if (any required check warning)  → "needs_review"
if (all required checks pass)    → "ready_for_go_live"
```

`readyToOperate` is true when there are **no required failures** — warnings are acceptable.

## Blocker Resolution

Each blocker includes:
- **Message**: What's wrong
- **Action label**: What to do (e.g., "Connect Meta", "Run Sync")
- **Action href**: Direct link to the fix page

Blockers are derived from required checks with `status === "fail"`.

## Recommendations

Generated in priority order:
1. **Required**: Fix blockers (from failed required checks)
2. **Recommended**: Address warnings (from required checks with warnings)
3. **Optional**: Complete optional checks

## Route

`/readiness` — accessible from sidebar under Settings section and as the post-onboarding destination.

## Integration with Onboarding

When onboarding completes ("Check Readiness & Go Live" button), the user is redirected to `/readiness` instead of directly to `/home`. This ensures they see a clear picture of what's ready and what needs attention.

## Key Files

| File | Purpose |
|------|---------|
| `lib/readiness/types.ts` | All typed models |
| `lib/readiness/evaluate.ts` | Evaluation logic, blocker detection, go-live computation |
| `app/readiness/page.tsx` | Server component, loads summary |
| `app/readiness/ReadinessView.tsx` | Client component, renders dashboard |

## Current Limitations

1. **No "Mark as Live" action** — go-live is a read-only status, not a state transition
2. **No email notification** when readiness changes
3. **No scheduled re-evaluation** — readiness is computed on page load
4. **Governance checks are optional** — safety policies aren't required for go-live
5. **Single workspace** — readiness is per-workspace, not per-client
