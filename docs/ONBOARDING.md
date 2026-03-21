# Onboarding Flow — Architecture & Setup

## Route Flow

```
/signup → register + auto sign-in → /onboarding (7-step wizard) → /home
/register → same flow (redirects to /onboarding after sign-in)
/login → if onboarding incomplete → /onboarding (via app logic)
```

### Returning Users
- If onboarding is incomplete, `/onboarding` resumes at the last step
- If onboarding is complete, `/onboarding` redirects to `/home`
- Users can access `/onboarding` manually to review setup
- "Save and continue later" link is always visible

## Onboarding Steps (7 total)

| # | Step ID | Label | What It Does | Skippable |
|---|---------|-------|-------------|-----------|
| 1 | `create_workspace` | Workspace | Set workspace name and timezone | No |
| 2 | `business_details` | Business | Brand name, industry, website, ad spend range | No (brand required) |
| 3 | `account_defaults` | Defaults | Default currency and reporting window | No |
| 4 | `connect_meta_placeholder` | Meta Ads | Connect Meta ad accounts (placeholder) | Yes |
| 5 | `connect_shopify_placeholder` | Shopify | Connect Shopify store (placeholder) | Yes |
| 6 | `review_setup` | Review | Setup summary + checklist | No |
| 7 | `onboarding_complete` | Complete | Terminal state (not visible in UI) | — |

## Account/Workspace Creation

### Registration Flow
1. User submits `/signup` or `/register` form
2. `registerUser()` server action creates User, Workspace, WorkspaceMembership
3. `createWorkspaceForUser()` utility provides idempotent workspace creation
4. Client-side `signIn()` creates JWT session
5. Redirect to `/onboarding`

### Onboarding Initialization
1. `/onboarding` page calls `initializeOnboardingSession(workspaceId)`
2. Upserts an `OnboardingState` record (idempotent)
3. Updates `lastActiveAt` on every visit (for stale detection)
4. Default state: `currentStep: "create_workspace"`, all steps `false`

## Data Models

### Workspace (extended with business profile)
| Field | Type | Set During |
|-------|------|-----------|
| `name` | String | Step 1 (create_workspace) |
| `timezone` | String | Step 1 + Step 3 |
| `brandName` | String? | Step 2 (business_details) |
| `industry` | String? | Step 2 |
| `website` | String? | Step 2 |
| `monthlyAdSpend` | String? | Step 2 |

### OnboardingState
| Field | Type | Purpose |
|-------|------|---------|
| `workspaceId` | String (unique) | Links to Workspace |
| `currentStep` | String | Which step to resume |
| `createWorkspaceDone` | Boolean | Step 1 complete |
| `businessDetailsDone` | Boolean | Step 2 complete |
| `accountDefaultsDone` | Boolean | Step 3 complete |
| `connectMetaPlaceholderDone` | Boolean | Step 4 complete |
| `connectShopifyPlaceholderDone` | Boolean | Step 5 complete |
| `reviewSetupDone` | Boolean | Step 6 complete |
| `draftFormData` | String? (JSON) | Partial form persistence |
| `lastActiveAt` | DateTime | Stale session detection |
| `completedAt` | DateTime? | Null until done |

## Typed Models

All typed models are defined in `lib/onboarding-types.ts` (client-safe):

| Model | Purpose |
|-------|---------|
| `WorkspaceAccount` | Workspace entity with business profile fields |
| `OnboardingSession` | Session tracking with stale detection |
| `OnboardingStep` | Individual step metadata |
| `OnboardingProgress` | Full progress across all 7 steps |
| `BusinessProfile` | Business details collected in step 2 |
| `IntegrationSetupState` | Meta + Shopify connection status |
| `AccountSetupChecklist` | Post-onboarding checklist |
| `OnboardingBlocker` | Conditions blocking progress |
| `OnboardingCompletionState` | Summary of completed vs remaining |
| `PostSignupRedirectState` | Post-signup routing logic |
| `AccountDefaults` | Currency, timezone, reporting window |

## Utility Functions

All in `lib/onboarding.ts` (server-side):

| Function | Purpose |
|----------|---------|
| `createWorkspaceForUser()` | Idempotent workspace creation |
| `initializeOnboardingSession()` | Upsert onboarding state |
| `updateOnboardingProgress()` | Mark step done, advance to next |
| `saveDraftFormData()` | Persist partial form data |
| `completeOnboarding()` | Mark onboarding finished |
| `getWorkspaceAccount()` | Load workspace with profile |
| `getIntegrationSetupState()` | Check Meta/Shopify connection |
| `buildAccountSetupChecklist()` | Compute setup checklist |
| `computeOnboardingCompletionState()` | Summary of completion |
| `summarizeOnboardingNextSteps()` | Next actions with priority |
| `getOnboardingBlockers()` | Check for blocking conditions |
| `computePostSignupRedirect()` | Determine redirect destination |

## Edge Case Handling

| Scenario | Behavior |
|----------|----------|
| **Workspace already exists** | `createWorkspaceForUser()` returns existing workspace |
| **Onboarding incomplete** | Resumes at `currentStep` |
| **Stale session** (>7 days inactive) | Blocker warning shown, user can resume |
| **Missing billing** | Placeholder — blocker type exists but not yet enforced |
| **Partial form data** | Saved as JSON in `draftFormData`, loaded on resume |
| **User returns later** | `lastActiveAt` updated, progress preserved |
| **Tab closes mid-form** | Draft saved on blur (best-effort) |

## AppShell Behavior

The onboarding flow renders **without sidebar or header chrome** — clean, focused experience.
This is controlled in `components/ui/AppShell.tsx`:
```typescript
const isOnboarding = pathname?.startsWith("/onboarding");
if (isPortal || isMarketing || isOnboarding) return <>{children}</>;
```

## What Is Complete vs Placeholder

### Complete
- Account creation (User + Workspace + Membership)
- 7-step onboarding wizard with progress tracking
- Workspace details form (name, timezone)
- Business profile form (brand, industry, website, spend range)
- Account defaults form (currency, reporting window)
- Onboarding state tracking and resumability
- Setup checklist computation
- Review summary with checklist
- Blocker detection (stale sessions)
- Draft form persistence
- Chrome-free onboarding experience

### Placeholder / Entry Points
- **Meta Ads connection** — links to existing `/integrations/meta` page
- **Shopify connection** — links to existing `/integrations/shopify` page
- **Stripe billing** — not yet implemented; signup creates free account
- **Onboarding email sequence** — not implemented

## Current Limitations

1. **No Stripe integration** — the $1 trial is not yet charged
2. **Integration steps are skip-able** — users can complete onboarding without connecting
3. **No team invites** — single-user onboarding
4. **No onboarding email sequence**
5. **Workspace name in JWT** — stale until next sign-in if changed during onboarding
6. **Currency/reporting window** — stored as account defaults but not yet used by client creation

## File Structure

```
app/
  signup/
    page.tsx              # Trial signup page (public, chrome-free)
    SignupForm.tsx         # Signup form → /onboarding
  register/
    page.tsx              # Standard registration (redirects to /onboarding)
    RegisterForm.tsx      # Register form → /onboarding
    actions.ts            # registerUser() server action
  onboarding/
    page.tsx              # Server: loads state, renders wizard
    OnboardingWizard.tsx  # Client: 7-step wizard container
    OnboardingView.tsx    # Legacy (preserved, not used)
    actions.ts            # Server actions for each step
    steps/
      WorkspaceStep.tsx       # Step 1: workspace name + timezone
      BusinessStep.tsx        # Step 2: brand, industry, spend range
      AccountDefaultsStep.tsx # Step 3: currency + reporting window
      ConnectMetaStep.tsx     # Step 4: Meta Ads placeholder
      ConnectShopifyStep.tsx  # Step 5: Shopify placeholder
      ReviewStep.tsx          # Step 6: summary + checklist
lib/
  onboarding.ts           # Server-side utility functions
  onboarding-types.ts     # Client-safe types and constants
prisma/
  schema.prisma           # OnboardingState model + Workspace fields
components/ui/
  AppShell.tsx            # Excludes /onboarding from sidebar chrome
```

## Next Steps

1. **Stripe billing** — add $1 trial checkout to `/signup` flow
2. **Post-onboarding checklist on dashboard** — show incomplete items on `/home`
3. **Onboarding email sequence** — reminders for incomplete setup
4. **Team invites** — add members during onboarding
5. **Account defaults enforcement** — use currency/reporting window in client creation
