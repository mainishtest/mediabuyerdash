# Creative & Experiment Learning Memory

Route: `/insights/memory`
Phase 4 feature — captures and surfaces recurring patterns from experiments, campaigns, creative launches, and executed automations to inform future decisions.

---

## What the memory stores

Each entry is a `LearningMemoryEntry` — a normalised insight extracted from one of four source types:

| Source type | Origin table | Example insight |
|---|---|---|
| `experiment_outcome` | `ExperimentLearningRecord` | Winning hook/angle from a completed A/B test |
| `creative_outcome` | `ReconciledCampaignPerformance` | Campaign consistently beating ROAS target |
| `fatigue_outcome` | `ReconciledCampaignPerformance` | Campaign consistently below target |
| `publish_outcome` | `PublishPrepRecord` | Creative launched with a specific brief intent |
| `recommendation_outcome` | `ProposedAutomationAction` (executed) | Automation that was approved and run |

No new database tables are created. All data is read from existing Prisma models.

---

## How learnings are derived

### ExperimentLearningRecord (persisted learnings)
Queries `experimentLearningRecord` with its related `experiment`. Maps:
- `winningPattern` → `LearningCategory` (e.g. `hook_won` → `winning_hook`)
- `outcomeLabel` → `LearningConfidence`
- `detailJson` → evidence signals (label / value / direction)

These are the highest-signal entries because they come from deliberately-evaluated experiments.

### ReconciledCampaignPerformance (derived)
Groups the most recent 90 days of reconciled data by `externalCampaignId`. Compares the period's average ROAS against the client's `ClientGoalDefaults.targetRoas`:
- ≥ 115 % of target over 3+ periods → `winning_angle`, **high** confidence
- ≥ 115 % of target, fewer periods → `winning_angle`, **medium** confidence
- ≤ 80 % of target over 3+ periods → `poor_performer_pattern`, **high** confidence
- No goal defined → extreme fallback: > 3.5× → winning, < 0.8× → poor

### PublishPrepRecord (derived)
Queries records where `publishedAt IS NOT NULL`. Maps `briefIntent` to a `LearningCategory` via `INTENT_TO_CATEGORY`. Confidence is `medium` by default (launch conditions are observable but outcomes not yet linked).

### ProposedAutomationAction (derived)
Queries executed actions (`status = "executed"`). Maps `actionType` to a `LearningCategory` via `ACTION_TO_CATEGORY`. Confidence is `medium` — the action was approved and run, but downstream outcome is not tracked here.

---

## Confidence levels

| Level | Meaning |
|---|---|
| **high** | Experiment with complete data, or campaign 3+ periods consistently above/below goal |
| **medium** | Partial experiment data, single campaign period, executed automation, or publish without outcome link |
| **low** | Single observation, incomplete evidence, inferred from sparse data |

Entries are sorted high → medium → low, then by `createdAt` descending.

---

## Categories

| Category | What it means |
|---|---|
| `winning_hook` | A hook format or opening that drives strong engagement |
| `winning_angle` | A message angle (benefit / pain / social proof) that converts |
| `winning_offer_framing` | An offer structure or framing that lifts ROAS |
| `fatigue_pattern` | A creative or audience pattern showing performance decay |
| `poor_performer_pattern` | Consistently underperforming campaign or creative |
| `audience_message_fit` | Audience × message combination with strong signal |
| `launch_condition` | Conditions (budget, season, creative type) correlated with strong launches |
| `refresh_pattern` | When / how refreshing creatives restores performance |
| `experiment_pattern` | Meta-level patterns about what types of experiments yield results |

---

## Integration hooks

Three functions are exported from `lib/learningMemory/aggregator.ts` for use by other modules:

```typescript
// Full query with filters — used by the /insights/memory page
queryLearningMemory(query: LearningQuery): Promise<LearningMemoryEntry[]>

// Top 5 entries relevant to a workflow context — used by Creative Lab brief builder
queryLearningsForBrief(context: LearningSurfaceContext): Promise<LearningMemoryEntry[]>

// 1–2 sentence digest string — used by executive narrative and recommendation engine
buildLearningInsightSummary(entries: LearningMemoryEntry[]): string
```

### Using in Creative Lab (brief builder)

```typescript
import { queryLearningsForBrief } from "@/lib/learningMemory/aggregator";

const relevant = await queryLearningsForBrief({
  workflowType: "creative_brief",
  clientId: campaign.clientAccountId,
  campaignId: campaign.id,
  draftType: "ugc_hook",
});
// Returns up to 5 usable-for-briefs entries, intent-matched first
```

### Using in executive narrative

```typescript
import { queryLearningMemory, buildLearningInsightSummary } from "@/lib/learningMemory/aggregator";

const entries = await queryLearningMemory({ clientId, dateFrom, dateTo, limit: 20 });
const digest  = buildLearningInsightSummary(entries);
// digest is a plain string like "3 high-confidence learnings: hook-led videos outperform..."
```

---

## UI features

- **Filter bar** — client, date range (URL-driven re-fetch), category, confidence, source type, group-by-category toggle
- **Summary bar** — total count, high-confidence count, experiment count, usable-for-briefs count; sparse-data warning if < 5 entries; top insight sentence
- **Top Learnings** — first 5 entries after filters
- **Recurring Patterns** — entries grouped by `category:pattern` key, showing occurrence count and example insight
- **All Learnings** — full filtered list, flat or grouped by category
- **Client breakdown** — click to drill into a single client (shown when > 1 client has learnings)
- **Expandable evidence** — each card shows evidence signals (label / value / direction) and related entities on demand

---

## Limitations

- Publish and automation learnings are inferred, not experimentally validated. Treat `medium` confidence entries as directional signals, not proven facts.
- Campaign performance learnings use 90-day average ROAS. They do not account for seasonality or budget changes.
- No learning is deleted; stale entries will age out of the default 90-day window but remain queryable with a wider date range.
- `queryLearningsForBrief` returns at most 5 entries. Increase `limit` in the call if more context is needed.
