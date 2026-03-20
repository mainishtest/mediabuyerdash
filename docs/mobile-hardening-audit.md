# Second-Pass Mobile & Production-State Hardening Audit

**Date:** 2026-03-20
**Branch:** `claude/cursor-to-claude-transition-5xKoY`
**Scope:** Second pass — highest-risk user flows, mobile-first functional validation, production-like state coverage

---

## Audit Approach

Files were read in full for each high-risk flow. Issues were classified by whether the core action was:
- **Inaccessible** on mobile (P1 — fix immediately)
- **Operable but fragile** under real constraints (P2 — fix in this pass)
- **Rough UX** increasing user-error risk (P3 — fix in this pass)

---

## High-Risk Flows Audited

| Flow | Entry Point | Files Read |
|------|-------------|------------|
| App navigation (mobile) | AppShell + Sidebar | `components/ui/AppShell.tsx`, `components/ui/Sidebar.tsx` |
| Command Center | `/command-center` | `CommandCenterView.tsx`, all section components |
| Governance approvals | `/automation/governance` | `GovernanceView.tsx` (947 lines) |
| Creative Lab Publish Prep | `/creative-lab/publish-prep` | `PublishPrepView.tsx`, `PublishPrepDetail.tsx` (710 lines) |
| Experiment Results | `/experiments` | `ExperimentsView.tsx`, `ExperimentResultDetail.tsx` |
| AI Assistant | `/assistant` | `AssistantView.tsx` |
| Decision Trace drawer | Used across multiple flows | `TraceDrawer.tsx` |
| Portfolio | `/portfolio`, `/portfolio/governance`, `/portfolio/controls` | Server page components |

---

## Production-Like States Tested (by inspection)

| State | Coverage |
|-------|----------|
| Empty state (no data) | ✅ All page-level empty states verified — all have next-action CTAs |
| Error state (API failure) | ✅ All client handlers have try/catch with user-facing messages |
| Loading/pending state | ✅ All action handlers disable buttons while pending |
| Partial data | ✅ Null guards exist on snapshot/result fields; fallback UIs verified |
| Stale data | ✅ `force-dynamic` on all data-heavy pages |
| Missing linked entity | ✅ `loadExperimentById` returns null-safe fallback |
| Low-confidence/insufficient-data | ✅ ExperimentResultDetail shows inline callouts |
| Blocked/approval-required state | ✅ PublishPrepDetail disables Approve when `isBlocked` |
| Action failure | ✅ Error banners shown on all PATCH/POST failures |

---

## Mobile Issues Found

### P1 — Core Actions Inaccessible on Mobile

#### [FIXED] AppShell — Hamburger menu button touch target too small
- **File:** `components/ui/AppShell.tsx:96`
- **Issue:** `p-1.5` = 32px touch target. Minimum is 44px (Apple HIG / WCAG).
- **Impact:** On mobile, the only way to open navigation is hard to reliably tap, especially in one-handed use.
- **Fix:** Changed `p-1.5` → `p-2.5` (45px target).

#### [FIXED] AssistantView — Layout causes double-scroll and broken sticky input
- **File:** `app/assistant/AssistantView.tsx:240`
- **Issue:** Outermost div used `h-full min-h-screen`. Inside `AppShell`'s `flex-1 overflow-y-auto` main container, `min-h-screen` made the assistant taller than the viewport, causing `main` to scroll. The inner conversation area also tried to scroll (`flex-1 overflow-y-auto`). The sticky input (`sticky bottom-0`) would stick within the wrong scroll context on some mobile browsers.
- **Fix:** Changed to `h-full` (no `min-h-screen`). Changed input wrapper from `sticky bottom-0` to `shrink-0` — it naturally sits at the bottom of the flex column.

#### [FIXED] AssistantView — FilterBar unusable on narrow mobile screens
- **File:** `app/assistant/AssistantView.tsx:37-68`
- **Issue:** Filter bar contained 3 inputs (ClientID w-36 + date-from + date-to) + Apply button in a single `flex-wrap` row. On 375px mobile screens the inputs collectively exceed the available width and wrap awkwardly into a broken two-row layout that is confusing and hard to complete.
- **Fix:** Added a collapsible toggle on mobile. On screens narrower than `sm:` (640px), shows a compact "Context filter / Edit" header row. Tapping "Edit" reveals the full filter inputs. On `sm:` and wider, filter always shows. The "Apply" button also closes the filter panel on mobile after applying.

#### [FIXED] GovernanceView — Emergency stop Clear buttons below minimum touch target
- **File:** `app/automation/governance/GovernanceView.tsx:190-197, 248-255`
- **Issue:** `StopCard` and `OverrideCard` "Clear" buttons used `px-2 py-1` = ~28px height. These are critical safety operations (clearing emergency stops on live automation) and must be reliably tappable.
- **Fix:** Changed both to `px-3 py-2.5 min-h-[44px]`.

#### [FIXED] GovernanceView — AddStopForm Cancel button below minimum touch target
- **File:** `app/automation/governance/GovernanceView.tsx:474`
- **Issue:** `px-3 py-1.5` = ~30px.
- **Fix:** `px-3 py-2.5 min-h-[44px]`.

#### [FIXED] PublishPrepView — Mobile stacked view actions silently broken
- **File:** `app/creative-lab/publish-prep/PublishPrepView.tsx`
- **Issue:** `handleAction` closed over `selectedId` state (which is null in the mobile stacked fallback — only shown when no item is selected). Tapping Approve/Hold/Publish in the mobile stacked view would return immediately with no feedback.
- **Fix:** Changed `handleAction` to accept explicit `itemId` as first parameter. Changed `pending: boolean` to `pendingId: string | null` to track which specific item is in-flight. Both the selected-item panel and the mobile stacked fallback now pass item-specific bound handlers.

#### [FIXED] ExperimentsView — Mobile stacked view Evaluate/Archive silently broken
- **File:** `app/experiments/ExperimentsView.tsx`
- **Issue:** Same pattern — `handleEvaluate` and `handleArchive` required `selectedId` which is null in the stacked fallback.
- **Fix:** Replaced with `handleEvaluateFor(experimentId)` and `handleArchiveFor(experimentId)` factory functions that each return a bound async handler for that experiment. Both panels now receive experiment-specific handlers.

#### [FIXED] Sidebar — Left rail visual indicator positioned incorrectly
- **File:** `components/ui/Sidebar.tsx:170`
- **Issue:** `<div className="absolute ml-[-13px]...">` inside `<ul className="mt-0.5 space-y-0.5 pl-5">` without `position: relative` on the `<ul>`. The left rail was being positioned relative to a distant ancestor (likely the sidebar `<aside>`), not the nav group's child list — causing it to render at the wrong coordinates.
- **Fix:** Added `relative` to the `<ul>`: `<ul className="relative mt-0.5 space-y-0.5 pl-5">`.

---

### P2 — Hard to Use Under Mobile Constraints

#### [FIXED] TraceDrawer — Close button too small
- **File:** `components/ui/TraceDrawer.tsx:219`
- **Issue:** `p-1.5` = 32px touch target on the only close mechanism for the drawer. On mobile the drawer fills most of the screen and the close button must be reliably tappable.
- **Fix:** `p-1.5` → `p-2.5`.

#### [FIXED] PublishPrepView — Filter chip touch targets too small
- **File:** `app/creative-lab/publish-prep/PublishPrepView.tsx:160`
- **Issue:** 8 filter chips at `py-1` = ~26px height. The "Ready for Approval" chip label is 19 characters — chips were small and hard to tap.
- **Fix:** `py-1` → `py-2` (~34px).

#### [FIXED] ExperimentsView — Filter chip touch targets too small
- **File:** `app/experiments/ExperimentsView.tsx:170`
- **Issue:** Same `py-1` pattern.
- **Fix:** `py-1` → `py-2`.

#### [FIXED] GovernanceView — Error banner dismiss button has no tap area
- **File:** `app/automation/governance/GovernanceView.tsx:759`
- **Issue:** Error dismiss was an inline `×` text character with only `ml-2` margin — no click target area.
- **Fix:** Wrapped in a button with `inline-flex h-6 w-6 items-center justify-center rounded` and hover state.

---

### P3 — Rough UX / Increased Error Risk

#### [FIXED] ExperimentsView — Archive experiment fires without confirmation
- **File:** `app/experiments/ExperimentsView.tsx`
- **Issue:** Archive is a destructive one-way state change. On mobile, mis-tapping is likely given the density of the action controls. No confirmation was required.
- **Fix:** Added `window.confirm()` in `handleArchiveFor` before proceeding with the archive request.

---

## Issues NOT Fixed (Out of Scope / Requires Larger Refactor)

### GovernanceView — ActionReasonModal may be obscured by mobile virtual keyboard
- **File:** `app/automation/governance/GovernanceView.tsx:504`
- `autoFocus` on the input triggers the virtual keyboard immediately. The modal uses `items-end` (bottom sheet on mobile), which places it near the keyboard. On some iOS/Android configurations, the keyboard can partially obscure the confirm button.
- **Mitigation:** The modal already uses `items-end justify-center` so it anchors at the bottom. The confirm button is in the modal below the input and should scroll into view on most devices.
- **Recommendation:** Add `paddingBottom: 'env(safe-area-inset-bottom)'` or test on physical devices to verify the confirm button remains visible with keyboard open.

### AssistantView — FilterBar has no visual feedback when filter is applied mid-conversation
- When a user changes the filter context and sends a new message, old messages in the thread still reflect the previous context. There's no inline badge or separator indicating context changed.
- **Recommendation:** Add a "Context updated" separator in the conversation thread when the filter changes while messages exist.

### Command Center — No workspace zero-state redirect when all data is empty
- If a workspace has clients but all data (experiments, approvals, pacing, alerts) is empty, the Command Center renders with empty sections. The sections do have per-panel empty states but there's no top-level guidance.
- **Recommendation:** This is acceptable — the Dashboard page already handles the "no clients yet" case via redirect to `/onboarding`.

### PublishPrepDetail — TargetMappingSection inline form has small Save/Cancel buttons
- `px-3 py-2 text-xs` buttons (~34px). While these are in an editing context where the keyboard is present, they are still below the 44px recommendation.
- **Recommendation:** Increase to `py-3` in a follow-up pass.

---

## Files Changed in This Audit

| File | Change |
|------|--------|
| `components/ui/AppShell.tsx` | Hamburger p-1.5 → p-2.5 (44px touch target) |
| `components/ui/Sidebar.tsx` | Add `relative` to nav group `<ul>` for correct left rail positioning |
| `components/ui/TraceDrawer.tsx` | Close button p-1.5 → p-2.5 |
| `app/assistant/AssistantView.tsx` | Fix layout (h-full, no min-h-screen); fix input (shrink-0, not sticky); collapsible FilterBar on mobile |
| `app/automation/governance/GovernanceView.tsx` | StopCard + OverrideCard Clear buttons min-h-[44px]; Cancel min-h-[44px]; error dismiss button has proper tap area |
| `app/creative-lab/publish-prep/PublishPrepView.tsx` | Fix mobile stacked actions (pending → pendingId, item-specific handlers); filter chip py-1 → py-2 |
| `app/experiments/ExperimentsView.tsx` | Fix mobile stacked actions (pending → pendingId, per-experiment factory handlers); archive confirmation; filter chip py-1 → py-2 |

---

## Remaining Risk Areas

| Area | Risk | Recommendation |
|------|------|----------------|
| GovernanceView modal keyboard overlap | Medium | Test on iOS/Android physical devices; add safe-area padding if needed |
| PublishPrepDetail inline form buttons | Low | Increase `py-2` → `py-3` for Save/Cancel in TargetMappingSection |
| LaunchPlanDetail unimplemented actions | Medium | Still uses `notImplemented()` stubs — implement in Phase 9 |
| Mobile keyboard interaction in all modal inputs | Medium | Audit all `fixed` positioned dialogs for keyboard overlap on iOS |
| Long experiment rationale text on narrow screens | Low | Text uses `text-xs leading-relaxed` which is good, but very long rationale strings should be truncated with a "read more" pattern |
| Command Center dense tables on mobile | Low | All Command Center sections use `flex-wrap` row layouts that degrade to cards — visually acceptable |

---

## Recommended Next Hardening Steps

1. **Physical device testing** — Test governance approval flow and assistant input on a real iOS device to verify keyboard interaction with modals
2. **Safe-area insets** — Add `env(safe-area-inset-bottom)` to modal footers and sticky input bars for notched devices
3. **AssistantView filter context separator** — Show a subtle separator in the conversation thread when the filter context changes mid-session
4. **E2E smoke tests** — Add Playwright tests for: (a) mobile approve action in governance, (b) evaluate experiment on mobile, (c) assistant input submit cycle
5. **LaunchPlanDetail implementation** — Wire up the 4 remaining `notImplemented()` stub actions
6. **TargetMappingSection button sizing** — Increase `py-2` → `py-3` for Save/Cancel
7. **Consistent touch target audit** — Run a systematic scan for any remaining `py-1` or `p-1` interactive elements outside the flows audited here
