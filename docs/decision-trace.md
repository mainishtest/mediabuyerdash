# Explainability, Confidence, and Decision Trace Layer

Route: `/insights/trace`
Phase 5 feature — makes every recommendation, assistant response, experiment outcome, creative score, and publish guardrail check transparent, inspectable, and auditable.

---

## What traceable outputs are supported

| Output type | Surface | What it explains |
|---|---|---|
| `campaign_recommendation` | `/optimization` | Why a campaign was labelled strong/below_goal and what action was recommended |
| `assistant_response` | `/assistant` | What data the AI used, how the intent was classified, and whether the response was AI-generated or template-based |
| `experiment_outcome` | `/experiments` | How winner detection worked, what lift was measured, statistical confidence, and guardrail checks |
| `creative_score` | `/creative-lab/review` | Dimension scores, scoring weights, policy risk detection, and approval readiness |
| `publish_guardrail` | `/creative-lab/publish-prep` | Every guardrail check result with blocking vs warning severity |

---

## What each trace shows

Every `DecisionTrace` contains:

| Field | Description |
|---|---|
| `summary` | One-sentence human-readable explanation of the output |
| `confidence` | Level (high/medium/low), numeric score 0–100, positive/negative factors |
| `steps[]` | Ordered logic trail — each decision step with pass/fail status |
| `evidence[]` | Data points used, with source attribution and CRM source-of-truth marking |
| `influences[]` | Rules, goals, thresholds, learnings, and guardrails that shaped the output |
| `constraints[]` | Immutable system constraints applied (attribution window, CRM rule, timezone) |
| `limitations[]` | Data gaps, short windows, missing goals, conflicting signals |
| `actionLinks[]` | Navigation to the relevant workflow destination |
| `dataWarnings[]` | Warnings from the data aggregation layer |

---

## How confidence is determined

Confidence is **point-scored 0–100** from data quality signals. No ML or probabilistic models are used.

**Score → level:**
- ≥ 70: **high**
- 40–69: **medium**
- < 40: **low**

**Scoring factors (apply across output types):**

| Signal | Points |
|---|---|
| CRM ROAS/CPA data present | +30 |
| Goal configured | +20 |
| Full 7-day attribution window | +20 |
| Consistent performance signal | +15 |
| Multiple data sources | +15 |
| Data warning present | −20 each |
| No goal configured | −30 |

**Output-specific factors also apply:**
- Experiments: statistical confidence score, conversion volume, spend coverage
- Creative scores: overall score level, failing dimensions, brief context presence
- Guardrails: required vs optional pass/fail counts

---

## What evidence is shown

Evidence items are extracted from already-computed output data — no additional queries are run during trace construction.

**CRM source-of-truth items** (marked with ★) always use Shopify/CRM reconciliation data:
- Evaluated ROAS
- Evaluated CPA
- CRM revenue
- CRM orders
- Conversion counts

**Non-source-of-truth items** (delivery data, heuristic scores, thresholds):
- Meta spend
- Statistical lift percentage
- Dimension scores
- Guardrail check results

---

## How limitations are surfaced

Limitations are displayed in three severities:

| Severity | Meaning |
|---|---|
| **blocking** | Prevents action — e.g. required guardrail failed, experiment data insufficient |
| **warning** | May affect accuracy — e.g. short data window, low conversion volume |
| **informational** | Context only — e.g. attribution window reminder, heuristic scoring note |

All traces display at least the standard informational limitations:
- 7-day attribution window constraint
- CRM reconciliation delay (24–48h)

---

## How to access traces

**In the AI Assistant:** Each response card shows a confidence badge (high/medium/low) and a "View reasoning" link. Clicking it opens a trace drawer showing the full decision trace.

**In the Decision Trace Explorer (`/insights/trace`):** Overview of all traceable surfaces, confidence scoring model reference, and links to each workflow.

**Programmatically:** Import builder functions from `lib/decisionTrace/traceBuilder.ts`:

```typescript
import {
  buildCampaignRecommendationTrace,
  buildAssistantResponseTrace,
  buildExperimentOutcomeTrace,
  buildPublishGuardrailTrace,
  summarizeDecisionTrace,
  attachTraceToOutput,
} from "@/lib/decisionTrace/traceBuilder";
```

**Reusable UI components:**

```tsx
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { TraceDrawer }     from "@/components/ui/TraceDrawer";

// Show confidence badge (inline)
<ConfidenceBadge level={trace.confidence.level} score={trace.confidence.score} />
<ConfidenceBadge level="high" compact />  // icon-only for tight spaces

// Show full trace in a slide-over drawer
const [open, setOpen] = useState(false);
<button onClick={() => setOpen(true)}>View reasoning</button>
<TraceDrawer trace={trace} open={open} onClose={() => setOpen(false)} />
```

---

## Adding traces to new surfaces

1. Build the trace using the appropriate builder:
   ```typescript
   const trace = buildCampaignRecommendationTrace({ campaignId, campaignName, ... });
   ```

2. Pass the confidence level to `ConfidenceBadge` for inline display.

3. Wire `TraceDrawer` to a button or badge click.

4. Optionally use `attachTraceToOutput(outputObject, trace)` to carry trace metadata alongside the output.

---

## Architecture

```
Existing output data (no new DB queries)
    ↓
lib/decisionTrace/
  confidence.ts   → point-scored confidence per output type
  evidence.ts     → evidence items with source attribution
  influences.ts   → rules, goals, thresholds, learnings applied
  limitations.ts  → data gaps and known constraints
  traceBuilder.ts → assembles DecisionTrace from all above

components/ui/
  ConfidenceBadge.tsx  → inline confidence display
  TraceDrawer.tsx      → slide-over trace inspection panel

app/insights/trace/
  page.tsx             → /insights/trace overview (server rendered)
  TraceView.tsx        → traceable surfaces reference + confidence guide
```

---

## Current limitations

- **Traces are not persisted.** They are assembled on-demand from existing output data. Re-opening a trace always reflects current data state — past traces are not archived.
- **Campaign traces require live snapshot data.** The `buildCampaignRecommendationTrace()` builder must be called at the point where the recommendation is already computed — it cannot independently re-query the DB.
- **Assistant traces exclude learning memory context.** The `buildAssistantResponseTrace()` builder runs on the client from the response object, which does not include the full server-side context. The `learningCount` field defaults to 0 unless explicitly set by the caller.
- **Creative score traces** require integration with the `CreativeDraftScorecard` type — currently the drawer integration is available but the creative review surface needs a wiring step to call `buildCreativeScoreTrace()` (planned for the next step).
- **No trace versioning.** If the recommendation logic changes, old traces based on previous rules cannot be retroactively updated.

---

## Preparing for Phase 6 (Autonomous Optimization Modes)

The trace layer is designed to support explicit safety tier enforcement in the next step:

- `DecisionLimitation.severity === "blocking"` maps directly to a safety gate check
- `DecisionConfidence.level` can be used as a precondition for autonomous execution tiers
- `DecisionConstraint` items define the non-bypassable rules that autonomous modes must respect
- `attachTraceToOutput()` allows any auto-execution payload to carry its full decision trace for audit logging
