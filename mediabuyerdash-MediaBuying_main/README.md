# Media Buying Dashboard

A Next.js dashboard for media buying agencies to manage Facebook ad accounts, analyze campaigns, and reconcile Meta-reported data with CRM source-of-truth metrics.

## Prerequisites

- Node.js 18+
- npm

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

Copy the example environment file and configure the database URL:

```bash
cp .env.example .env
```

The default `DATABASE_URL` uses SQLite at `file:./dev.db`.

### 3. Run Prisma migration

Create and apply the database schema:

```bash
npm run db:push
```

Or, to use Prisma Migrate with versioned migrations:

```bash
npm run db:migrate
```

### 4. Seed the database

Insert sample data (client accounts, campaigns, ad sets, ads, UTM rows, CRM rows, reconciliation results):

```bash
npm run db:seed
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database setup (reference)

| Command | Description |
|---------|-------------|
| `npm run db:push` | Push schema to database (no migration files) |
| `npm run db:migrate` | Create and apply migrations |
| `npm run db:seed` | Run the seed script |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

## Project structure

- `prisma/schema.prisma` — Database schema (Prisma)
- `prisma/seed.js` — Sample data seed
- `lib/db.ts` — Prisma client singleton

## Generation persistence and audit trail

The migration `20250312000000_add_generation_persistence` adds models for AI generation history:

- **GenerationRun** — Run metadata (ad, request type, provider, mode, status)
- **GenerationPromptSnapshot** — Rendered prompt and context
- **GenerationProviderRequest** — Formatted provider payload
- **GenerationProviderResponse** — Raw provider response
- **GeneratedCopyVariation** / **GeneratedImageVariation** — Parsed outputs with approval status
- **GenerationApprovalDecision** — Approval/rejection decisions
- **SelectedCreativeVariant** — Selected test candidate per run

Run the migration with `npm run db:migrate` or `npm run db:push`. The seed script does not populate generation data; it is created when you run the pipeline in Creative Lab. View history at `/creative-history`.
