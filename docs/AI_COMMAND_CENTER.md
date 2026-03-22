# AI Command Center

## Overview

The AI Command Center (`/command`) is a natural-language operator surface that combines real-time status cards with a conversational AI assistant. Operators can ask questions like "What should I do today?" and get grounded, evidence-backed answers with direct links to workflows.

## Architecture

```
lib/optimizationAssistant/
  types.ts             — Session, message, context, response types (expanded)
  contextAssembler.ts  — Server-only: pulls from CommandCenter + Executive + Learning Memory
  contextPrompt.ts     — Converts context to compact text for LLM
  intentClassifier.ts  — Pure keyword-based intent classification (16 intents)
  responseBuilder.ts   — Calls Anthropic API + template fallback
  evidence.ts          — Deterministic evidence extraction per intent
  actionLinks.ts       — Workflow navigation links per intent
  suggestions.ts       — Follow-up question suggestions per intent

app/command/
  page.tsx             — Server page (assembles status data)
  CommandView.tsx      — Client view (status cards + conversation)
  sections/
    StatusCards.tsx     — Quick-glance operator metrics
    QuickActions.tsx    — One-tap question buttons
    ResponsePanel.tsx   — Answer + evidence + entities + actions

app/api/assistant/
  route.ts             — POST endpoint (shared with /assistant)
```

### Key Design Decisions

1. **Reuses existing assistant infrastructure** — Same API endpoint, context assembler, intent classifier. The `/command` route is a new UX surface on top of the same engine.
2. **Status cards are server-rendered** — Pre-populated from `buildOptimizationAssistantContext()` on page load. No additional API call needed.
3. **LLM generates summary text only** — Evidence, entities, action links, and suggestions are all built deterministically from context data. The LLM never invents facts.
4. **Template fallback** — When Anthropic API is not configured, grounded template responses are built from context data.

## Supported Intents (16)

| Intent | Example Questions |
|--------|------------------|
| `summarize_today` | "What should I do today?", "Morning brief" |
| `summarize_account_state` | "How are things looking?", "Account summary" |
| `summarize_week` | "What happened this week?", "Weekly rollup" |
| `explain_performance_drop` | "Why is ROAS dropping?", "Why did revenue fall?" |
| `identify_goal_risk` | "Which campaigns are at goal risk?" |
| `recommend_next_actions` | "What should I work on?", "What's most important?" |
| `explain_winner` | "What's working?", "Best performing campaigns" |
| `explain_loser` | "What's underperforming?", "Worst campaigns" |
| `find_scale_candidates` | "What should I scale?", "Scale opportunities" |
| `find_accounts_at_risk` | "Which accounts are at risk?", "Problem accounts" |
| `summarize_creative_fatigue` | "Which creative should I refresh?" |
| `summarize_experiment_status` | "Experiment status", "A/B test results" |
| `summarize_recent_tests` | "Recent test results", "What tests ran?" |
| `summarize_blockers` | "What's blocked?", "What's stuck?" |
| `identify_pending_approvals` | "What approvals are waiting?" |
| `find_highest_priority_issue` | "What's most urgent?", "Biggest issue" |

## Context Assembly

`buildOptimizationAssistantContext()` pulls from 3 aggregators in parallel:

1. **Command Center** → spend, revenue, ROAS, CPA, alerts, approvals, experiments, creative, pacing, outcomes, recent actions
2. **Executive Reporting** → KPI cards with deltas, narrative sections
3. **Learning Memory** → patterns, insights, experiment learnings

The assembled context includes:
- Portfolio KPIs (spend, revenue, ROAS, CPA)
- Open alerts, pending approvals, active experiments
- Outcome routing counts (winners, losers, scale-ready, refresh-needed)
- Recent action counts (total, failed, blocked)
- Top priorities, pacing risks
- KPI trends with deltas
- High-confidence learnings

## Response Flow

1. User asks a question
2. `classifyOptimizationAssistantIntent()` maps question → intent (pure keyword scoring)
3. `buildOptimizationAssistantContext()` assembles data from existing aggregators
4. Deterministic builders produce evidence, entities, action links, suggestions
5. `callAnthropic()` generates summary text (or template fallback)
6. Response returned with `isGrounded: true`

## Grounding Rules

- LLM receives only assembled context data in the prompt — no external knowledge
- Evidence items are extracted deterministically from context
- Entity references link to real app pages
- Action links point to existing workflow routes
- Data warnings are surfaced when context is sparse or suspect
- The system never invents metrics, campaign names, or dates

## Status Cards

Pre-populated server-side on page load. Show:
- Total spend, ROAS
- Open alerts, pending approvals
- Scale-ready winners, total winners/losers
- Active experiments
- Blocked actions

Each card links to the relevant detail page.

## Integration Points

| System | Integration |
|--------|------------|
| **Morning Brief** | `summarize_today` intent; action link to `/briefs` |
| **Weekly Rollup** | `summarize_week` intent; action link to `/weekly` |
| **Command Center** | Status cards + action links to `/command-center` |
| **Action History** | `summarize_blockers` intent; links to `/history` |
| **Creative Lab** | `summarize_creative_fatigue` intent; links to `/creative-lab` |
| **Experiments** | `summarize_recent_tests` intent; links to `/creative-lab/results` |
| **Scale Review** | `find_scale_candidates` intent; links to `/creative-lab/outcomes` |
| **Learning Memory** | Patterns included in context; links to `/insights/memory` |
| **Approvals** | `identify_pending_approvals` intent; links to `/automation` |

## Safe Handling

| Scenario | Behavior |
|----------|----------|
| Sparse data | `dataWarnings` array populated; template says "data may not be synced" |
| No Anthropic key | Template fallback generates grounded text from context |
| Unknown intent | Falls back to `find_highest_priority_issue` |
| Suspect trust state | Warning surfaced in context prompt and data warnings |
| Missing entities | Evidence/entities built from available data only |
| API error | Error message displayed; no partial response |

## Current Limitations

1. **No conversation memory** — Each question is independent (no multi-turn context)
2. **No streaming** — Response arrives all at once after LLM completes
3. **Keyword-based intent** — No LLM used for classification; complex queries may misclassify
4. **Single workspace** — No cross-workspace queries
5. **English only** — Intent keywords are English
