# Marketing Site — Architecture & Setup

## Route Structure

### Public Routes (no auth required)
| Route | Purpose |
|-------|---------|
| `/` | Marketing landing page / sales page |
| `/login` | User login |
| `/register` | User registration |
| `/signup` | Trial signup entry point (to be implemented) |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

### Authenticated Routes (auth required)
| Route | Purpose |
|-------|---------|
| `/home` | Daily executive summary (was previously at `/`) |
| `/dashboard` | Operator dashboard |
| `/clients/*` | Client management |
| `/creative-lab/*` | Creative testing |
| `/portfolio/*` | Portfolio governance |
| All other routes | Protected by middleware |

## CTA Routing

All marketing CTAs point to `/signup`. This route does not exist yet and needs to be implemented in the next step.

**Next step**: Build the `/signup` page that:
1. Collects user information (name, email, password)
2. Initiates a Stripe Checkout session for the $1 trial
3. Creates the user account on successful payment
4. Redirects to `/onboarding` after account creation

## What Still Needs Implementation

### Auth & Billing (next step)
- [ ] `/signup` page with trial signup form
- [ ] Stripe integration for $1 trial → $495/month billing
- [ ] Stripe webhook handler for subscription events
- [ ] Trial expiration handling
- [ ] Billing management page for existing users

### Marketing Enhancements (future)
- [ ] Real product screenshots to replace the CSS mockup
- [ ] Social proof section (testimonials, logos, case studies)
- [ ] Blog/content system
- [ ] SEO metadata and Open Graph images
- [ ] Analytics tracking (PostHog, Plausible, etc.)

## Architecture Decisions

### Why AppShell conditional rendering (not route groups)?
The existing app has 30+ routes at the top level (`app/clients/`, `app/creative-lab/`, etc.).
Moving them all into an `(app)/` route group would be a massive, risky refactor. Instead,
`AppShell` detects marketing paths and renders without chrome — same pattern already used
for portal pages.

### Why `/home` instead of keeping dashboard at `/`?
The root `/` is the most important route for SEO and first impressions. Giving it to the
marketing page means organic traffic lands on the sales page. Authenticated users access
the dashboard via sidebar navigation at `/home`.

### Middleware approach
The Next.js middleware uses a regex-based matcher with negative lookahead to exclude public
paths. The `$` anchor excludes the root `/` path specifically.

## File Structure

```
components/marketing/
├── Nav.tsx              # Fixed top navigation with mobile menu
├── Footer.tsx           # Footer with links and trial CTA
├── DashboardMockup.tsx  # CSS-based product mockup
├── HeroSection.tsx      # Hero with headline, CTAs, mockup
├── FeatureSections.tsx  # What It Does, Workflow, Why Different, Features, How It Works
├── PricingSection.tsx   # Pricing card with $1 trial offer
├── FaqSection.tsx       # Accordion FAQ
└── CtaSection.tsx       # Final CTA block
```

## Responsive Design

- **Mobile-first**: All components use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
- **Hero**: Stacks vertically on mobile, centered text, full-width CTA buttons
- **Feature grids**: 1-col → 2-col → 3-col responsive grid
- **Navigation**: Hamburger menu on mobile, full nav on desktop
- **Pricing**: Single centered card, reads well at all sizes
- **FAQ**: Full-width accordion, touch-friendly tap targets
