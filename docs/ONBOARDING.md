# Onboarding Flow — Architecture & Setup

## Route Flow

```
/signup → register + auto sign-in → /onboarding (wizard) → /home (dashboard)
/register → same flow (redirects to /onboarding after sign-in)
```

### Returning Users
- If onboarding is incomplete, `/onboarding` resumes at the last step
- If onboarding is complete, `/onboarding` redirects to `/home`
- Users can always access `/onboarding` manually to review setup

## Onboarding Steps

| Step | Route | What It Does |
|------|-------|-------------|
| 1. Workspace Details | `/onboarding` (step 1) | Set workspace name and timezone |
| 2. Business Profile | `/onboarding` (step 2) | Brand name, industry, website, ad spend range |
| 3. Integrations | `/onboarding` (step 3) | Links to Meta, Shopify, and client setup (skip-able) |
| 4. Review | `/onboarding` (step 4) | Summary, setup checklist, go to dashboard |

## Account/Workspace Creation

### Registration Flow
1. User submits `/signup` or `/register` form
2. `registerUser()` server action creates:
   - `User` record (email + bcrypt hash)
   - `Workspace` record (default name based on user's name)
   - `WorkspaceMembership` (role: "owner")
3. Client-side `signIn()` creates JWT session
4. Redirect to `/onboarding`

### Onboarding Initialization
1. `/onboarding` page calls `initializeOnboardingState(workspaceId)`
2. This upserts an `OnboardingState` record (idempotent)
3. Default state: `currentStep: "workspace_details"`, all steps `false`

## Data Models

### Workspace (extended)
New fields added during onboarding:
- `brandName` — company/brand name
- `industry` — e.g. "ecommerce", "agency", "saas"
- `timezone` — IANA timezone string
- `website` — optional URL
- `monthlyAdSpend` — spend range bucket

### OnboardingState
- `workspaceId` (unique) — links to Workspace
- `currentStep` — which step the user is on
- `workspaceDetailsDone`, `businessProfileDone`, `integrationsDone`, `reviewDone` — per-step completion flags
- `completedAt` — null until onboarding is finished

## How Progress Is Stored

- Server actions update `OnboardingState` after each step
- `currentStep` tracks where to resume
- Individual `*Done` booleans track which steps are complete
- `completedAt` is set when the user clicks "Go to Dashboard" on the review step
- Progress is per-workspace, not per-user

## What Is Complete vs Placeholder

### Complete
- Account creation (User + Workspace + Membership)
- Workspace details form (name, timezone)
- Business profile form (brand, industry, website, spend range)
- Onboarding state tracking and resumability
- Setup checklist computation
- Review summary

### Placeholder / Entry Points
- **Meta Ads connection** — links to existing `/integrations/meta` page (OAuth flow exists)
- **Shopify connection** — links to existing `/integrations/shopify` page (flow exists)
- **Client creation** — links to existing `/clients` page
- **Stripe billing** — not yet implemented; `/signup` creates account but does not charge

## Current Limitations

1. **No Stripe integration** — the $1 trial charge is not implemented. Signup creates a free account. Billing needs to be added as the next step.
2. **Integration setup is skip-able** — users can complete onboarding without connecting Meta or Shopify. The setup checklist on `/home` can remind them.
3. **No team invites** — onboarding is single-user. Team management comes later.
4. **No onboarding email sequence** — no automated emails for incomplete onboarding.
5. **Workspace name in JWT** — if the user changes their workspace name during onboarding, the JWT still contains the old name until next sign-in.

## File Structure

```
app/
  signup/
    page.tsx              # Trial signup page (public)
    SignupForm.tsx         # Signup form → /onboarding
  register/
    page.tsx              # Standard registration (public)
    RegisterForm.tsx      # Register form → /onboarding
    actions.ts            # registerUser() server action
  onboarding/
    page.tsx              # Server component: loads state, renders wizard
    OnboardingWizard.tsx  # Client component: multi-step wizard
    OnboardingView.tsx    # Legacy (preserved, not used by new flow)
    actions.ts            # Server actions for each wizard step
    steps/
      WorkspaceStep.tsx   # Step 1: workspace name + timezone
      BusinessStep.tsx    # Step 2: brand, industry, spend range
      IntegrationsStep.tsx # Step 3: Meta, Shopify, client links
      ReviewStep.tsx      # Step 4: summary + checklist
lib/
  onboarding.ts           # Utility functions: init, progress, checklist
prisma/
  schema.prisma           # OnboardingState model + Workspace fields
```

## Next Steps

1. **Stripe billing** — add $1 trial checkout to `/signup` flow
2. **Post-onboarding checklist** — show incomplete setup items on dashboard
3. **Onboarding email sequence** — reminders for incomplete setup
4. **Team invites** — add members during onboarding
